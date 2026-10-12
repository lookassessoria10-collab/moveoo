/**
 * Administração da plataforma: verificação profissional, decisões de
 * liberação por recurso/versão, espaços e trilha de auditoria. Só contas
 * com `is_platform_admin`. Nada aqui expõe conteúdo clínico.
 */
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { auditEvents, featureReleases, memberships, professionalProfiles, users, workspaces } from "@/db/schema";
import { CAMERA_PROTOCOLS } from "@/lib/care/protocols";
import { forbidden, invalid } from "../errors";
import { audit, FEATURES, getReleaseState, RELEASE_MODEL_VERSION } from "./core";

async function requireAdmin(db: Db, userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u?.isPlatformAdmin || u.disabledAt) throw forbidden("Área restrita à administração da plataforma.");
  return u;
}

export async function listProfessionals(db: Db, adminId: string) {
  await requireAdmin(db, adminId);
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerifiedAt,
      profile: professionalProfiles,
    })
    .from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId))
    .orderBy(sql`case ${professionalProfiles.verificationStatus} when 'pendente' then 0 else 1 end`, desc(professionalProfiles.createdAt));
}

export const verificationSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["verificado", "recusado", "pendente"]),
  source: z.string().trim().min(5, "Informe a fonte consultada (ex.: consulta pública do conselho, documento recebido).").max(300),
  note: z.string().trim().max(1000).optional(),
});

/** Conferência MANUAL registrada (fonte, data, responsável). Não há integração automática com conselhos. */
export async function decideVerification(db: Db, adminId: string, input: z.input<typeof verificationSchema>) {
  await requireAdmin(db, adminId);
  const data = verificationSchema.parse(input);
  await db
    .update(professionalProfiles)
    .set({
      verificationStatus: data.status,
      verificationSource: data.source,
      verificationNote: data.note || null,
      verifiedBy: adminId,
      verifiedAt: new Date(),
    })
    .where(eq(professionalProfiles.userId, data.userId));
  await audit(db, {
    actorType: "usuario",
    actorId: adminId,
    action: "verificacao.decidida",
    objectType: "user",
    objectId: data.userId,
    metadata: { estado: data.status },
  });
}

export async function listReleaseOverview(db: Db, adminId: string) {
  await requireAdmin(db, adminId);
  const current = [];
  for (const p of CAMERA_PROTOCOLS) {
    const versions = { algorithmVersion: p.algorithmVersion!, protocolVersion: p.version };
    const { state } = await getReleaseState(db, p.featureKey!, versions);
    current.push({ protocol: p, featureKey: p.featureKey!, ...versions, state });
  }
  const history = await db
    .select({ release: featureReleases, decidedByName: users.name })
    .from(featureReleases)
    .innerJoin(users, eq(users.id, featureReleases.decidedBy))
    .orderBy(desc(featureReleases.decidedAt))
    .limit(100);
  return { current, history, modelVersion: RELEASE_MODEL_VERSION };
}

export const releaseSchema = z.object({
  featureKey: z.string().refine((k) => k in FEATURES, "Recurso desconhecido."),
  algorithmVersion: z.string().min(1).max(60),
  protocolVersion: z.string().min(1).max(20),
  state: z.enum(["desenvolvimento", "demonstracao", "em_validacao", "liberado", "suspenso"]),
  scope: z.string().trim().min(10, "Descreva público, indicação e restrições.").max(2000),
  evidence: z.string().trim().min(10, "Referencie as evidências conferidas.").max(4000),
});

/**
 * Registra uma DECISÃO HUMANA. O sistema não aprova nada sozinho:
 * "liberado" só deve ser registrado com evidência e parecer conferidos
 * (docs/regulatorio/criterios-de-liberacao.md).
 */
export async function recordReleaseDecision(db: Db, adminId: string, input: z.input<typeof releaseSchema>) {
  await requireAdmin(db, adminId);
  const data = releaseSchema.parse(input);
  const protocol = CAMERA_PROTOCOLS.find((p) => p.featureKey === data.featureKey);
  if (!protocol) throw invalid("Recurso sem protocolo correspondente.");
  // A decisão vale para o modelo e runtime em uso agora (registrados junto).
  const [row] = await db
    .insert(featureReleases)
    .values({ ...data, modelVersion: RELEASE_MODEL_VERSION, decidedBy: adminId })
    .returning();
  await audit(db, {
    actorType: "usuario",
    actorId: adminId,
    action: "liberacao.decisao_registrada",
    objectType: "feature_release",
    objectId: row.id,
    metadata: { recurso: data.featureKey, estado: data.state, algoritmo: data.algorithmVersion, protocolo: data.protocolVersion, modelo: RELEASE_MODEL_VERSION },
  });
  return row;
}

export async function listWorkspacesForAdmin(db: Db, adminId: string) {
  await requireAdmin(db, adminId);
  return db
    .select({
      workspace: workspaces,
      members: sql<number>`(select count(*) from ${memberships} m where m.workspace_id = ${workspaces.id} and m.status = 'ativo')`.mapWith(Number),
    })
    .from(workspaces)
    .orderBy(desc(workspaces.createdAt));
}

export async function listAuditEvents(db: Db, adminId: string, limit = 200) {
  await requireAdmin(db, adminId);
  return db.select().from(auditEvents).orderBy(desc(auditEvents.at)).limit(limit);
}
