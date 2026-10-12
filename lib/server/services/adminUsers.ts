/**
 * Gestão de usuários pela administração da plataforma.
 *
 * - Lista com busca e filtros, ficha, edição da conta e do registro
 *   profissional, destravar acesso e confirmar e-mail manualmente.
 * - Desativar: sem acesso, histórico preservado, reativável. Excluir
 *   DEFINITIVAMENTE só contas sem registros de atendimento — quem já
 *   cadastrou pessoas, solicitou ou revisou avaliações só pode ser
 *   desativado (guarda de prontuário).
 * - Etiquetas e anotações internas, números da base e exportação (CSV).
 *
 * Só contas com `is_platform_admin`. Nada aqui lê conteúdo clínico, só
 * contagens. Toda alteração vai para a trilha de auditoria, sem nome,
 * e-mail ou texto livre na metadata.
 *
 * Subconsultas usam nomes de tabela/coluna escritos no SQL (não objetos
 * do Drizzle): em consultas de uma tabela só, o Drizzle tira o nome da
 * tabela das colunas da seleção, o que trocaria a coluna de fora pela de
 * dentro sem erro.
 */
import { and, asc, desc, eq, gt, gte, ilike, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Db } from "@/db/client";
import {
  auditEvents,
  memberships,
  outboxMessages,
  professionalProfiles,
  userAdminNotes,
  userAdminTags,
  userSessions,
  userTokens,
  users,
  workspaces,
} from "@/db/schema";
import { COUNCIL_FOR, PROFESSION_LABEL, UFS } from "@/lib/care/vocabulary";
import { VERIFICATION_LABEL, formatDate } from "@/lib/care/labels";
import { conflict, forbidden, invalid, notFound } from "../errors";
import { audit } from "./core";
import { assertPlatformAdmin } from "./admin";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

// ---------------------------------------------------------------------------
// Filtros da lista (vêm da URL)
// ---------------------------------------------------------------------------

const FILTERS = {
  q: z.string().trim().min(1).max(120),
  profissao: z.enum(["fisioterapia", "educacao_fisica", "sem_perfil"]),
  uf: z.enum(UFS),
  verificacao: z.enum(["pendente", "verificado", "recusado"]),
  situacao: z.enum(["ativa", "desativada", "travada", "email_nao_confirmado", "administracao"]),
  etiqueta: z.string().trim().min(1).max(40),
  periodo: z.enum(["7", "30", "90"]),
  ordem: z.enum(["recentes", "nome", "acesso"]),
  pagina: z.coerce.number().int().min(1).max(10_000),
};

export type UserFilters = { [K in keyof typeof FILTERS]?: z.output<(typeof FILTERS)[K]> };

/** Lê os filtros da URL. Valor inválido é ignorado — a página nunca quebra por causa de um link editado. */
export function parseUserFilters(params: Record<string, string | string[] | undefined>): UserFilters {
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(FILTERS)) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === undefined || value === "") continue;
    const parsed = schema.safeParse(value);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as UserFilters;
}

function filterConditions(f: UserFilters): SQL | undefined {
  const c: (SQL | undefined)[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    c.push(or(ilike(users.name, like), ilike(users.email, like), ilike(professionalProfiles.registrationNumber, like)));
  }
  if (f.profissao === "sem_perfil") c.push(isNull(professionalProfiles.userId));
  else if (f.profissao) c.push(eq(professionalProfiles.profession, f.profissao));
  if (f.uf) c.push(eq(professionalProfiles.jurisdictionUf, f.uf));
  if (f.verificacao) c.push(eq(professionalProfiles.verificationStatus, f.verificacao));
  if (f.situacao === "ativa") c.push(isNull(users.disabledAt));
  if (f.situacao === "desativada") c.push(isNotNull(users.disabledAt));
  if (f.situacao === "travada") c.push(gt(users.lockedUntil, new Date()));
  if (f.situacao === "email_nao_confirmado") c.push(isNull(users.emailVerifiedAt));
  if (f.situacao === "administracao") c.push(eq(users.isPlatformAdmin, true));
  if (f.etiqueta) c.push(sql`exists (select 1 from user_admin_tags t where t.user_id = "users"."id" and t.tag = ${f.etiqueta})`);
  if (f.periodo) c.push(gte(users.createdAt, daysAgo(Number(f.periodo))));
  return and(...c);
}

