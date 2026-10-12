/**
 * Acesso da pessoa atendida.
 *
 * Fluxo: link do convite (GET não autentica nem consome nada) →
 * "Continuar" envia um código ao contato cadastrado → código confirmado
 * vira uma sessão com escopo restrito à solicitação daquele convite.
 * O convite nunca dá acesso ao histórico completo.
 */
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import {
  assessmentRequests,
  assessmentSessions,
  measurements as measurementsTable,
  consentRecords,
  feedbacks,
  invitations,
  personSessions,
  persons,
  users,
  workspaces,
} from "@/db/schema";
import { ACCESS, PLATFORM } from "@/config/platform";
import { getProtocol } from "@/lib/care/protocols";
import { adaptModuleResult } from "@/lib/care/resultAdapters";
import { effectiveValue } from "@/lib/care/comparison";
import { POSE_MODEL_ID, POSE_RUNTIME_LABEL } from "@/lib/pose/modelInfo";
import { randomCode, randomToken, safeEqualHex, sha256 } from "../crypto";
import { conflict, forbidden, invalid, notFound } from "../errors";
import { assertProtocolExecutable, audit, currentConsentDocument, maskContact, sendMessage } from "./core";
import { loadMeasurements } from "./assessments";

async function findUsableInvitation(db: Db, token: string) {
  const [row] = await db
    .select({ invitation: invitations, workspace: workspaces, person: persons, request: assessmentRequests })
    .from(invitations)
    .innerJoin(workspaces, eq(workspaces.id, invitations.workspaceId))
    .innerJoin(persons, eq(persons.id, invitations.personId))
    .innerJoin(assessmentRequests, eq(assessmentRequests.id, invitations.assessmentRequestId))
    .where(eq(invitations.tokenHash, sha256(token)));
  if (!row) return null;
  const { invitation, request, person } = row;
  if (invitation.revokedAt || invitation.expiresAt <= new Date()) return null;
  if (request.status === "cancelada" || person.archivedAt) return null;
  return row;
}

/** Informação mínima para a página do link. Não revela nome da pessoa, protocolo nem dados clínicos. */
export async function getInvitationLanding(db: Db, token: string) {
  const row = await findUsableInvitation(db, token);
  if (!row) return null;
  return {
    workspaceName: row.workspace.name,
    brandColor: row.workspace.brandColor,
    logoUrl: row.workspace.logoUrl,
    isDemo: row.workspace.environment === "demonstracao",
    alreadyConfirmed: !!row.invitation.confirmedAt,
  };
}

/** Clique explícito em "Continuar": registra o acesso e envia o código ao contato cadastrado. */
export async function beginInvitation(db: Db, token: string) {
  const row = await findUsableInvitation(db, token);
  if (!row) throw notFound("Convite");
  const { invitation, person, workspace } = row;
  const destination = invitation.channel === "email" ? person.email : person.phone;
  if (!destination) throw invalid("Contato não cadastrado. Fale com o profissional.");
  if (invitation.codeAttempts >= ACCESS.codeMaxAttempts) {
    throw forbidden("Muitas tentativas. Peça um novo convite ao profissional.");
  }
  // No máximo um código por minuto (evita disparo repetido de SMS/e-mail).
  if (invitation.codeExpiresAt) {
    const lastSentAt = invitation.codeExpiresAt.getTime() - ACCESS.codeMinutes * 60_000;
    if (Date.now() - lastSentAt < ACCESS.codeResendSeconds * 1000) {
      throw conflict("Aguarde um minuto antes de pedir outro código.");
    }
  }
  const code = randomCode();
  await db
    .update(invitations)
    .set({
      accessedAt: invitation.accessedAt ?? new Date(),
      codeHash: sha256(code),
      codeExpiresAt: new Date(Date.now() + ACCESS.codeMinutes * 60_000),
    })
    .where(eq(invitations.id, invitation.id));
  await sendMessage(db, {
    channel: invitation.channel === "email" ? "email" : "sms",
    recipient: destination,
    subject: `Seu código de acesso — ${workspace.name}`,
    body: `Seu código de acesso no ${PLATFORM.name} é ${code}. Ele vale por ${ACCESS.codeMinutes} minutos. Não compartilhe este código.`,
  });
  await audit(db, {
    workspaceId: workspace.id,
    actorType: "pessoa",
    actorId: person.id,
    action: "convite.codigo_enviado",
    objectType: "invitation",
    objectId: invitation.id,
  });
  return { maskedDestination: maskContact(destination), channel: invitation.channel };
}

