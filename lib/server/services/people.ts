/**
 * Pessoas atendidas, vínculos, episódios e equipe do espaço.
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import {
  careEpisodes,
  careRelationships,
  consentDocuments,
  consentRecords,
  memberships,
  persons,
  professionalProfiles,
  users,
} from "@/db/schema";
import { UFS } from "@/lib/care/vocabulary";
import { forbidden, invalid } from "../errors";
import { audit } from "./core";
import {
  canHaveClinicalAccess,
  getPersonInWorkspace,
  requireCareAccess,
  requireRole,
  type WorkspaceContext,
} from "./authz";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const personSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe o nome completo.").max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(200)
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional()
      .refine((v) => !v || z.string().email().safeParse(v).success, "E-mail inválido."),
    phone: optionalText(30),
    preferredChannel: z.enum(["email", "sms", "whatsapp"]),
    city: optionalText(80),
    uf: z
      .union([z.enum(UFS), z.literal("")])
      .optional()
      .transform((v) => (v ? v : null)),
    episodeTitle: z.string().trim().min(3, "Descreva o objetivo ou motivo do acompanhamento.").max(200),
    modality: z.enum(["presencial", "remoto", "hibrido"]),
    remoteSuitabilityNote: optionalText(1000),
  })
  .refine((d) => d.email || d.phone, { message: "Informe ao menos um contato (e-mail ou telefone).", path: ["email"] });
export type PersonInput = z.input<typeof personSchema>;

/**
 * Cadastra pessoa + primeiro episódio. Se quem cadastra tem papel
 * clínico, o vínculo de atendimento é criado com ele. Assistentes
 * cadastram sem vínculo; um gestor atribui depois.
 */
export async function createPerson(db: Db, ctx: WorkspaceContext, input: PersonInput) {
  const data = personSchema.parse(input);
  return db.transaction(async (tx) => {
    const [person] = await tx
      .insert(persons)
      .values({
        workspaceId: ctx.workspace.id,
        fullName: data.fullName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        preferredChannel: data.preferredChannel,
        city: data.city ?? null,
        uf: data.uf ?? null,
        isFictitious: ctx.workspace.environment === "demonstracao",
        createdBy: ctx.userId,
      })
      .returning();
    if (canHaveClinicalAccess(ctx)) {
      await tx.insert(careRelationships).values({
        workspaceId: ctx.workspace.id,
        personId: person.id,
        professionalUserId: ctx.userId,
        createdBy: ctx.userId,
      });
    }
    await tx.insert(careEpisodes).values({
      workspaceId: ctx.workspace.id,
      personId: person.id,
      title: data.episodeTitle,
      modality: data.modality,
      remoteSuitabilityNote: data.remoteSuitabilityNote ?? null,
      openedBy: ctx.userId,
    });
    await audit(tx as unknown as Db, {
      workspaceId: ctx.workspace.id,
      actorType: "usuario",
      actorId: ctx.userId,
      action: "pessoa.cadastrada",
      objectType: "person",
      objectId: person.id,
    });
    return person;
  });
}

export interface PersonListItem {
  id: string;
  fullName: string;
  isFictitious: boolean;
  hasMyRelationship: boolean;
  professionals: string[];
  createdAt: Date;
}

/**
 * Lista do espaço. Profissionais veem quem atendem; gestor e assistente
 * veem todos os nomes (cadastro), mas sem conteúdo clínico.
 */
export async function listPeople(db: Db, ctx: WorkspaceContext): Promise<PersonListItem[]> {
  const rows = await db
    .select()
    .from(persons)
    .where(and(eq(persons.workspaceId, ctx.workspace.id), isNull(persons.archivedAt)))
    .orderBy(persons.fullName);
  if (!rows.length) return [];
  const rels = await db
    .select({ personId: careRelationships.personId, userId: users.id, name: users.name })
    .from(careRelationships)
    .innerJoin(users, eq(users.id, careRelationships.professionalUserId))
    .where(
      and(
        eq(careRelationships.workspaceId, ctx.workspace.id),
        isNull(careRelationships.endedAt),
        inArray(
          careRelationships.personId,
          rows.map((r) => r.id)
        )
      )
    );
  const items = rows.map((p) => {
    const mine = rels.filter((r) => r.personId === p.id);
    return {
      id: p.id,
      fullName: p.fullName,
      isFictitious: p.isFictitious,
      hasMyRelationship: mine.some((r) => r.userId === ctx.userId),
      professionals: mine.map((r) => r.name),
      createdAt: p.createdAt,
    };
  });
  return ctx.role === "profissional" ? items.filter((i) => i.hasMyRelationship) : items;
}

export async function getPersonForCare(db: Db, ctx: WorkspaceContext, personId: string) {
  const person = await requireCareAccess(db, ctx, personId);
  const episodes = await db
    .select()
    .from(careEpisodes)
    .where(and(eq(careEpisodes.workspaceId, ctx.workspace.id), eq(careEpisodes.personId, personId)))
    .orderBy(desc(careEpisodes.openedAt));
  const consents = await db
    .select({ record: consentRecords, doc: consentDocuments })
    .from(consentRecords)
    .innerJoin(consentDocuments, eq(consentDocuments.id, consentRecords.documentId))
    .where(and(eq(consentRecords.workspaceId, ctx.workspace.id), eq(consentRecords.personId, personId)))
    .orderBy(desc(consentRecords.recordedAt));
  await audit(db, {
    workspaceId: ctx.workspace.id,
    actorType: "usuario",
    actorId: ctx.userId,
    action: "pessoa.prontuario_acessado",
    objectType: "person",
    objectId: personId,
  });
  return { person, episodes, consents };
}

