/**
 * Serviços transversais: auditoria, caixa de saída, documentos de
 * consentimento e controle de liberação por recurso e versão.
 */
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { auditEvents, consentDocuments, featureReleases, outboxMessages, workspaces } from "@/db/schema";
import { releaseBlocked } from "../errors";
import { isLocalMode } from "../environment";
import { getProtocol } from "@/lib/care/protocols";
import { POSE_MODEL_ID, POSE_RUNTIME_LABEL } from "@/lib/pose/modelInfo";

/** Modelo + runtime em uso. Faz parte da chave de liberação: trocar o modelo volta o recurso a "desenvolvimento". */
export const RELEASE_MODEL_VERSION = `${POSE_MODEL_ID} | ${POSE_RUNTIME_LABEL}`;

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

export interface AuditInput {
  workspaceId?: string | null;
  actorType: "usuario" | "pessoa" | "sistema";
  actorId?: string | null;
  action: string;
  objectType?: string;
  objectId?: string | null;
  /** Só ids, estados e versões — nunca texto clínico. */
  metadata?: Record<string, string | number | boolean | null>;
}

export async function audit(db: Db, e: AuditInput): Promise<void> {
  await db.insert(auditEvents).values({
    workspaceId: e.workspaceId ?? null,
    actorType: e.actorType,
    actorId: e.actorId ?? null,
    action: e.action,
    objectType: e.objectType ?? null,
    objectId: e.objectId ?? null,
    metadata: e.metadata ?? null,
  });
}

// ---------------------------------------------------------------------------
// Caixa de saída (e-mail/SMS). Em desenvolvimento nada sai da máquina.
// ---------------------------------------------------------------------------

export async function sendMessage(
  db: Db,
  m: { channel: "email" | "sms" | "whatsapp"; recipient: string; subject: string; body: string }
): Promise<void> {
  // Links e códigos são segredos. Em texto aberto só na hospedagem local (onde
  // /dev/caixa-de-saida substitui o provedor — ver lib/server/environment.ts);
  // fora dela, ficam mascarados até existir um provedor que entregue sem persistir.
  const body = isLocalMode() ? m.body : redactSecrets(m.body);
  await db.insert(outboxMessages).values({ ...m, body });
}

export function redactSecrets(text: string): string {
  return text.replace(/https?:\/\/\S+/g, "[link omitido]").replace(/\b\d{6}\b/g, "[código omitido]");
}

