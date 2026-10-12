/**
 * Autorização no servidor.
 *
 * Três camadas, todas obrigatórias para dados clínicos:
 * 1. Participação ATIVA no espaço (membership).
 * 2. O objeto pertence ao espaço (consulta sempre filtrada por workspace_id;
 *    o banco também impede ligações entre espaços via chaves compostas).
 * 3. Vínculo de atendimento ativo entre o profissional e a pessoa.
 *
 * Identificadores vindos do navegador nunca bastam sozinhos. Acesso negado
 * e inexistente produzem o mesmo erro ("não encontrado").
 */
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { careRelationships, memberships, persons, professionalProfiles, users, workspaces } from "@/db/schema";
import { forbidden, notFound } from "../errors";

export type Role = "gestor" | "profissional" | "assistente";

export interface WorkspaceContext {
  userId: string;
  userName: string;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
  workspace: typeof workspaces.$inferSelect;
  role: Role;
  profile: typeof professionalProfiles.$inferSelect | null;
}

export async function listUserWorkspaces(db: Db, userId: string) {
  return db
    .select({ workspace: workspaces, role: memberships.role })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "ativo")))
    .orderBy(workspaces.createdAt);
}

export async function loadWorkspaceContext(db: Db, userId: string, workspaceId: string): Promise<WorkspaceContext> {
  const [row] = await db
    .select({ workspace: workspaces, membership: memberships, user: users })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId), eq(memberships.status, "ativo"))
    );
  if (!row || row.user.disabledAt) throw notFound("Espaço");
  const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, userId));
  return {
    userId,
    userName: row.user.name,
    emailVerified: !!row.user.emailVerifiedAt,
    isPlatformAdmin: row.user.isPlatformAdmin,
    workspace: row.workspace,
    role: row.membership.role,
    profile: profile ?? null,
  };
}

/** Papéis que podem ter acesso clínico (sempre condicionado ao vínculo). */
export function canHaveClinicalAccess(ctx: WorkspaceContext): boolean {
  return (ctx.role === "gestor" || ctx.role === "profissional") && !!ctx.profile;
}

export function requireRole(ctx: WorkspaceContext, ...roles: Role[]): void {
  if (!roles.includes(ctx.role)) throw forbidden("Seu papel neste espaço não permite esta ação.");
}

/** Pessoa do espaço — dados cadastrais (sem conteúdo clínico). */
export async function getPersonInWorkspace(db: Db, ctx: WorkspaceContext, personId: string) {
  const [p] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.id, personId), eq(persons.workspaceId, ctx.workspace.id)));
  if (!p) throw notFound("Pessoa");
  return p;
}

export async function hasActiveRelationship(db: Db, ctx: WorkspaceContext, personId: string): Promise<boolean> {
  const rows = await db
    .select({ id: careRelationships.id })
    .from(careRelationships)
    .where(
      and(
        eq(careRelationships.workspaceId, ctx.workspace.id),
        eq(careRelationships.personId, personId),
        eq(careRelationships.professionalUserId, ctx.userId),
        isNull(careRelationships.endedAt)
      )
    );
  return rows.length > 0;
}

/**
 * Exige acesso clínico à pessoa: papel clínico + perfil profissional +
 * vínculo ativo. Devolve a pessoa (já confirmada no espaço).
 */
export async function requireCareAccess(db: Db, ctx: WorkspaceContext, personId: string) {
  const person = await getPersonInWorkspace(db, ctx, personId);
  if (!canHaveClinicalAccess(ctx) || !(await hasActiveRelationship(db, ctx, personId))) {
    throw notFound("Pessoa");
  }
  return person;
}