const toDate = (v: unknown) => (v ? new Date(v as string) : null);

const LAST_LOGIN = sql`(select max(s.created_at) from user_sessions s where s.user_id = "users"."id")`;

const listSelection = {
  id: users.id,
  name: users.name,
  email: users.email,
  emailVerifiedAt: users.emailVerifiedAt,
  isPlatformAdmin: users.isPlatformAdmin,
  disabledAt: users.disabledAt,
  lockedUntil: users.lockedUntil,
  createdAt: users.createdAt,
  profession: professionalProfiles.profession,
  council: professionalProfiles.council,
  councilRegion: professionalProfiles.councilRegion,
  registrationNumber: professionalProfiles.registrationNumber,
  jurisdictionUf: professionalProfiles.jurisdictionUf,
  verificationStatus: professionalProfiles.verificationStatus,
  lastLoginAt: sql<Date | null>`${LAST_LOGIN}`.mapWith(toDate),
  workspaces: sql<number>`(select count(*) from memberships m where m.user_id = "users"."id" and m.status = 'ativo')`.mapWith(Number),
  realWorkspaces: sql<number>`(select count(*) from memberships m join workspaces w on w.id = m.workspace_id
    where m.user_id = "users"."id" and m.status = 'ativo' and w.environment = 'real')`.mapWith(Number),
  persons: sql<number>`(select count(*) from persons p where p.created_by = "users"."id")`.mapWith(Number),
  requests: sql<number>`(select count(*) from assessment_requests r where r.requested_by = "users"."id")`.mapWith(Number),
  // Etiquetas não têm vírgula (ver normalizeTag), então a vírgula separa sem ambiguidade.
  tags: sql<string[]>`coalesce((select string_agg(t.tag, ',' order by t.tag) from user_admin_tags t where t.user_id = "users"."id"), '')`.mapWith(
    (v: string) => (v ? v.split(",") : [])
  ),
};

export const PAGE_SIZE = 50;

export async function listUsers(db: Db, adminId: string, f: UserFilters, opts: { all?: boolean } = {}) {
  await assertPlatformAdmin(db, adminId);
  const where = filterConditions(f);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .leftJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(where);
  const order =
    f.ordem === "nome"
      ? [asc(users.name)]
      : f.ordem === "acesso"
        ? [sql`${LAST_LOGIN} desc nulls last`, desc(users.createdAt)]
        : [desc(users.createdAt)];
  const page = f.pagina ?? 1;
  let query = db
    .select(listSelection)
    .from(users)
    .leftJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(where)
    .orderBy(...order)
    .$dynamic();
  if (!opts.all) query = query.limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE);
  return { rows: await query, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type UserListRow = Awaited<ReturnType<typeof listUsers>>["rows"][number];

export function accountSituation(u: { disabledAt: Date | null; lockedUntil: Date | null }): "desativada" | "travada" | "ativa" {
  if (u.disabledAt) return "desativada";
  if (u.lockedUntil && u.lockedUntil > new Date()) return "travada";
  return "ativa";
}

// ---------------------------------------------------------------------------
// Exportação (planilha)
// ---------------------------------------------------------------------------

/** Célula de CSV: aspas quando preciso e sem fórmulas (o Excel executaria "=..." ao abrir). */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const SITUATION_LABEL = { ativa: "Ativa", desativada: "Desativada", travada: "Travada (senha errada)" } as const;

/** Separador ";" e BOM: o Excel em português abre direto, com acentos. */
export function usersToCsv(rows: UserListRow[]): string {
  const header = [
    "Nome",
    "E-mail",
    "E-mail confirmado",
    "Profissão",
    "Conselho",
    "Região",
    "Número de registro",
    "UF",
    "Verificação",
    "Situação",
    "Administração",
    "Etiquetas",
    "Espaços ativos",
    "Espaços de atendimento real",
    "Pessoas cadastradas",
    "Avaliações solicitadas",
    "Cadastro",
    "Último acesso",
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      r.emailVerifiedAt ? "sim" : "não",
      r.profession ? PROFESSION_LABEL[r.profession] : "",
      r.council,
      r.councilRegion,
      r.registrationNumber,
      r.jurisdictionUf,
      r.verificationStatus ? VERIFICATION_LABEL[r.verificationStatus].label : "",
      SITUATION_LABEL[accountSituation(r)],
      r.isPlatformAdmin ? "sim" : "não",
      r.tags.join(", "),
      r.workspaces,
      r.realWorkspaces,
      r.persons,
      r.requests,
      formatDate(r.createdAt),
      r.lastLoginAt ? formatDate(r.lastLoginAt) : "",
    ]
      .map(csvCell)
      .join(";")
  );
  return `﻿${[header.join(";"), ...lines].join("\r\n")}\r\n`;
}