export type ConfirmResult = { ok: true; sessionToken: string } | { ok: false; reason: "codigo" | "expirado" | "bloqueado" };

export async function confirmInvitation(db: Db, token: string, code: string): Promise<ConfirmResult> {
  const row = await findUsableInvitation(db, token);
  if (!row) return { ok: false, reason: "expirado" };
  const { invitation, person, workspace } = row;
  if (invitation.codeAttempts >= ACCESS.codeMaxAttempts) return { ok: false, reason: "bloqueado" };
  if (!invitation.codeHash || !invitation.codeExpiresAt || invitation.codeExpiresAt <= new Date()) {
    return { ok: false, reason: "expirado" };
  }
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== 6 || !safeEqualHex(sha256(normalized), invitation.codeHash)) {
    await db.update(invitations).set({ codeAttempts: invitation.codeAttempts + 1 }).where(eq(invitations.id, invitation.id));
    return { ok: false, reason: invitation.codeAttempts + 1 >= ACCESS.codeMaxAttempts ? "bloqueado" : "codigo" };
  }
  const sessionToken = randomToken();
  const sessionExpiry = new Date(
    Math.min(Date.now() + ACCESS.personSessionHours * 3600_000, invitation.expiresAt.getTime())
  );
  await db
    .update(invitations)
    .set({ confirmedAt: invitation.confirmedAt ?? new Date(), codeHash: null, codeExpiresAt: null, codeAttempts: 0 })
    .where(eq(invitations.id, invitation.id));
  await db.insert(personSessions).values({
    tokenHash: sha256(sessionToken),
    workspaceId: workspace.id,
    personId: person.id,
    invitationId: invitation.id,
    expiresAt: sessionExpiry,
  });
  await audit(db, {
    workspaceId: workspace.id,
    actorType: "pessoa",
    actorId: person.id,
    action: "convite.confirmado",
    objectType: "invitation",
    objectId: invitation.id,
  });
  return { ok: true, sessionToken };
}

// ---------------------------------------------------------------------------
// Sessão da pessoa (escopo)
// ---------------------------------------------------------------------------

export interface PersonScope {
  sessionId: string;
  workspace: typeof workspaces.$inferSelect;
  person: typeof persons.$inferSelect;
  invitation: typeof invitations.$inferSelect;
  request: typeof assessmentRequests.$inferSelect;
  professionalName: string;
}

export async function personScopeFromToken(db: Db, token: string): Promise<PersonScope | null> {
  const [row] = await db
    .select({
      session: personSessions,
      invitation: invitations,
      workspace: workspaces,
      person: persons,
      request: assessmentRequests,
      professionalName: users.name,
    })
    .from(personSessions)
    .innerJoin(invitations, eq(invitations.id, personSessions.invitationId))
    .innerJoin(workspaces, eq(workspaces.id, personSessions.workspaceId))
    .innerJoin(persons, and(eq(persons.id, personSessions.personId), eq(persons.workspaceId, personSessions.workspaceId)))
    .innerJoin(assessmentRequests, eq(assessmentRequests.id, invitations.assessmentRequestId))
    .innerJoin(users, eq(users.id, assessmentRequests.requestedBy))
    .where(
      and(eq(personSessions.tokenHash, sha256(token)), isNull(personSessions.revokedAt), gt(personSessions.expiresAt, new Date()))
    );
  if (!row) return null;
  // Revogar o convite encerra imediatamente a sessão derivada dele.
  if (row.invitation.revokedAt || row.person.archivedAt) return null;
  return {
    sessionId: row.session.id,
    workspace: row.workspace,
    person: row.person,
    invitation: row.invitation,
    request: row.request,
    professionalName: row.professionalName,
  };
}

