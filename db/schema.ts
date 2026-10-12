/**
 * Modelo de dados da plataforma Moveo (PostgreSQL via Drizzle).
 *
 * Regras de integridade que este arquivo garante no próprio banco (além
 * da autorização no servidor, ver lib/server/authz.ts):
 * - Todo registro de atendimento carrega `workspace_id`.
 * - Referências a pessoa/solicitação/sessão usam chave estrangeira
 *   COMPOSTA (workspace_id, id), então é impossível ligar um registro a
 *   um objeto de outro espaço, mesmo que o servidor erre.
 * - Tokens (sessão, convite, código de confirmação) são guardados apenas
 *   como hash SHA-256; o valor em si nunca é persistido.
 * - Revisões, correções e devolutivas são acréscimos (append-only): o
 *   resultado original nunca é sobrescrito.
 *
 * Nomes de coluna em snake_case no banco; propriedades em camelCase no TS.
 */
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const professionEnum = pgEnum("profession", ["fisioterapia", "educacao_fisica"]);
export const verificationStatusEnum = pgEnum("verification_status", ["pendente", "verificado", "recusado"]);
export const workspaceKindEnum = pgEnum("workspace_kind", ["autonomo", "clinica", "estudio", "academia"]);
/** demonstracao: só dados fictícios; real: atendimento de pessoas reais (exige verificação e liberação por recurso). */
export const workspaceEnvEnum = pgEnum("workspace_environment", ["demonstracao", "real"]);
export const memberRoleEnum = pgEnum("member_role", ["gestor", "profissional", "assistente"]);
export const memberStatusEnum = pgEnum("member_status", ["ativo", "removido"]);
export const contactChannelEnum = pgEnum("contact_channel", ["email", "sms", "whatsapp"]);
export const careModalityEnum = pgEnum("care_modality", ["presencial", "remoto", "hibrido"]);
export const episodeStatusEnum = pgEnum("episode_status", ["ativo", "encerrado"]);
export const consentDecisionEnum = pgEnum("consent_decision", ["aceito", "recusado", "revogado"]);
export const supervisionEnum = pgEnum("supervision", ["sem_supervisao", "sessao_ao_vivo"]);
export const requestStatusEnum = pgEnum("assessment_request_status", [
  "pendente",
  "em_andamento",
  "aguardando_revisao",
  "revisada",
  "cancelada",
]);
export const sessionStatusEnum = pgEnum("assessment_session_status", ["iniciada", "concluida", "interrompida"]);
export const sessionReviewEnum = pgEnum("assessment_session_review", ["provisorio", "revisado"]);
/** De onde veio o dado — sempre visível na interface e nos relatórios. */
export const originEnum = pgEnum("measurement_origin", ["camera", "manual_profissional", "demonstracao"]);
export const qualityEnum = pgEnum("capture_quality", ["apta", "insuficiente"]);
export const measurementDecisionEnum = pgEnum("measurement_decision", ["aceita", "corrigida", "descartada"]);
export const feedbackStatusEnum = pgEnum("feedback_status", ["publicada", "substituida"]);
export const releaseStateEnum = pgEnum("release_state", [
  "desenvolvimento",
  "demonstracao",
  "em_validacao",
  "liberado",
  "suspenso",
]);
export const tokenPurposeEnum = pgEnum("token_purpose", ["verificar_email", "redefinir_senha"]);
export const actorTypeEnum = pgEnum("actor_type", ["usuario", "pessoa", "sistema"]);

// ---------------------------------------------------------------------------
// Identidade e acesso
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // sempre minúsculo (normalizado no servidor)
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  emailVerifiedAt: ts("email_verified_at"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  disabledAt: ts("disabled_at"),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: ts("locked_until"),
  /** Tutorial de boas-vindas do painel concluído ou pulado (nulo = abre sozinho na próxima visita). */
  tutorialSeenAt: ts("tutorial_seen_at"),
  createdAt: createdAt(),
});

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index("user_sessions_user_idx").on(t.userId)]
);

export const userTokens = pgTable("user_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  purpose: tokenPurposeEnum("purpose").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: createdAt(),
});

/**
 * Perfil e habilitação profissional. Número de conselho informado pelo
 * usuário NÃO é verificação: começa como "pendente" e só muda por
 * conferência manual registrada (fonte, data e responsável).
 */