export function maskContact(value: string): string {
  if (value.includes("@")) {
    const [user, domain] = value.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  return `(**) *****-${digits.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Documentos de consentimento (minutas versionadas)
// ---------------------------------------------------------------------------

export const CONSENT_DOCS = [
  {
    key: "teleatendimento",
    version: "2026-10-minuta-1",
    required: true,
    title: "Acompanhamento a distância",
    body: [
      "MINUTA PENDENTE DE REVISÃO JURÍDICA — não usar com pessoas reais antes da revisão.",
      "",
      "Você está sendo acompanhado(a) a distância pelo profissional que enviou este convite. As atividades indicadas aqui foram definidas por esse profissional, que é o responsável por revisá-las e orientar você.",
      "",
      "Os resultados enviados por você ficam disponíveis apenas para o profissional responsável e a equipe autorizada do espaço de atendimento. O profissional pode concluir que uma avaliação presencial é necessária.",
      "",
      "Esta ferramenta não realiza diagnóstico. Se sentir dor forte, falta de ar, tontura ou qualquer sintoma que preocupe, interrompa a atividade e procure atendimento.",
      "",
      "Você pode interromper qualquer atividade a qualquer momento e pedir ao profissional informações sobre seus dados.",
    ].join("\n"),
  },
  {
    key: "uso_camera",
    version: "2026-10-minuta-2",
    required: true,
    title: "Uso da câmera nesta atividade",
    body: [
      "MINUTA PENDENTE DE REVISÃO JURÍDICA — não usar com pessoas reais antes da revisão.",
      "",
      "Para esta atividade, a câmera do seu celular estima a posição de alguns pontos do corpo. Esse processamento acontece no próprio aparelho: o vídeo não é gravado nem enviado.",
      "",
      "São enviados ao profissional os números calculados (por exemplo, ângulos estimados), a qualidade da captura e as respostas que você der durante a atividade. Também são registradas informações técnicas do aparelho (tipo de navegador e resolução da câmera), usadas para conferir a medida — nunca imagens.",
      "",
      "A permissão de câmera que o navegador pede é uma autorização técnica e é diferente deste aceite. Você pode recusar e informar o profissional; ele poderá indicar outra forma de avaliação.",
    ].join("\n"),
  },
] as const;

export async function ensureConsentDocuments(db: Db): Promise<void> {
  for (const d of CONSENT_DOCS) {
    await db
      .insert(consentDocuments)
      .values({ key: d.key, version: d.version, title: d.title, body: d.body, required: d.required })
      .onConflictDoNothing();
  }
}

export async function currentConsentDocument(db: Db, key: string) {
  const def = CONSENT_DOCS.find((d) => d.key === key);
  if (!def) return null;
  await ensureConsentDocuments(db);
  const [doc] = await db
    .select()
    .from(consentDocuments)
    .where(and(eq(consentDocuments.key, key), eq(consentDocuments.version, def.version)));
  return doc ?? null;
}

// ---------------------------------------------------------------------------
// Controle de liberação (cap. 24.4)
// ---------------------------------------------------------------------------

export type ReleaseState = "desenvolvimento" | "demonstracao" | "em_validacao" | "liberado" | "suspenso";

export const FEATURES: Record<string, { label: string; kind: "mensuracao" | "administrativa" }> = {
  mensuracao_camera_ombro: { label: "Mensuração por câmera — ombro", kind: "mensuracao" },
  mensuracao_camera_joelho: { label: "Mensuração por câmera — joelho", kind: "mensuracao" },
  mensuracao_camera_coluna: { label: "Mensuração por câmera — tronco", kind: "mensuracao" },
  observacao_camera_postura: { label: "Observação por câmera — postura sentada", kind: "mensuracao" },
};

export const RELEASE_STATE_LABEL: Record<ReleaseState, string> = {
  desenvolvimento: "Em desenvolvimento",
  demonstracao: "Somente demonstração",
  em_validacao: "Em validação",
  liberado: "Liberado para escopo específico",
  suspenso: "Suspenso",
};

export async function getReleaseState(
  db: Db,
  featureKey: string,
  versions: { algorithmVersion: string; protocolVersion: string }
): Promise<{ state: ReleaseState; decisionId: string | null }> {
  const [row] = await db
    .select()
    .from(featureReleases)
    .where(
      and(
        eq(featureReleases.featureKey, featureKey),
        eq(featureReleases.algorithmVersion, versions.algorithmVersion),
        eq(featureReleases.protocolVersion, versions.protocolVersion),
        eq(featureReleases.modelVersion, RELEASE_MODEL_VERSION)
      )
    )
    .orderBy(desc(featureReleases.decidedAt))
    .limit(1);
  return row ? { state: row.state, decisionId: row.id } : { state: "desenvolvimento", decisionId: null };
}

/**
 * Bloqueia execução de função de mensuração conforme o ambiente:
 * - suspenso: bloqueado em qualquer ambiente (histórico continua consultável);
 * - espaço real: só "liberado" para exatamente estas versões;
 * - espaço de demonstração: permitido (dados fictícios).
 * Assinatura/plano não interfere nesta decisão.
 */
export async function assertProtocolExecutable(
  db: Db,
  workspace: { environment: "demonstracao" | "real" },
  protocolId: string
): Promise<void> {
  const protocol = getProtocol(protocolId);
  if (!protocol) throw releaseBlocked("Protocolo desconhecido.");
  if (!protocol.featureKey || !protocol.algorithmVersion) return; // função administrativa
  const { state } = await getReleaseState(db, protocol.featureKey, {
    algorithmVersion: protocol.algorithmVersion,
    protocolVersion: protocol.version,
  });
  if (state === "suspenso") {
    throw releaseBlocked(`"${protocol.shortTitle}" está suspenso. Novas execuções estão bloqueadas.`);
  }
  if (workspace.environment === "real" && state !== "liberado") {
    throw releaseBlocked(
      `"${protocol.shortTitle}" ainda não está liberado para atendimento real nesta versão (estado: ${RELEASE_STATE_LABEL[state]}). Use um espaço de demonstração.`
    );
  }
}

export async function getWorkspace(db: Db, id: string) {
  const [w] = await db.select().from(workspaces).where(eq(workspaces.id, id));
  return w ?? null;
}