/** Garante que o identificador vindo do navegador é exatamente a solicitação do convite. */
function requireScopedRequest(scope: PersonScope, requestId: string) {
  if (scope.request.id !== requestId) throw notFound("Atividade");
  return scope.request;
}

// ---------------------------------------------------------------------------
// Consentimentos
// ---------------------------------------------------------------------------

export const REQUIRED_CONSENTS_FOR_CAMERA = ["teleatendimento", "uso_camera"] as const;

export async function consentStatus(db: Db, scope: PersonScope, keys: readonly string[]) {
  const out: { key: string; documentId: string; title: string; body: string; version: string; accepted: boolean }[] = [];
  for (const key of keys) {
    const doc = await currentConsentDocument(db, key);
    if (!doc) continue;
    const [last] = await db
      .select()
      .from(consentRecords)
      .where(
        and(
          eq(consentRecords.workspaceId, scope.workspace.id),
          eq(consentRecords.personId, scope.person.id),
          eq(consentRecords.documentId, doc.id)
        )
      )
      .orderBy(desc(consentRecords.recordedAt))
      .limit(1);
    out.push({ key, documentId: doc.id, title: doc.title, body: doc.body, version: doc.version, accepted: last?.decision === "aceito" });
  }
  return out;
}

export async function recordConsent(
  db: Db,
  scope: PersonScope,
  input: { key: string; decision: "aceito" | "recusado" | "revogado"; signerName: string }
) {
  const signer = input.signerName.trim();
  if (signer.length < 3) throw invalid("Digite seu nome completo para registrar.");
  const doc = await currentConsentDocument(db, input.key);
  if (!doc) throw notFound("Documento");
  await db.insert(consentRecords).values({
    workspaceId: scope.workspace.id,
    personId: scope.person.id,
    documentId: doc.id,
    decision: input.decision,
    signerName: signer,
    invitationId: scope.invitation.id,
  });
  await audit(db, {
    workspaceId: scope.workspace.id,
    actorType: "pessoa",
    actorId: scope.person.id,
    action: `consentimento.${input.decision}`,
    objectType: "consent_document",
    objectId: doc.id,
    metadata: { documento: doc.key, versao: doc.version },
  });
}

async function assertConsents(db: Db, scope: PersonScope) {
  const status = await consentStatus(db, scope, REQUIRED_CONSENTS_FOR_CAMERA);
  if (status.some((s) => !s.accepted)) throw forbidden("É preciso registrar os aceites antes de iniciar a atividade.");
}

// ---------------------------------------------------------------------------
// Execução da avaliação
// ---------------------------------------------------------------------------

const deviceSchema = z
  .object({
    userAgent: z.string().max(400).optional(),
    videoWidth: z.number().int().min(0).max(10000).nullable().optional(),
    videoHeight: z.number().int().min(0).max(10000).nullable().optional(),
  })
  .optional();

const idemSchema = z.string().min(8).max(100);

export async function startAssessment(
  db: Db,
  scope: PersonScope,
  requestId: string,
  input: { idempotencyKey: string; device?: unknown }
) {
  const request = requireScopedRequest(scope, requestId);
  const key = idemSchema.parse(input.idempotencyKey);
  if (request.status !== "pendente" && request.status !== "em_andamento") {
    throw conflict("Esta atividade já foi enviada.");
  }
  const protocol = getProtocol(request.protocolId);
  if (!protocol || protocol.kind !== "camera") throw notFound("Atividade");
  await assertProtocolExecutable(db, scope.workspace, protocol.id);
  await assertConsents(db, scope);

  const [existing] = await db
    .select()
    .from(assessmentSessions)
    .where(and(eq(assessmentSessions.requestId, request.id), eq(assessmentSessions.idempotencyKey, key)));
  if (existing) return existing;

  const [session] = await db
    .insert(assessmentSessions)
    .values({
      workspaceId: scope.workspace.id,
      requestId: request.id,
      personId: scope.person.id,
      idempotencyKey: key,
      origin: "camera",
      protocolId: protocol.id,
      protocolVersion: protocol.version,
      appVersion: PLATFORM.appVersion,
      algorithmVersion: protocol.algorithmVersion,
      modelId: POSE_MODEL_ID,
      runtimeVersion: POSE_RUNTIME_LABEL,
      device: deviceSchema.parse(input.device) ?? null,
    })
    .returning();
  await db.update(assessmentRequests).set({ status: "em_andamento" }).where(eq(assessmentRequests.id, request.id));
  await audit(db, {
    workspaceId: scope.workspace.id,
    actorType: "pessoa",
    actorId: scope.person.id,
    action: "avaliacao.iniciada",
    objectType: "assessment_session",
    objectId: session.id,
  });
  return session;
}