export async function exportUsersCsv(db: Db, adminId: string, f: UserFilters): Promise<string> {
  const { rows } = await listUsers(db, adminId, { ...f, pagina: undefined }, { all: true });
  await audit(db, {
    actorType: "usuario",
    actorId: adminId,
    action: "usuarios.exportados",
    metadata: { quantidade: rows.length, filtros: Object.keys(f).filter((k) => k !== "pagina").join(",") },
  });
  return usersToCsv(rows);
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

const uuid = z.string().uuid();

async function loadTarget(db: Db, userId: string) {
  if (!uuid.safeParse(userId).success) throw notFound("Usuário");
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw notFound("Usuário");
  return u;
}

const count = (query: SQL) => sql<number>`(${query})`.mapWith(Number);

/** Atividade da conta em números (nunca o conteúdo). */
async function activityOf(db: Db, userId: string) {
  const [a] = await db
    .select({
      persons: count(sql`select count(*) from persons p where p.created_by = ${userId}`),
      requests: count(sql`select count(*) from assessment_requests r where r.requested_by = ${userId}`),
      completed: count(sql`select count(*) from assessment_sessions s join assessment_requests r on r.id = s.request_id
        where r.requested_by = ${userId} and s.status = 'concluida' and s.origin <> 'manual_profissional'`),
      manual: count(sql`select count(*) from assessment_sessions s where s.recorded_by = ${userId}`),
      feedbacks: count(sql`select count(*) from feedbacks f where f.author_id = ${userId}`),
    })
    .from(users)
    .where(eq(users.id, userId));
  return a;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Motivos que impedem a exclusão definitiva. Vazio = a conta pode ser
 * excluída (não deixou nenhum registro de atendimento nem de decisão).
 */
export async function deletionBlockers(db: Db, userId: string): Promise<string[]> {
  const [c] = await db
    .select({
      admin: users.isPlatformAdmin,
      persons: count(sql`select count(*) from persons p where p.created_by = ${userId}`),
      relationships: count(sql`select count(*) from care_relationships c where c.professional_user_id = ${userId} or c.created_by = ${userId}`),
      episodes: count(sql`select count(*) from care_episodes e where e.opened_by = ${userId}`),
      requests: count(sql`select count(*) from assessment_requests r where r.requested_by = ${userId}`),
      invitations: count(sql`select count(*) from invitations i where i.created_by = ${userId} or i.revoked_by = ${userId}`),
      sessions: count(sql`select count(*) from assessment_sessions s where s.recorded_by = ${userId} or s.reviewed_by = ${userId}`),
      reviews: count(sql`select count(*) from measurement_reviews m where m.reviewer_id = ${userId}`),
      feedbacks: count(sql`select count(*) from feedbacks f where f.author_id = ${userId}`),
      releases: count(sql`select count(*) from feature_releases f where f.decided_by = ${userId}`),
      verifications: count(sql`select count(*) from professional_profiles p where p.verified_by = ${userId} and p.user_id <> ${userId}`),
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!c) return [];
  const shared = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.createdBy, userId),
        sql`(exists (select 1 from memberships m where m.workspace_id = "workspaces"."id" and m.user_id <> ${userId})
          or exists (select 1 from persons p where p.workspace_id = "workspaces"."id"))`
      )
    );

  const out: string[] = [];
  if (c.admin) out.push("Tem acesso de administração da plataforma — remova esse acesso antes.");
  if (c.persons) out.push(`Cadastrou ${plural(c.persons, "pessoa atendida", "pessoas atendidas")}.`);
  if (c.relationships) out.push(`Tem ${plural(c.relationships, "vínculo de atendimento", "vínculos de atendimento")}.`);
  if (c.episodes) out.push(`Abriu ${plural(c.episodes, "objetivo/episódio de acompanhamento", "objetivos/episódios de acompanhamento")}.`);
  if (c.requests) out.push(`Solicitou ${plural(c.requests, "avaliação", "avaliações")}.`);
  if (c.invitations) out.push(`Criou ou revogou ${plural(c.invitations, "convite", "convites")}.`);
  if (c.sessions) out.push(`Registrou ou revisou ${plural(c.sessions, "sessão de avaliação", "sessões de avaliação")}.`);
  if (c.reviews) out.push(`Revisou ${plural(c.reviews, "medida", "medidas")}.`);
  if (c.feedbacks) out.push(`Escreveu ${plural(c.feedbacks, "devolutiva", "devolutivas")}.`);
  if (c.releases) out.push(`Registrou ${plural(c.releases, "decisão de liberação", "decisões de liberação")}.`);
  if (c.verifications) out.push(`Conferiu o registro de ${plural(c.verifications, "profissional", "profissionais")}.`);
  for (const w of shared) out.push(`Criou o espaço “${w.name}”, que tem outros membros ou pessoas cadastradas.`);
  return out;
}