export const professionalProfiles = pgTable("professional_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  profession: professionEnum("profession").notNull(),
  council: text("council").notNull(), // "CREFITO" | "CREF"
  councilRegion: text("council_region").notNull(), // ex.: "3" (CREFITO-3), "4/SP"
  registrationNumber: text("registration_number").notNull(),
  jurisdictionUf: text("jurisdiction_uf").notNull(),
  verificationStatus: verificationStatusEnum("verification_status").notNull().default("pendente"),
  verificationSource: text("verification_source"),
  verificationNote: text("verification_note"),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: ts("verified_at"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Espaços de atendimento e equipe
// ---------------------------------------------------------------------------

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: workspaceKindEnum("kind").notNull(),
  environment: workspaceEnvEnum("environment").notNull().default("demonstracao"),
  brandColor: text("brand_color").notNull().default("#128C90"),
  logoUrl: text("logo_url"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: memberRoleEnum("role").notNull(),
    status: memberStatusEnum("status").notNull().default("ativo"),
    createdAt: createdAt(),
  },
  (t) => [unique("memberships_ws_user_uq").on(t.workspaceId, t.userId)]
);

// ---------------------------------------------------------------------------
// Pessoas atendidas, vínculos e episódios
// ---------------------------------------------------------------------------

/**
 * Pessoa atendida DENTRO de um espaço. A mesma pessoa em duas clínicas
 * são dois registros independentes — não há deduplicação entre espaços
 * (evita revelar que alguém já é atendido em outro lugar).
 */
export const persons = pgTable(
  "persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    preferredChannel: contactChannelEnum("preferred_channel").notNull().default("email"),
    city: text("city"),
    uf: text("uf"),
    /** true em espaços de demonstração — a interface identifica o registro como fictício. */
    isFictitious: boolean("is_fictitious").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    archivedAt: ts("archived_at"),
  },
  (t) => [unique("persons_ws_id_uq").on(t.workspaceId, t.id), index("persons_ws_idx").on(t.workspaceId)]
);

/** Vínculo explícito profissional ↔ pessoa. Sem vínculo ativo, não há acesso clínico. */
export const careRelationships = pgTable(
  "care_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    personId: uuid("person_id").notNull(),
    professionalUserId: uuid("professional_user_id")
      .notNull()
      .references(() => users.id),
    startedAt: createdAt(),
    endedAt: ts("ended_at"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
  },
  (t) => [
    foreignKey({ columns: [t.workspaceId, t.personId], foreignColumns: [persons.workspaceId, persons.id] }),
    index("care_rel_person_idx").on(t.personId),
  ]
);

export const careEpisodes = pgTable(
  "care_episodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    personId: uuid("person_id").notNull(),
    title: text("title").notNull(), // objetivo ou motivo do acompanhamento
    modality: careModalityEnum("modality").notNull(),
    /** Decisão do profissional sobre a adequação do acompanhamento remoto (COFFITO 619/2025, CONFEF 542/2024). */
    remoteSuitabilityNote: text("remote_suitability_note"),
    status: episodeStatusEnum("status").notNull().default("ativo"),
    openedBy: uuid("opened_by")
      .notNull()
      .references(() => users.id),
    openedAt: createdAt(),
    closedAt: ts("closed_at"),
  },
  (t) => [
    unique("episodes_ws_id_uq").on(t.workspaceId, t.id),
    foreignKey({ columns: [t.workspaceId, t.personId], foreignColumns: [persons.workspaceId, persons.id] }),
  ]
);

// ---------------------------------------------------------------------------
// Consentimentos
// ---------------------------------------------------------------------------

/** Texto versionado. Conteúdo é minuta pendente de revisão jurídica até que alguém registre o contrário. */
export const consentDocuments = pgTable(
  "consent_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(), // "teleatendimento" | "uso_camera" | "guarda_video"
    version: text("version").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    required: boolean("required").notNull(),
    legalReviewStatus: text("legal_review_status").notNull().default("pendente_revisao_juridica"),
    createdAt: createdAt(),
  },
  (t) => [unique("consent_doc_key_version_uq").on(t.key, t.version)]
);

export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    personId: uuid("person_id").notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => consentDocuments.id),
    decision: consentDecisionEnum("decision").notNull(),
    /** Nome digitado por quem aceitou (a própria pessoa; representação legal está fora do escopo liberado). */
    signerName: text("signer_name").notNull(),
    invitationId: uuid("invitation_id"),
    recordedAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.workspaceId, t.personId], foreignColumns: [persons.workspaceId, persons.id] }),
    index("consent_person_idx").on(t.personId),
  ]
);

// ---------------------------------------------------------------------------
// Avaliação: solicitação → convite → sessão → medidas → revisão → devolutiva
// ---------------------------------------------------------------------------