/**
 * Recebe o resultado do módulo. Reenvio com a mesma chave não duplica
 * (devolve a sessão já concluída). O servidor recalcula as medidas e a
 * qualidade a partir das tentativas (lib/care/resultAdapters.ts).
 */
export async function submitAssessmentResult(
  db: Db,
  scope: PersonScope,
  requestId: string,
  input: { idempotencyKey: string; result: unknown; device?: unknown }
) {
  const request = requireScopedRequest(scope, requestId);
  const key = idemSchema.parse(input.idempotencyKey);
  const [existing] = await db
    .select()
    .from(assessmentSessions)
    .where(and(eq(assessmentSessions.requestId, request.id), eq(assessmentSessions.idempotencyKey, key)));
  if (existing?.status === "concluida") return { session: existing, duplicate: true };
  if (request.status !== "pendente" && request.status !== "em_andamento") {
    throw conflict("Esta atividade já foi enviada.");
  }
  await assertProtocolExecutable(db, scope.workspace, request.protocolId);
  await assertConsents(db, scope);

  let adapted;
  try {
    adapted = adaptModuleResult(request.protocolId, input.result);
  } catch {
    await audit(db, {
      workspaceId: scope.workspace.id,
      actorType: "pessoa",
      actorId: scope.person.id,
      action: "avaliacao.resultado_rejeitado_formato",
      objectType: "assessment_request",
      objectId: request.id,
    });
    throw invalid("Resultado em formato inválido.");
  }
  if (adapted.origin === "demonstracao" && scope.workspace.environment === "real") {
    throw invalid("Resultados de demonstração não podem ser enviados em atendimento real.");
  }

  const protocol = getProtocol(request.protocolId)!;
  const session = await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    const values = {
      status: "concluida" as const,
      origin: adapted.origin,
      reportedContext: adapted.reportedContext,
      moduleSummary: adapted.moduleSummary as object,
      device: deviceSchema.parse(input.device) ?? null,
      completedAt: new Date(),
    };
    let s;
    if (existing) {
      [s] = await tx.update(assessmentSessions).set(values).where(eq(assessmentSessions.id, existing.id)).returning();
    } else {
      [s] = await tx
        .insert(assessmentSessions)
        .values({
          workspaceId: scope.workspace.id,
          requestId: request.id,
          personId: scope.person.id,
          idempotencyKey: key,
          protocolId: protocol.id,
          protocolVersion: protocol.version,
          appVersion: PLATFORM.appVersion,
          algorithmVersion: protocol.algorithmVersion,
          modelId: POSE_MODEL_ID,
          runtimeVersion: POSE_RUNTIME_LABEL,
          ...values,
        })
        .returning();
    }
    await tx.insert(measurementsTable).values(
      adapted.measurements.map((m) => ({ ...m, workspaceId: scope.workspace.id, sessionId: s.id }))
    );
    await tx.update(assessmentRequests).set({ status: "aguardando_revisao" }).where(eq(assessmentRequests.id, request.id));
    await audit(tx, {
      workspaceId: scope.workspace.id,
      actorType: "pessoa",
      actorId: scope.person.id,
      action: "avaliacao.enviada",
      objectType: "assessment_session",
      objectId: s.id,
      metadata: {
        origem: adapted.origin,
        medidas: adapted.measurements.length,
        insuficientes: adapted.measurements.filter((m) => m.quality === "insuficiente").length,
        valores_descartados: adapted.discardedValues,
        algoritmo: protocol.algorithmVersion,
      },
    });
    if (adapted.discardedValues > 0) {
      // Incidente técnico: valor impossível recebido e descartado (sem conteúdo clínico no registro).
      await audit(tx, {
        workspaceId: scope.workspace.id,
        actorType: "sistema",
        action: "medicao.valor_impossivel_descartado",
        objectType: "assessment_session",
        objectId: s.id,
        metadata: { quantidade: adapted.discardedValues, algoritmo: protocol.algorithmVersion },
      });
    }
    return s;
  });
  return { session, duplicate: false };
}