export async function createEpisode(
  db: Db,
  ctx: WorkspaceContext,
  personId: string,
  input: { title: string; modality: "presencial" | "remoto" | "hibrido"; remoteSuitabilityNote?: string | null }
) {
  await requireCareAccess(db, ctx, personId);
  if (input.title.trim().length < 3) throw invalid("Descreva o objetivo ou motivo.");
  const [ep] = await db
    .insert(careEpisodes)
    .values({
      workspaceId: ctx.workspace.id,
      personId,
      title: input.title.trim(),
      modality: input.modality,
      remoteSuitabilityNote: input.remoteSuitabilityNote?.trim() || null,
      openedBy: ctx.userId,
    })
    .returning();
  return ep;
}

// ---------------------------------------------------------------------------
// Equipe
// ---------------------------------------------------------------------------

export async function listTeam(db: Db, ctx: WorkspaceContext) {
  return db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      status: memberships.status,
      profession: professionalProfiles.profession,
      verificationStatus: professionalProfiles.verificationStatus,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(professionalProfiles, eq(professionalProfiles.userId, users.id))
    .where(eq(memberships.workspaceId, ctx.workspace.id))
    .orderBy(users.name);
}

/** Gestor adiciona alguém que já tem conta no Moveo. */
export async function addMember(db: Db, ctx: WorkspaceContext, email: string, role: "gestor" | "profissional" | "assistente") {
  requireRole(ctx, "gestor");
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  if (!user) throw invalid("Nenhuma conta encontrada com este e-mail. Peça que a pessoa crie a conta primeiro.");
  if (role === "profissional") {
    const [profile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, user.id));
    if (!profile) throw invalid("Esta conta não tem perfil profissional; use o papel de assistente.");
  }
  await db
    .insert(memberships)
    .values({ workspaceId: ctx.workspace.id, userId: user.id, role })
    .onConflictDoUpdate({ target: [memberships.workspaceId, memberships.userId], set: { role, status: "ativo" } });
  await audit(db, {
    workspaceId: ctx.workspace.id,
    actorType: "usuario",
    actorId: ctx.userId,
    action: "equipe.membro_definido",
    objectType: "user",
    objectId: user.id,
    metadata: { papel: role },
  });
}

/** Gestor atribui (ou encerra) o vínculo de um profissional do espaço com uma pessoa. */
export async function setRelationship(
  db: Db,
  ctx: WorkspaceContext,
  personId: string,
  professionalUserId: string,
  active: boolean
) {
  requireRole(ctx, "gestor");
  await getPersonInWorkspace(db, ctx, personId);
  const [member] = await db
    .select()
    .from(memberships)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, memberships.userId))
    .where(
      and(
        eq(memberships.workspaceId, ctx.workspace.id),
        eq(memberships.userId, professionalUserId),
        eq(memberships.status, "ativo")
      )
    );
  if (!member || member.memberships.role === "assistente") throw forbidden("Profissional não pertence a este espaço.");

  if (active) {
    const existing = await db
      .select({ id: careRelationships.id })
      .from(careRelationships)
      .where(
        and(
          eq(careRelationships.workspaceId, ctx.workspace.id),
          eq(careRelationships.personId, personId),
          eq(careRelationships.professionalUserId, professionalUserId),
          isNull(careRelationships.endedAt)
        )
      );
    if (!existing.length) {
      await db.insert(careRelationships).values({
        workspaceId: ctx.workspace.id,
        personId,
        professionalUserId,
        createdBy: ctx.userId,
      });
    }
  } else {
    await db
      .update(careRelationships)
      .set({ endedAt: sql`now()` })
      .where(
        and(
          eq(careRelationships.workspaceId, ctx.workspace.id),
          eq(careRelationships.personId, personId),
          eq(careRelationships.professionalUserId, professionalUserId),
          isNull(careRelationships.endedAt)
        )
      );
  }
  await audit(db, {
    workspaceId: ctx.workspace.id,
    actorType: "usuario",
    actorId: ctx.userId,
    action: active ? "vinculo.criado" : "vinculo.encerrado",
    objectType: "person",
    objectId: personId,
    metadata: { profissional: professionalUserId },
  });
}

export async function getPersonRelationships(db: Db, ctx: WorkspaceContext, personId: string) {
  await getPersonInWorkspace(db, ctx, personId);
  return db
    .select({ userId: users.id, name: users.name, startedAt: careRelationships.startedAt })
    .from(careRelationships)
    .innerJoin(users, eq(users.id, careRelationships.professionalUserId))
    .where(
      and(
        eq(careRelationships.workspaceId, ctx.workspace.id),
        eq(careRelationships.personId, personId),
        isNull(careRelationships.endedAt)
      )
    );
}