export const assessmentRequests = pgTable(
  "assessment_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    personId: uuid("person_id").notNull(),
    episodeId: uuid("episode_id"),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id),
    protocolId: text("protocol_id").notNull(),
    protocolVersion: text("protocol_version").notNull(),
    /** Movimentos pedidos (ids de lib/care/protocols.ts PROTOCOL_ITEMS). null = protocolo completo. */
    selectedItems: jsonb("selected_items").$type<string[] | null>(),
    instructions: text("instructions"),
    supervision: supervisionEnum("supervision").notNull().default("sem_supervisao"),
    dueAt: ts("due_at"),
    status: requestStatusEnum("status").notNull().default("pendente"),
    /** Reavaliação: aponta para a solicitação anterior com o mesmo protocolo. */
    previousRequestId: uuid("previous_request_id"),
    createdAt: createdAt(),
    cancelledAt: ts("cancelled_at"),
  },
  (t) => [
    unique("requests_ws_id_uq").on(t.workspaceId, t.id),
    foreignKey({ columns: [t.workspaceId, t.personId], foreignColumns: [persons.workspaceId, persons.id] }),
    foreignKey({
      columns: [t.workspaceId, t.episodeId],
      foreignColumns: [careEpisodes.workspaceId, careEpisodes.id],
    }),
    index("requests_person_idx").on(t.personId),
  ]
);

/**
 * Convite individual. O token só existe no link entregue ao profissional
 * (mostrado uma vez); aqui fica apenas o hash. O acesso ainda exige um
 * código de confirmação enviado ao contato cadastrado da pessoa.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    personId: uuid("person_id").notNull(),
    assessmentRequestId: uuid("assessment_request_id").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    channel: contactChannelEnum("channel").notNull(),
    expiresAt: ts("expires_at").notNull(),
    accessedAt: ts("accessed_at"),
    confirmedAt: ts("confirmed_at"),
    revokedAt: ts("revoked_at"),
    revokedBy: uuid("revoked_by").references(() => users.id),
    codeHash: text("code_hash"),
    codeExpiresAt: ts("code_expires_at"),
    codeAttempts: integer("code_attempts").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.workspaceId, t.personId], foreignColumns: [persons.workspaceId, persons.id] }),
    foreignKey({
      columns: [t.workspaceId, t.assessmentRequestId],
      foreignColumns: [assessmentRequests.workspaceId, assessmentRequests.id],
    }),
  ]
);

/** Sessão da pessoa atendida, com escopo restrito à solicitação do convite. */
export const personSessions = pgTable("person_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  workspaceId: uuid("workspace_id").notNull(),
  personId: uuid("person_id").notNull(),
  invitationId: uuid("invitation_id")
    .notNull()
    .references(() => invitations.id),
  expiresAt: ts("expires_at").notNull(),
  revokedAt: ts("revoked_at"),
  createdAt: createdAt(),
});

export const assessmentSessions = pgTable(
  "assessment_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    requestId: uuid("request_id").notNull(),
    personId: uuid("person_id").notNull(),
    /** Chave enviada pelo navegador: reenviar após falha não duplica a sessão. */
    idempotencyKey: text("idempotency_key").notNull(),
    status: sessionStatusEnum("status").notNull().default("iniciada"),
    reviewStatus: sessionReviewEnum("review_status").notNull().default("provisorio"),
    origin: originEnum("origin").notNull(),
    protocolId: text("protocol_id").notNull(),
    protocolVersion: text("protocol_version").notNull(),
    appVersion: text("app_version").notNull(),
    algorithmVersion: text("algorithm_version"),
    modelId: text("model_id"),
    runtimeVersion: text("runtime_version"),
    /** Contexto informado pela pessoa (dor, lado, tempo de queixa, respostas de segurança). */
    reportedContext: jsonb("reported_context"),
    /** Resumo estruturado do módulo (sem quadros nem pontos do corpo). */
    moduleSummary: jsonb("module_summary"),
    device: jsonb("device"),
    interruptionReason: text("interruption_reason"),
    recordedBy: uuid("recorded_by").references(() => users.id), // preenchido em medição presencial
    startedAt: createdAt(),
    completedAt: ts("completed_at"),
    reviewedAt: ts("reviewed_at"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
  },
  (t) => [
    unique("sessions_ws_id_uq").on(t.workspaceId, t.id),
    uniqueIndex("sessions_idem_uq").on(t.requestId, t.idempotencyKey),
    foreignKey({
      columns: [t.workspaceId, t.requestId],
      foreignColumns: [assessmentRequests.workspaceId, assessmentRequests.id],
    }),
    foreignKey({ columns: [t.workspaceId, t.personId], foreignColumns: [persons.workspaceId, persons.id] }),
  ]
);