export async function interruptAssessment(
  db: Db,
  scope: PersonScope,
  requestId: string,
  input: { idempotencyKey: string; reason: string }
) {
  const request = requireScopedRequest(scope, requestId);
  const key = idemSchema.parse(input.idempotencyKey);
  const reason = z.enum(["saiu_da_pagina", "camera_indisponivel", "perguntas_de_seguranca", "pessoa_interrompeu"]).parse(input.reason);
  const [s] = await db
    .select()
    .from(assessmentSessions)
    .where(and(eq(assessmentSessions.requestId, request.id), eq(assessmentSessions.idempotencyKey, key)));
  if (!s || s.status !== "iniciada") return;
  await db
    .update(assessmentSessions)
    .set({ status: "interrompida", interruptionReason: reason, completedAt: new Date() })
    .where(eq(assessmentSessions.id, s.id));
  if (request.status === "em_andamento") {
    await db.update(assessmentRequests).set({ status: "pendente" }).where(eq(assessmentRequests.id, request.id));
  }
  await audit(db, {
    workspaceId: scope.workspace.id,
    actorType: "pessoa",
    actorId: scope.person.id,
    action: "avaliacao.interrompida",
    objectType: "assessment_session",
    objectId: s.id,
    metadata: { motivo: reason },
  });
}

/** Devolutiva publicada (versão vigente) e, se o profissional escolheu incluir, as medidas revisadas. */
export async function getPublishedFeedbackForPerson(db: Db, scope: PersonScope) {
  const [fb] = await db
    .select({ feedback: feedbacks, authorName: users.name })
    .from(feedbacks)
    .innerJoin(users, eq(users.id, feedbacks.authorId))
    .where(
      and(eq(feedbacks.requestId, scope.request.id), eq(feedbacks.workspaceId, scope.workspace.id), eq(feedbacks.status, "publicada"))
    )
    .orderBy(desc(feedbacks.version))
    .limit(1);
  if (!fb) return null;
  let reviewed: { label: string; side: string; unit: string; value: number; method: string }[] = [];
  if (fb.feedback.includeMeasurements) {
    const sessions = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.requestId, scope.request.id),
          eq(assessmentSessions.status, "concluida"),
          eq(assessmentSessions.reviewStatus, "revisado")
        )
      )
      .orderBy(desc(assessmentSessions.completedAt))
      .limit(1);
    const ms = await loadMeasurements(db, scope.workspace.id, sessions.map((s) => s.id));
    reviewed = (sessions[0] ? ms.get(sessions[0].id) ?? [] : []).flatMap((m) => {
      const v = effectiveValue({
        value: m.value,
        quality: m.quality,
        reviewDecision: m.review?.decision ?? null,
        correctedValue: m.review?.correctedValue ?? null,
      });
      return v === null || !m.review ? [] : [{ label: m.label, side: m.side, unit: m.unit, value: v, method: m.method }];
    });
  }
  await audit(db, {
    workspaceId: scope.workspace.id,
    actorType: "pessoa",
    actorId: scope.person.id,
    action: "devolutiva.visualizada",
    objectType: "feedback",
    objectId: fb.feedback.id,
  });
  return { ...fb, reviewed };
}

export async function revokePersonSession(db: Db, token: string) {
  await db.update(personSessions).set({ revokedAt: new Date() }).where(eq(personSessions.tokenHash, sha256(token)));
}