export async function getUserDetail(db: Db, adminId: string, userId: string) {
  await assertPlatformAdmin(db, adminId);
  const user = await loadTarget(db, userId);
  const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId));
  const [{ lastLoginAt }] = await db
    .select({ lastLoginAt: sql<Date | null>`max(${userSessions.createdAt})`.mapWith(toDate) })
    .from(userSessions)
    .where(eq(userSessions.userId, userId));
  const spaces = await db
    .select({ workspace: workspaces, role: memberships.role, status: memberships.status, since: memberships.createdAt })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(memberships.userId, userId))
    .orderBy(desc(memberships.createdAt));
  const tags = await db.select().from(userAdminTags).where(eq(userAdminTags.userId, userId)).orderBy(asc(userAdminTags.tag));
  const author = alias(users, "author");
  const notes = await db
    .select({ note: userAdminNotes, authorName: author.name })
    .from(userAdminNotes)
    .leftJoin(author, eq(author.id, userAdminNotes.authorId))
    .where(eq(userAdminNotes.userId, userId))
    .orderBy(desc(userAdminNotes.createdAt));
  const history = await db
    .select()
    .from(auditEvents)
    .where(or(eq(auditEvents.objectId, userId), eq(auditEvents.actorId, userId)))
    .orderBy(desc(auditEvents.at))
    .limit(25);
  return {
    user,
    profile: profile ?? null,
    lastLoginAt,
    spaces,
    activity: await activityOf(db, userId),
    tags,
    notes,
    history,
    blockers: await deletionBlockers(db, userId),
  };
}

// ---------------------------------------------------------------------------
// Alterações na conta
// ---------------------------------------------------------------------------

export const accountSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(200),
});

/** Nome e e-mail. Trocar o e-mail exige nova confirmação e invalida links já enviados ao endereço antigo. */
export async function updateAccount(db: Db, adminId: string, input: z.input<typeof accountSchema>) {
  await assertPlatformAdmin(db, adminId);
  const data = accountSchema.parse(input);
  const user = await loadTarget(db, data.userId);
  const changed: string[] = [];
  if (data.name !== user.name) changed.push("nome");
  const emailChanged = data.email !== user.email;
  if (emailChanged) {
    const [other] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, data.email), ne(users.id, user.id)));
    if (other) throw conflict("Já existe outra conta com este e-mail.");
    changed.push("email");
  }
  if (!changed.length) return { changed };
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ name: data.name, email: data.email, ...(emailChanged ? { emailVerifiedAt: null } : {}) })
      .where(eq(users.id, user.id));
    if (emailChanged) {
      await tx.update(userTokens).set({ usedAt: new Date() }).where(and(eq(userTokens.userId, user.id), isNull(userTokens.usedAt)));
    }
    await audit(tx as unknown as Db, {
      actorType: "usuario",
      actorId: adminId,
      action: "usuario.editado",
      objectType: "user",
      objectId: user.id,
      metadata: { campos: changed.join(",") },
    });
  });
  return { changed };
}