/**
 * Contrato mínimo de resultado: cada linha é UMA grandeza de UM movimento
 * de UM lado, com método, unidade, qualidade e versões herdadas da sessão.
 * value = null sempre que a captura não sustenta um número (nunca 0).
 */
export const measurements = pgTable(
  "measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    metricKey: text("metric_key").notNull(), // ex.: "ombro.flexao.elevacao_media"
    movement: text("movement").notNull(),
    side: text("side").notNull(), // "direito" | "esquerdo" | "bilateral" | "nao_se_aplica"
    value: real("value"),
    unit: text("unit").notNull(),
    method: text("method").notNull(), // ex.: "camera_2d_mediapipe", "goniometro", "demonstracao"
    attemptsPlanned: integer("attempts_planned"),
    attemptsAnalyzed: integer("attempts_analyzed"),
    quality: qualityEnum("quality").notNull(),
    rejectionReason: text("rejection_reason"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.workspaceId, t.sessionId],
      foreignColumns: [assessmentSessions.workspaceId, assessmentSessions.id],
    }),
    index("measurements_session_idx").on(t.sessionId),
  ]
);

/** Decisão do profissional sobre uma medida. Append-only: a mais recente vale, o original permanece. */
export const measurementReviews = pgTable("measurement_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull(),
  measurementId: uuid("measurement_id")
    .notNull()
    .references(() => measurements.id),
  reviewerId: uuid("reviewer_id")
    .notNull()
    .references(() => users.id),
  decision: measurementDecisionEnum("decision").notNull(),
  correctedValue: real("corrected_value"),
  justification: text("justification"),
  createdAt: createdAt(),
});

/** Devolutiva (orientação publicada para a pessoa). Editar = nova versão; a anterior vira "substituida". */
export const feedbacks = pgTable(
  "feedbacks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    requestId: uuid("request_id").notNull(),
    personId: uuid("person_id").notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    version: integer("version").notNull(),
    body: text("body").notNull(),
    includeMeasurements: boolean("include_measurements").notNull().default(false),
    status: feedbackStatusEnum("status").notNull().default("publicada"),
    publishedAt: createdAt(),
  },
  (t) => [
    uniqueIndex("feedback_request_version_uq").on(t.requestId, t.version),
    foreignKey({
      columns: [t.workspaceId, t.requestId],
      foreignColumns: [assessmentRequests.workspaceId, assessmentRequests.id],
    }),
  ]
);

// ---------------------------------------------------------------------------
// Controle de liberação por recurso e versão (cap. 24.4)
// ---------------------------------------------------------------------------

/**
 * Registro de DECISÃO HUMANA sobre um recurso numa versão. O sistema só
 * registra evidência e decisão — não emite aprovação regulatória. Sem
 * registro, o estado é "desenvolvimento".
 */
export const featureReleases = pgTable("feature_releases", {
  id: uuid("id").primaryKey().defaultRandom(),
  featureKey: text("feature_key").notNull(),
  algorithmVersion: text("algorithm_version").notNull(),
  protocolVersion: text("protocol_version").notNull(),
  /** Modelo de rastreamento + runtime (lib/pose/modelInfo.ts). Trocar o modelo exige nova decisão. */
  modelVersion: text("model_version").notNull().default(""),
  state: releaseStateEnum("state").notNull(),
  scope: text("scope").notNull(), // público, indicação e restrições
  evidence: text("evidence").notNull(), // referências às evidências conferidas
  decidedBy: uuid("decided_by")
    .notNull()
    .references(() => users.id),
  decidedAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Operação
// ---------------------------------------------------------------------------

/** Rastreabilidade. `metadata` nunca leva conteúdo clínico (só ids, estados e versões). */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id"),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    objectType: text("object_type"),
    objectId: uuid("object_id"),
    metadata: jsonb("metadata"),
    at: createdAt(),
  },
  (t) => [index("audit_ws_idx").on(t.workspaceId), index("audit_at_idx").on(t.at)]
);

/**
 * Caixa de saída de mensagens. Em desenvolvimento nada é enviado de
 * verdade: as mensagens ficam aqui e podem ser lidas em /dev/caixa-de-saida.
 * O conteúdo nunca inclui dados clínicos — só links e códigos.
 */
export const outboxMessages = pgTable("outbox_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: contactChannelEnum("channel").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: createdAt(),
});
