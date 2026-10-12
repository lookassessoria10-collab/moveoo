/**
 * Testes de comportamento da plataforma com PostgreSQL real (PGlite em
 * memória): isolamento entre organizações, vínculo, convites, escopo da
 * pessoa, liberação por recurso, integridade de resultados e histórico.
 *
 * Verificam SOFTWARE. Não validam a precisão clínica de nenhuma medida.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import { createTestDb, type Db } from "@/db/client";
import { seedScenario, DEMO_PASSWORD } from "@/db/seed-data";
import {
  assessmentRequests,
  assessmentSessions,
  feedbacks,
  invitations,
  measurementReviews,
  measurements,
  outboxMessages,
  workspaces,
} from "@/db/schema";
import { loadWorkspaceContext, requireCareAccess, type WorkspaceContext } from "../services/authz";
import { listPeople, createPerson } from "../services/people";
import {
  createAssessmentRequest,
  getRequestDetail,
  publishFeedback,
  reviewSession,
  revokeInvitation,
  compareWithPrevious,
  recordManualMeasurements,
} from "../services/assessments";
import {
  beginInvitation,
  confirmInvitation,
  getInvitationLanding,
  getPublishedFeedbackForPerson,
  interruptAssessment,
  personScopeFromToken,
  recordConsent,
  startAssessment,
  submitAssessmentResult,
  type PersonScope,
} from "../services/personAccess";
import { login } from "../services/accounts";
import { recordReleaseDecision } from "../services/admin";
import { createWorkspace } from "../services/workspaces";
import { assertProtocolExecutable, redactSecrets } from "../services/core";
import { featureReleases } from "@/db/schema";
import { isDomainError } from "../errors";

let db: Db;
let close: () => Promise<void>;
let s: Awaited<ReturnType<typeof seedScenario>>;
let anaCtx: WorkspaceContext;
let brunoCtx: WorkspaceContext;
let carlaCtx: WorkspaceContext;
let diegoCtx: WorkspaceContext;
const BASE = "http://localhost:3000";

async function expectDenied(p: Promise<unknown>, code: string = "nao_encontrado") {
  try {
    await p;
  } catch (e) {
    if (isDomainError(e)) {
      expect(e.code).toBe(code);
      return;
    }
    throw e;
  }
  throw new Error("Era esperado acesso negado");
}

function tokenFromUrl(url: string) {
  return url.split("/convite/")[1];
}

async function lastCode(recipient: string): Promise<string> {
  const [m] = await db
    .select()
    .from(outboxMessages)
    .where(eq(outboxMessages.recipient, recipient))
    .orderBy(desc(outboxMessages.createdAt))
    .limit(1);
  return m.body.match(/é (\d{6})/)![1];
}

async function enterAsPerson(inviteUrl: string, recipient: string): Promise<{ token: string; scope: PersonScope }> {
  const t = tokenFromUrl(inviteUrl);
  await beginInvitation(db, t);
  const res = await confirmInvitation(db, t, await lastCode(recipient));
  if (!res.ok) throw new Error("confirmação falhou");
  const scope = (await personScopeFromToken(db, res.sessionToken))!;
  return { token: res.sessionToken, scope };
}

const shoulderPayload = (values: { fr: (number | null)[]; fl: (number | null)[] }, isDemo = false) => ({
  completedAt: Date.now(),
  isDemo,
  intake: { symptomSide: "right", initialPain: 3, problemDuration: "weeks" },
  blocks: [
    { side: "right", movement: "flexion", pain: { hadPain: false }, attempts: values.fr.map((v, i) => ({ repetitionIndex: i + 1, maxAngle: v, duration: 1000, maxTrunkCompensation: 2, angleBeforeCompensation: null })) },
    { side: "left", movement: "flexion", pain: { hadPain: true, intensity: 4, moment: "near_limit" }, attempts: values.fl.map((v, i) => ({ repetitionIndex: i + 1, maxAngle: v, duration: 1000, maxTrunkCompensation: 2, angleBeforeCompensation: null })) },
  ],
});

async function consentAll(scope: PersonScope) {
  for (const key of ["teleatendimento", "uso_camera"]) {
    await recordConsent(db, scope, { key, decision: "aceito", signerName: "João Exemplo" });
  }
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  s = await seedScenario(db);
  anaCtx = await loadWorkspaceContext(db, s.ana.id, s.clinica.id);
  brunoCtx = await loadWorkspaceContext(db, s.bruno.id, s.clinica.id);
  carlaCtx = await loadWorkspaceContext(db, s.carla.id, s.clinica.id);
  diegoCtx = await loadWorkspaceContext(db, s.diego.id, s.estudio.id);
});

afterAll(async () => {
  await close();
});

describe("isolamento entre organizações", () => {
  it("profissional não carrega contexto de um espaço do qual não participa", async () => {
    await expectDenied(loadWorkspaceContext(db, s.ana.id, s.estudio.id));
  });

  it("profissional da organização A não acessa pessoa da organização B, mesmo com o id", async () => {
    await expectDenied(requireCareAccess(db, anaCtx, s.pedro.id));
  });

  it("solicitação de B não é visível a partir de A", async () => {
    const { request } = await createAssessmentRequest(db, diegoCtx, { personId: s.pedro.id, protocolId: "joelho-camera", channel: "email" }, BASE);
    await expectDenied(getRequestDetail(db, anaCtx, request.id));
    await expectDenied(createAssessmentRequest(db, anaCtx, { personId: s.pedro.id, protocolId: "ombro-camera", channel: "email" }, BASE));
  });

  it("o banco rejeita ligar um registro a uma pessoa de outro espaço (chave composta)", async () => {
    await expect(
      db.insert(assessmentRequests).values({
        workspaceId: s.clinica.id,
        personId: s.pedro.id, // pessoa do Estúdio
        requestedBy: s.ana.id,
        protocolId: "ombro-camera",
        protocolVersion: "1.0.0",
      })
    ).rejects.toThrow();
  });
});

describe("vínculo e papéis dentro da mesma organização", () => {
  it("profissional sem vínculo não acessa a pessoa atendida por colega", async () => {
    await expectDenied(requireCareAccess(db, brunoCtx, s.joao.id));
    const list = await listPeople(db, brunoCtx);
    expect(list.map((p) => p.id)).not.toContain(s.joao.id);
  });

  it("assistente vê o cadastro, mas não tem acesso clínico", async () => {
    const list = await listPeople(db, carlaCtx);
    expect(list.map((p) => p.id)).toContain(s.joao.id);
    await expectDenied(requireCareAccess(db, carlaCtx, s.joao.id));
  });

  it("pessoa cadastrada em espaço de demonstração fica marcada como fictícia", async () => {
    const p = await createPerson(db, anaCtx, {
      fullName: "Teste Fictício",
      email: "teste@moveo.test",
      preferredChannel: "email",
      episodeTitle: "Teste",
      modality: "remoto",
    });
    expect(p.isFictitious).toBe(true);
  });
});

describe("convite e acesso da pessoa", () => {
  it("abrir o link (prévia) não autentica nem registra acesso", async () => {
    const { url, invitation } = await createAssessmentRequest(db, anaCtx, { personId: s.joao.id, protocolId: "ombro-camera", channel: "email" }, BASE);
    const landing = await getInvitationLanding(db, tokenFromUrl(url));
    expect(landing?.workspaceName).toBe(s.clinica.name);
    expect(JSON.stringify(landing)).not.toContain("João");
    const [inv] = await db.select().from(invitations).where(eq(invitations.id, invitation.id));
    expect(inv.accessedAt).toBeNull();
    expect(inv.confirmedAt).toBeNull();
  });

  it("código errado não dá acesso; após o limite de tentativas, o convite bloqueia", async () => {
    const { url } = await createAssessmentRequest(db, anaCtx, { personId: s.joao.id, protocolId: "ombro-camera", channel: "email" }, BASE);
    const t = tokenFromUrl(url);
    await beginInvitation(db, t);
    for (let i = 0; i < 4; i++) expect((await confirmInvitation(db, t, "000000x")).ok).toBe(false);
    const last = await confirmInvitation(db, t, "999999");
    expect(last).toEqual({ ok: false, reason: expect.stringMatching(/codigo|bloqueado/) });
    const correct = await lastCode("joao.paciente@moveo.test");
    expect((await confirmInvitation(db, t, correct)).ok).toBe(false);
  });

  it("não envia um novo código antes de um minuto (evita disparo repetido)", async () => {
    const { url } = await createAssessmentRequest(db, anaCtx, { personId: s.joao.id, protocolId: "ombro-camera", channel: "email" }, BASE);
    await beginInvitation(db, tokenFromUrl(url));
    await expectDenied(beginInvitation(db, tokenFromUrl(url)), "conflito");
  });

  it("convite expirado ou revogado não abre a atividade e derruba a sessão derivada", async () => {
    const { url, invitation } = await createAssessmentRequest(db, anaCtx, { personId: s.joao.id, protocolId: "ombro-camera", channel: "email" }, BASE);
    const { token } = await enterAsPerson(url, "joao.paciente@moveo.test");
    expect(await personScopeFromToken(db, token)).not.toBeNull();
    await revokeInvitation(db, anaCtx, invitation.id);
    expect(await getInvitationLanding(db, tokenFromUrl(url))).toBeNull();
    expect(await personScopeFromToken(db, token)).toBeNull();

    const other = await createAssessmentRequest(db, anaCtx, { personId: s.joao.id, protocolId: "ombro-camera", channel: "email" }, BASE);
    await db.update(invitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitations.id, other.invitation.id));
    expect(await getInvitationLanding(db, tokenFromUrl(other.url))).toBeNull();
  });

  it("a sessão da pessoa só alcança a solicitação do próprio convite", async () => {
    const a = await createAssessmentRequest(db, anaCtx, { personId: s.joao.id, protocolId: "ombro-camera", channel: "email" }, BASE);
    const b = await createAssessmentRequest(db, anaCtx, { personId: s.joao.id, protocolId: "joelho-camera", channel: "email" }, BASE);
    const { scope } = await enterAsPerson(a.url, "joao.paciente@moveo.test");
    await consentAll(scope);
    await expectDenied(startAssessment(db, scope, b.request.id, { idempotencyKey: "chave-qualquer-1" }));
    await expectDenied(submitAssessmentResult(db, scope, b.request.id, { idempotencyKey: "chave-qualquer-2", result: {} }));
  });

  it("sem os aceites registrados, a atividade não inicia", async () => {
    const { url, request } = await createAssessmentRequest(db, anaCtx, { personId: s.joao.id, protocolId: "ombro-camera", channel: "email" }, BASE);
    const { scope } = await enterAsPerson(url, "joao.paciente@moveo.test");
    // aceites anteriores de João (outro convite) continuam valendo — registramos recusa para testar
    await recordConsent(db, scope, { key: "uso_camera", decision: "recusado", signerName: "João Exemplo" });
    await expectDenied(startAssessment(db, scope, request.id, { idempotencyKey: "sem-aceite-1" }), "acesso_negado");
  });
});

describe("resultado, revisão e devolutiva", () => {
  let requestId: string;
  let scope: PersonScope;

  it("captura insuficiente não gera número; reenvio não duplica", async () => {
    const created = await createAssessmentRequest(db, anaCtx, { personId: s.joao.id, protocolId: "ombro-camera", channel: "email" }, BASE);
    requestId = created.request.id;
    ({ scope } = await enterAsPerson(created.url, "joao.paciente@moveo.test"));
    await consentAll(scope);
    await startAssessment(db, scope, requestId, { idempotencyKey: "sessao-1-abcdef" });
    const payload = shoulderPayload({ fr: [90, 95, 100], fl: [null, null] });
    const first = await submitAssessmentResult(db, scope, requestId, { idempotencyKey: "sessao-1-abcdef", result: payload });
    const again = await submitAssessmentResult(db, scope, requestId, { idempotencyKey: "sessao-1-abcdef", result: payload });
    expect(again.duplicate).toBe(true);
    const ms = await db.select().from(measurements).where(eq(measurements.sessionId, first.session.id));
    expect(ms).toHaveLength(4);
    const flexLeft = ms.find((m) => m.side === "esquerdo" && m.metricKey.includes("flexao"))!;
    expect(flexLeft.value).toBeNull();
    expect(flexLeft.quality).toBe("insuficiente");
    expect(first.session.algorithmVersion).toBeTruthy();
    expect(first.session.modelId).toContain("pose_landmarker");
    const [req] = await db.select().from(assessmentRequests).where(eq(assessmentRequests.id, requestId));
    expect(req.status).toBe("aguardando_revisao");
  });

  it("devolutiva não pode ser publicada antes da revisão das medidas", async () => {
    await expectDenied(publishFeedback(db, anaCtx, requestId, { body: "Orientação de teste para a pessoa.", includeMeasurements: true }), "conflito");
  });

  it("medida sem valor não pode ser 'aceita'; correção preserva o valor original", async () => {
    const detail = await getRequestDetail(db, anaCtx, requestId);
    const ms = detail.sessions[0].measurements;
    const invalidDecisions = ms.map((m) => ({ measurementId: m.id, decision: "aceita" as const }));
    await expectDenied(reviewSession(db, anaCtx, detail.sessions[0].id, invalidDecisions), "invalido");

    const decisions = ms.map((m) =>
      m.value === null
        ? { measurementId: m.id, decision: "descartada" as const, justification: "Lado não capturado" }
        : m.side === "direito" && m.metricKey.includes("flexao")
          ? { measurementId: m.id, decision: "corrigida" as const, correctedValue: 97, justification: "Conferido no vídeo ao vivo" }
          : { measurementId: m.id, decision: "aceita" as const }
    );
    await reviewSession(db, anaCtx, detail.sessions[0].id, decisions);
    const corrected = ms.find((m) => m.side === "direito" && m.metricKey.includes("flexao"))!;
    const [original] = await db.select().from(measurements).where(eq(measurements.id, corrected.id));
    expect(original.value).toBeCloseTo(95);
    const reviews = await db.select().from(measurementReviews).where(eq(measurementReviews.measurementId, corrected.id));
    expect(reviews[0].correctedValue).toBe(97);
  });

  it("publicar de novo cria versão nova e preserva a anterior", async () => {
    await publishFeedback(db, anaCtx, requestId, { body: "Primeira orientação para a pessoa.", includeMeasurements: true });
    await publishFeedback(db, anaCtx, requestId, { body: "Orientação revisada para a pessoa.", includeMeasurements: true });
    const versions = await db.select().from(feedbacks).where(eq(feedbacks.requestId, requestId)).orderBy(feedbacks.version);
    expect(versions.map((v) => [v.version, v.status])).toEqual([
      [1, "substituida"],
      [2, "publicada"],
    ]);
    const seen = await getPublishedFeedbackForPerson(db, scope);
    expect(seen?.feedback.body).toBe("Orientação revisada para a pessoa.");
    expect(seen?.reviewed.find((r) => r.side === "direito")?.value).toBe(97);
    expect(seen?.reviewed.some((r) => r.side === "esquerdo" && r.label.includes("Flexão"))).toBe(false);
  });

  it("reavaliação com o mesmo protocolo é comparada; diferença sem rótulo de melhora", async () => {
    const re = await createAssessmentRequest(
      db,
      anaCtx,
      { personId: s.joao.id, protocolId: "ombro-camera", channel: "email", previousRequestId: requestId },
      BASE
    );
    const { scope: sc } = await enterAsPerson(re.url, "joao.paciente@moveo.test");
    await submitAssessmentResult(db, sc, re.request.id, { idempotencyKey: "sessao-2-abcdef", result: shoulderPayload({ fr: [110, 112, 108], fl: [100] }) });
    const cmp = await compareWithPrevious(db, anaCtx, re.request.id);
    const row = cmp!.rows.find((r) => r.side === "direito" && r.metricKey.includes("flexao"))!;
    expect(row.compatible).toBe(true);
    expect(row.difference).toBeCloseTo(110 - 97);
    expect(row.provisional).toBe(true);
    const left = cmp!.rows.find((r) => r.side === "esquerdo" && r.metricKey.includes("flexao"))!;
    expect(left.compatible).toBe(false);
  });

  it("saída no meio da captura marca a sessão como interrompida", async () => {
    const c = await createAssessmentRequest(db, anaCtx, { personId: s.joao.id, protocolId: "ombro-camera", channel: "email" }, BASE);
    const { scope: sc } = await enterAsPerson(c.url, "joao.paciente@moveo.test");
    await startAssessment(db, sc, c.request.id, { idempotencyKey: "sessao-int-abcdef" });
    await interruptAssessment(db, sc, c.request.id, { idempotencyKey: "sessao-int-abcdef", reason: "saiu_da_pagina" });
    const [sess] = await db
      .select()
      .from(assessmentSessions)
      .where(and(eq(assessmentSessions.requestId, c.request.id), eq(assessmentSessions.idempotencyKey, "sessao-int-abcdef")));
    expect(sess.status).toBe("interrompida");
    expect(sess.interruptionReason).toBe("saiu_da_pagina");
  });

  it("medição presencial fica identificada como método do profissional", async () => {
    const req = await recordManualMeasurements(db, anaCtx, {
      personId: s.joao.id,
      items: [{ movement: "Flexão do ombro", side: "direito", value: 120, unit: "graus", instrument: "goniometro" }],
    });
    const detail = await getRequestDetail(db, anaCtx, req.id);
    expect(detail.sessions[0].origin).toBe("manual_profissional");
    expect(detail.sessions[0].measurements[0].method).toBe("goniometro");
  });
});

describe("liberação por recurso e ambiente", () => {
  it("espaço real exige registro verificado", async () => {
    await expectDenied(createWorkspace(db, s.ana.id, { name: "Real Ana", kind: "clinica", environment: "real" }), "acesso_negado");
  });

  it("função de mensuração sem liberação é bloqueada em espaço real, inclusive por chamada direta", async () => {
    const real = await createWorkspace(db, s.diego.id, { name: "Estúdio Força — real", kind: "estudio", environment: "real" });
    await expectDenied(assertProtocolExecutable(db, real, "joelho-camera"), "bloqueado_liberacao");
    const ctx = await loadWorkspaceContext(db, s.diego.id, real.id);
    const pessoa = await createPerson(db, ctx, { fullName: "Pessoa Teste", email: "real@moveo.test", preferredChannel: "email", episodeTitle: "Teste", modality: "remoto" });
    expect(pessoa.isFictitious).toBe(false);
    await expectDenied(
      createAssessmentRequest(db, ctx, { personId: pessoa.id, protocolId: "joelho-camera", channel: "email" }, BASE),
      "bloqueado_liberacao"
    );
  });

  it("recurso suspenso bloqueia novas execuções também na demonstração", async () => {
    await recordReleaseDecision(db, s.admin.id, {
      featureKey: "mensuracao_camera_coluna",
      algorithmVersion: (await import("@/config/precision")).ALGORITHM_VERSION,
      protocolVersion: "1.0.0",
      state: "suspenso",
      scope: "Teste automatizado de suspensão",
      evidence: "Nenhuma — teste de software",
    });
    await expectDenied(
      createAssessmentRequest(db, anaCtx, { personId: s.joao.id, protocolId: "coluna-camera", channel: "email" }, BASE),
      "bloqueado_liberacao"
    );
  });

  it("decisão registrada para outro modelo/runtime não libera a versão em uso", async () => {
    const { ALGORITHM_VERSION } = await import("@/config/precision");
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.name, "Estúdio Força — real"));
    await db.insert(featureReleases).values({
      featureKey: "mensuracao_camera_ombro",
      algorithmVersion: ALGORITHM_VERSION,
      protocolVersion: "1.0.0",
      modelVersion: "outro-modelo | outro-runtime",
      state: "liberado",
      scope: "teste",
      evidence: "teste",
      decidedBy: s.admin.id,
    });
    await expectDenied(assertProtocolExecutable(db, ws, "ombro-camera"), "bloqueado_liberacao");
  });

  it("segredos (links e códigos) são mascarados fora do desenvolvimento", () => {
    expect(redactSecrets("Acesse: http://x.test/convite/abc123 código 123456")).toBe("Acesse: [link omitido] código [código omitido]");
  });

  it("só administração da plataforma registra decisões de liberação", async () => {
    await expectDenied(
      recordReleaseDecision(db, s.ana.id, {
        featureKey: "mensuracao_camera_ombro",
        algorithmVersion: "x",
        protocolVersion: "1.0.0",
        state: "liberado",
        scope: "tentativa indevida de liberar",
        evidence: "nenhuma evidência informada",
      }),
      "acesso_negado"
    );
  });

  it("com decisão 'liberado' registrada, o espaço real executa; resultado de demonstração continua recusado", async () => {
    const { ALGORITHM_VERSION } = await import("@/config/precision");
    await recordReleaseDecision(db, s.admin.id, {
      featureKey: "mensuracao_camera_joelho",
      algorithmVersion: ALGORITHM_VERSION,
      protocolVersion: "1.0.0",
      state: "liberado",
      scope: "TESTE AUTOMATIZADO — decisão fictícia, sem valor regulatório",
      evidence: "Nenhuma — teste de software",
    });
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.name, "Estúdio Força — real"));
    const ctx = await loadWorkspaceContext(db, s.diego.id, ws.id);
    const people = await listPeople(db, ctx);
    const created = await createAssessmentRequest(db, ctx, { personId: people[0].id, protocolId: "joelho-camera", channel: "email" }, BASE);
    const { scope } = await enterAsPerson(created.url, "real@moveo.test");
    await consentAll(scope);
    const demoKnee = {
      completedAt: 1,
      isDemo: true,
      intake: { symptomSide: "testing", initialPain: 0, problemDuration: "no_pain" },
      flexionResults: [],
      squatResult: null,
      sitToStandResult: null,
    };
    await expectDenied(
      submitAssessmentResult(db, scope, created.request.id, { idempotencyKey: "demo-em-real-1", result: demoKnee }),
      "invalido"
    );
  });
});

describe("acesso de profissionais", () => {
  it("bloqueia a conta após tentativas seguidas com senha errada", async () => {
    for (let i = 0; i < 4; i++) expect((await login(db, "bruno.fisio@moveo.test", "errada")).ok).toBe(false);
    expect(await login(db, "bruno.fisio@moveo.test", "errada")).toEqual({ ok: false, reason: "bloqueado" });
    expect(await login(db, "bruno.fisio@moveo.test", DEMO_PASSWORD)).toEqual({ ok: false, reason: "bloqueado" });
  });

  it("e-mail inexistente e senha errada têm a mesma resposta", async () => {
    expect(await login(db, "ninguem@moveo.test", "x")).toEqual({ ok: false, reason: "credenciais" });
    expect(await login(db, "ana.fisio@moveo.test", "x")).toEqual({ ok: false, reason: "credenciais" });
  });
});