export const profileSchema = z.object({
  userId: z.string().uuid(),
  profession: z.enum(["fisioterapia", "educacao_fisica"]),
  councilRegion: z.string().trim().min(1, "Informe a região do conselho.").max(10),
  registrationNumber: z.string().trim().min(2, "Informe o número de registro.").max(30),
  jurisdictionUf: z.enum(UFS),
});

/**
 * Dados do registro profissional. Qualquer mudança volta a verificação
 * para "pendente": o que foi conferido antes era outro registro.
 */
export async function updateProfessionalProfile(db: Db, adminId: string, input: z.input<typeof profileSchema>) {
  await assertPlatformAdmin(db, adminId);
  const data = profileSchema.parse(input);
  const user = await loadTarget(db, data.userId);
  const values = {
    profession: data.profession,
    council: COUNCIL_FOR[data.profession],
    councilRegion: data.councilRegion,
    registrationNumber: data.registrationNumber,
    jurisdictionUf: data.jurisdictionUf,
  };
  const [current] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, user.id));
  if (!current) {
    await db.insert(professionalProfiles).values({ userId: user.id, ...values });
    await audit(db, { actorType: "usuario", actorId: adminId, action: "usuario.registro_criado", objectType: "user", objectId: user.id });
    return { changed: ["registro"], verificationReset: false };
  }
  const changed = (["profession", "councilRegion", "registrationNumber", "jurisdictionUf"] as const).filter((k) => current[k] !== values[k]);
  if (!changed.length) return { changed, verificationReset: false };
  const verificationReset = current.verificationStatus !== "pendente";
  await db
    .update(professionalProfiles)
    .set({
      ...values,
      ...(verificationReset
        ? {
            verificationStatus: "pendente" as const,
            verificationSource: null,
            verificationNote: "Dados do registro alterados pela administração — conferir de novo.",
            verifiedBy: null,
            verifiedAt: null,
          }
        : {}),
    })
    .where(eq(professionalProfiles.userId, user.id));
  await audit(db, {
    actorType: "usuario",
    actorId: adminId,
    action: "usuario.registro_editado",
    objectType: "user",
    objectId: user.id,
    metadata: { campos: changed.join(","), verificacao_reiniciada: verificationReset },
  });
  return { changed, verificationReset };
}

/** Sem provedor de e-mail ainda: a administração pode confirmar depois de conferir por outro meio. */
export async function confirmEmailManually(db: Db, adminId: string, userId: string) {
  await assertPlatformAdmin(db, adminId);
  const user = await loadTarget(db, userId);
  if (user.emailVerifiedAt) return;
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
  await db
    .update(userTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(userTokens.userId, user.id), eq(userTokens.purpose, "verificar_email"), isNull(userTokens.usedAt)));
  await audit(db, { actorType: "usuario", actorId: adminId, action: "usuario.email_confirmado_pela_administracao", objectType: "user", objectId: user.id });
}

/** Libera o acesso travado por tentativas de senha errada. */
export async function unlockUser(db: Db, adminId: string, userId: string) {
  await assertPlatformAdmin(db, adminId);
  const user = await loadTarget(db, userId);
  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
  await audit(db, { actorType: "usuario", actorId: adminId, action: "usuario.acesso_destravado", objectType: "user", objectId: user.id });
}

export async function setPlatformAdmin(db: Db, adminId: string, userId: string, makeAdmin: boolean) {
  await assertPlatformAdmin(db, adminId);
  const user = await loadTarget(db, userId);
  if (user.id === adminId) throw forbidden("Você não pode alterar o seu próprio acesso de administração.");
  if (user.isPlatformAdmin === makeAdmin) return;
  if (makeAdmin && user.disabledAt) throw invalid("Reative a conta antes de dar acesso de administração.");
  await db.update(users).set({ isPlatformAdmin: makeAdmin }).where(eq(users.id, user.id));
  await audit(db, {
    actorType: "usuario",
    actorId: adminId,
    action: makeAdmin ? "usuario.administracao_concedida" : "usuario.administracao_removida",
    objectType: "user",
    objectId: user.id,
  });
}

