/**
 * Painel "Hoje": pendências acionáveis do profissional, restritas às
 * pessoas com quem ele tem vínculo ativo.
 */
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { assessmentRequests, assessmentSessions, careRelationships, invitations, measurements, persons } from "@/db/schema";
import { getProtocol } from "@/lib/care/protocols";
import { invitationStatus } from "./assessments";
import { canHaveClinicalAccess, type WorkspaceContext } from "./authz";

export interface PendingItem {
  requestId: string;
  personId: string;
  personName: string;
  isFictitious: boolean;
  protocolTitle: string;
  detail: string;
  at: Date;
}

export async function getTodayPanel(db: Db, ctx: WorkspaceContext) {
  const empty = { awaitingReview: [], redo: [], waitingPerson: [], overdue: [], totals: { people: 0 } };
  if (!canHaveClinicalAccess(ctx)) return empty as unknown as Awaited<ReturnType<typeof build>>;
  return build(db, ctx);
}

async function build(db: Db, ctx: WorkspaceContext) {
  const myPeople = await db
    .select({ personId: careRelationships.personId })
    .from(careRelationships)
    .where(
      and(
        eq(careRelationships.workspaceId, ctx.workspace.id),
        eq(careRelationships.professionalUserId, ctx.userId),
        isNull(careRelationships.endedAt)
      )
    );
  const ids = Array.from(new Set(myPeople.map((r) => r.personId)));
  const result = {
    awaitingReview: [] as PendingItem[],
    redo: [] as PendingItem[],
    waitingPerson: [] as PendingItem[],
    overdue: [] as PendingItem[],
    totals: { people: ids.length },
  };
  if (!ids.length) return result;

  const rows = await db
    .select({ request: assessmentRequests, person: persons })
    .from(assessmentRequests)
    .innerJoin(persons, eq(persons.id, assessmentRequests.personId))
    .where(
      and(
        eq(assessmentRequests.workspaceId, ctx.workspace.id),
        inArray(assessmentRequests.personId, ids),
        inArray(assessmentRequests.status, ["pendente", "em_andamento", "aguardando_revisao"])
      )
    )
    .orderBy(desc(assessmentRequests.createdAt));
  if (!rows.length) return result;

  const requestIds = rows.map((r) => r.request.id);
  const sessions = await db
    .select()
    .from(assessmentSessions)
    .where(and(eq(assessmentSessions.workspaceId, ctx.workspace.id), inArray(assessmentSessions.requestId, requestIds)))
    .orderBy(desc(assessmentSessions.startedAt));
  const invites = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.workspaceId, ctx.workspace.id), inArray(invitations.assessmentRequestId, requestIds)))
    .orderBy(desc(invitations.createdAt));
  const insufficient = sessions.length
    ? await db
        .select({ sessionId: measurements.sessionId })
        .from(measurements)
        .where(
          and(
            inArray(
              measurements.sessionId,
              sessions.map((s) => s.id)
            ),
            eq(measurements.quality, "insuficiente")
          )
        )
    : [];
  const insufficientSessions = new Set(insufficient.map((i) => i.sessionId));
  const now = new Date();

  for (const { request, person } of rows) {
    const base = {
      requestId: request.id,
      personId: person.id,
      personName: person.fullName,
      isFictitious: person.isFictitious,
      protocolTitle: getProtocol(request.protocolId)?.shortTitle ?? request.protocolId,
    };
    const reqSessions = sessions.filter((s) => s.requestId === request.id);
    const latest = reqSessions[0];
    if (request.status === "aguardando_revisao") {
      const partial = latest && insufficientSessions.has(latest.id);
      result.awaitingReview.push({
        ...base,
        detail: partial ? "Resultado enviado — há medidas com captura insuficiente" : "Resultado enviado, aguardando sua revisão",
        at: latest?.completedAt ?? request.createdAt,
      });
      continue;
    }
    if (latest?.status === "interrompida") {
      result.redo.push({ ...base, detail: `Atividade interrompida (${latest.interruptionReason ?? "sem motivo"})`, at: latest.completedAt ?? latest.startedAt });
      continue;
    }
    const inv = invites.find((i) => i.assessmentRequestId === request.id);
    const invStatus = inv ? invitationStatus(inv, now) : null;
    if (request.dueAt && request.dueAt < now) {
      result.overdue.push({ ...base, detail: "Prazo encerrado sem envio", at: request.dueAt });
    } else if (invStatus === "expirado" || invStatus === "revogado" || !inv) {
      result.overdue.push({ ...base, detail: "Sem convite ativo — gere um novo link", at: request.createdAt });
    } else {
      const label = { criado: "Convite ainda não acessado", acessado: "Convite aberto, acesso não confirmado", confirmado: "Acesso confirmado, atividade não enviada" } as const;
      result.waitingPerson.push({ ...base, detail: label[invStatus as keyof typeof label] ?? "Aguardando", at: request.createdAt });
    }
  }
  return result;
}