export const deactivateSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().min(3, "Informe o motivo (fica registrado na ficha).").max(300),
});

/** Sem acesso a partir de agora (sessões abertas caem); nada é apagado e a conta pode ser reativada. */
export async function deactivateUser(db: Db, adminId: string, input: z.input<typeof deactivateSchema>) {
  await assertPlatformAdmin(db, adminId);
  const data = deactivateSchema.parse(input);
  const user = await loadTarget(db, data.userId);
  if (user.id === adminId) throw forbidden("Você não pode desativar a sua própria conta.");
  if (user.disabledAt) return;
  await db.transaction(async (tx) => {
    await tx.update(users).set({ disabledAt: new Date(), disabledReason: data.reason }).where(eq(users.id, user.id));
    await tx.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.userId, user.id), isNull(userSessions.revokedAt)));
    await audit(tx as unknown as Db, { actorType: "usuario", actorId: adminId, action: "usuario.desativado", objectType: "user", objectId: user.id });
  });
}

export async function reactivateUser(db: Db, adminId: string, userId: string) {
  await assertPlatformAdmin(db, adminId);
  const user = await loadTarget(db, userId);
  if (!user.disabledAt) return;
  await db
    .update(users)
    .set({ disabledAt: null, disabledReason: null, failedLoginCount: 0, lockedUntil: null })
    .where(eq(users.id, user.id));
  await audit(db, { actorType: "usuario", actorId: adminId, action: "usuario.reativado", objectType: "user", objectId: user.id });
}

/**
 * Exclusão DEFINITIVA, só para contas sem registros (ver deletionBlockers).
 * Apaga a conta, o perfil, as sessões, os vínculos de equipe e os espaços
 * criados por ela que ficaram vazios. A auditoria guarda só o fato.
 */
export async function deleteUser(db: Db, adminId: string, input: { userId: string; confirmEmail: string }) {
  await assertPlatformAdmin(db, adminId);
  const user = await loadTarget(db, input.userId);
  if (user.id === adminId) throw forbidden("Você não pode excluir a sua própria conta.");
  if (input.confirmEmail.trim().toLowerCase() !== user.email) throw invalid("Digite o e-mail da conta, exatamente, para confirmar.");
  return db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    const blockers = await deletionBlockers(tx, user.id);
    if (blockers.length) throw invalid("Esta conta tem registros e não pode ser excluída. Desative-a.");
    const owned = await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.createdBy, user.id));
    const ownedIds = owned.map((w) => w.id);
    await tx.delete(userSessions).where(eq(userSessions.userId, user.id));
    await tx.delete(userTokens).where(eq(userTokens.userId, user.id));
    await tx.delete(memberships).where(eq(memberships.userId, user.id));
    for (const id of ownedIds) {
      await tx.delete(memberships).where(eq(memberships.workspaceId, id));
      await tx.delete(workspaces).where(eq(workspaces.id, id));
    }
    await tx.delete(professionalProfiles).where(eq(professionalProfiles.userId, user.id));
    await tx.delete(outboxMessages).where(eq(outboxMessages.recipient, user.email));
    await tx.delete(users).where(eq(users.id, user.id)); // etiquetas e anotações vão junto (cascade)
    await audit(tx, {
      actorType: "usuario",
      actorId: adminId,
      action: "usuario.excluido",
      objectType: "user",
      objectId: user.id,
      metadata: { espacos_excluidos: ownedIds.length },
    });
    return { deletedWorkspaces: ownedIds.length };
  });
}

// ---------------------------------------------------------------------------
// Etiquetas e anotações internas
// ---------------------------------------------------------------------------

/** Minúsculas, sem espaços repetidos, até 30 caracteres: letras, números, espaço, hífen ou sublinhado. */
export function normalizeTag(raw: string): string {
  const tag = raw.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
  if (!tag) throw invalid("Informe a etiqueta.");
  if (tag.length > 30) throw invalid("A etiqueta pode ter até 30 caracteres.");
  if (!/^[a-z0-9à-öø-ÿ _-]+$/.test(tag)) throw invalid("Use só letras, números, espaço, hífen ou sublinhado na etiqueta.");
  return tag;
}

export async function addUserTag(db: Db, adminId: string, userId: string, rawTag: string) {
  await assertPlatformAdmin(db, adminId);
  const user = await loadTarget(db, userId);
  const tag = normalizeTag(rawTag);
  await db.insert(userAdminTags).values({ userId: user.id, tag, createdBy: adminId }).onConflictDoNothing();
  return tag;
}

export async function removeUserTag(db: Db, adminId: string, userId: string, tag: string) {
  await assertPlatformAdmin(db, adminId);
  const user = await loadTarget(db, userId);
  await db.delete(userAdminTags).where(and(eq(userAdminTags.userId, user.id), eq(userAdminTags.tag, tag)));
}

/** Etiquetas em uso, com quantas contas têm cada uma (filtros e sugestões). */
export async function listTags(db: Db, adminId: string) {
  await assertPlatformAdmin(db, adminId);
  return db
    .select({ tag: userAdminTags.tag, users: sql<number>`count(*)`.mapWith(Number) })
    .from(userAdminTags)
    .groupBy(userAdminTags.tag)
    .orderBy(asc(userAdminTags.tag));
}

export const noteSchema = z.object({
  userId: z.string().uuid(),
  body: z.string().trim().min(1, "Escreva a anotação.").max(2000, "Anotação com no máximo 2.000 caracteres."),
});

export async function addUserNote(db: Db, adminId: string, input: z.input<typeof noteSchema>) {
  await assertPlatformAdmin(db, adminId);
  const data = noteSchema.parse(input);
  const user = await loadTarget(db, data.userId);
  const [note] = await db.insert(userAdminNotes).values({ userId: user.id, authorId: adminId, body: data.body }).returning();
  return note;
}

/** Só quem escreveu apaga a própria anotação. */
export async function deleteUserNote(db: Db, adminId: string, noteId: string) {
  await assertPlatformAdmin(db, adminId);
  if (!uuid.safeParse(noteId).success) throw notFound("Anotação");
  const [note] = await db.select().from(userAdminNotes).where(eq(userAdminNotes.id, noteId));
  if (!note) throw notFound("Anotação");
  if (note.authorId !== adminId) throw forbidden("Só quem escreveu pode apagar esta anotação.");
  await db.delete(userAdminNotes).where(eq(userAdminNotes.id, noteId));
  return note.userId;
}

// ---------------------------------------------------------------------------
// Números da base
// ---------------------------------------------------------------------------

/** Semana começando na segunda-feira, no horário de Brasília (UTC−3, sem horário de verão). */
function weekStart(d: Date): number {
  const BRT = 3 * 3600_000;
  const local = new Date(d.getTime() - BRT);
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - ((local.getUTCDay() + 6) % 7) * DAY;
  return monday + BRT;
}

/**
 * Visão geral para decisões: tamanho da base, crescimento, uso e funil de
 * ativação. Conta só profissionais e equipes — contas de administração
 * ficam de fora, e `ignoreTag` tira também as contas com aquela etiqueta
 * (ex.: "teste").
 */
export async function getAdminOverview(db: Db, adminId: string, opts: { ignoreTag?: string } = {}) {
  await assertPlatformAdmin(db, adminId);
  const population = and(
    eq(users.isPlatformAdmin, false),
    opts.ignoreTag ? sql`not exists (select 1 from user_admin_tags t where t.user_id = "users"."id" and t.tag = ${opts.ignoreTag})` : undefined
  );
  const since = (days: number) => daysAgo(days).toISOString();
  const n = (cond: SQL) => sql<number>`count(*) filter (where ${cond})`.mapWith(Number);

  const [t] = await db
    .select({
      accounts: sql<number>`count(*)`.mapWith(Number),
      active: n(sql`"users"."disabled_at" is null`),
      disabled: n(sql`"users"."disabled_at" is not null`),
      new7: n(sql`"users"."created_at" >= ${since(7)}::timestamptz`),
      new30: n(sql`"users"."created_at" >= ${since(30)}::timestamptz`),
      seen30: n(sql`exists (select 1 from user_sessions s where s.user_id = "users"."id" and s.created_at >= ${since(30)}::timestamptz)`),
      emailPending: n(sql`"users"."email_verified_at" is null and "users"."disabled_at" is null`),
      verificationPending: n(sql`"professional_profiles"."verification_status" = 'pendente' and "users"."disabled_at" is null`),
      fisioterapia: n(sql`"professional_profiles"."profession" = 'fisioterapia'`),
      educacaoFisica: n(sql`"professional_profiles"."profession" = 'educacao_fisica'`),
      noProfile: n(sql`"professional_profiles"."user_id" is null`),
      withPerson: n(sql`exists (select 1 from persons p where p.created_by = "users"."id")`),
      withRequest: n(sql`exists (select 1 from assessment_requests r where r.requested_by = "users"."id")`),
      withCompleted: n(sql`exists (select 1 from assessment_sessions s join assessment_requests r on r.id = s.request_id
        where r.requested_by = "users"."id" and s.status = 'concluida' and s.origin <> 'manual_profissional')`),
      withFeedback: n(sql`exists (select 1 from feedbacks f where f.author_id = "users"."id")`),
    })
    .from(users)
    .leftJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(population);

  // Atividade dos últimos 30 dias, só de contas da população.
  const inPopulation = (col: string) =>
    sql.raw(`${col} in (select u.id from users u where u.is_platform_admin = false)`);
  const ignored = (col: string) =>
    opts.ignoreTag ? sql`and not exists (select 1 from user_admin_tags t where t.user_id = ${sql.raw(col)} and t.tag = ${opts.ignoreTag})` : sql``;
  const [activity] = await db
    .select({
      persons: count(sql`select count(*) from persons p where p.created_at >= ${since(30)}::timestamptz
        and ${inPopulation("p.created_by")} ${ignored("p.created_by")}`),
      requests: count(sql`select count(*) from assessment_requests r where r.created_at >= ${since(30)}::timestamptz
        and ${inPopulation("r.requested_by")} ${ignored("r.requested_by")}`),
      completed: count(sql`select count(*) from assessment_sessions s join assessment_requests r on r.id = s.request_id
        where s.status = 'concluida' and s.origin <> 'manual_profissional' and s.completed_at >= ${since(30)}::timestamptz
        and ${inPopulation("r.requested_by")} ${ignored("r.requested_by")}`),
    })
    .from(sql`(select 1) as one`);

  const byUf = await db
    .select({ uf: professionalProfiles.jurisdictionUf, users: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(population)
    .groupBy(professionalProfiles.jurisdictionUf)
    .orderBy(desc(sql`count(*)`), asc(professionalProfiles.jurisdictionUf));

  // Cadastros por semana (12 semanas, a atual inclusive), agrupados aqui para não depender do fuso do banco.
  const WEEKS = 12;
  const firstWeek = weekStart(new Date()) - (WEEKS - 1) * 7 * DAY;
  const recent = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(and(population, gte(users.createdAt, new Date(firstWeek))));
  const weekly = Array.from({ length: WEEKS }, (_, i) => ({ start: new Date(firstWeek + i * 7 * DAY), users: 0 }));
  for (const r of recent) {
    const i = Math.floor((weekStart(r.createdAt) - firstWeek) / (7 * DAY));
    if (weekly[i]) weekly[i].users += 1;
  }

  return {
    totals: t,
    funnel: [
      { key: "conta", label: "Criaram a conta", users: t.accounts },
      { key: "pessoa", label: "Cadastraram uma pessoa atendida", users: t.withPerson },
      { key: "solicitacao", label: "Solicitaram uma avaliação", users: t.withRequest },
      { key: "realizada", label: "Tiveram uma avaliação realizada", users: t.withCompleted },
      { key: "devolutiva", label: "Publicaram uma devolutiva", users: t.withFeedback },
    ],
    activity30: activity,
    byUf,
    weekly,
  };
}
