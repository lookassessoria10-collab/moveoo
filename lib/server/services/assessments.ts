/**
 * Ciclo de avaliação do lado do profissional: solicitar (com convite),
 * acompanhar, revisar medidas, publicar devolutiva, reavaliar e registrar
 * medição presencial.
 */
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import {
  assessmentRequests,
  assessmentSessions,
  careEpisodes,
  feedbacks,
  invitations,
  measurementReviews,
  measurements,
  persons,
  users,
} from "@/db/schema";
import { ACCESS, PLATFORM } from "@/config/platform";
import { getProtocol, MANUAL_INSTRUMENTS, normalizeSelection, selectedItems, type ProtocolDefinition } from "@/lib/care/protocols";
import { compareSessions, type ComparableMeasurement, type ReviewDecision } from "@/lib/care/comparison";
import { randomCode, randomToken, sha256 } from "../crypto";
import { conflict, forbidden, invalid, notFound } from "../errors";
import { assertProtocolExecutable, audit, sendMessage } from "./core";
import { requireCareAccess, requireRole, type WorkspaceContext } from "./authz";

type Channel = "email" | "sms" | "whatsapp";

export type InvitationStatus = "criado" | "acessado" | "confirmado" | "expirado" | "revogado";

export function invitationStatus(inv: typeof invitations.$inferSelect, now = new Date()): InvitationStatus {
  if (inv.revokedAt) return "revogado";
  if (inv.confirmedAt) return "confirmado";
  if (inv.expiresAt <= now) return "expirado";
  if (inv.accessedAt) return "acessado";
  return "criado";
}

export const requestSchema = z.object({
  personId: z.string().uuid(),
  protocolId: z.string(),
  episodeId: z.string().uuid().nullable().optional(),
  instructions: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v || null),
  supervision: z.enum(["sem_supervisao", "sessao_ao_vivo"]).default("sem_supervisao"),
  dueInDays: z.coerce.number().int().min(1).max(ACCESS.inviteMaxDays).default(ACCESS.inviteDefaultDays),
  channel: z.enum(["email", "sms", "whatsapp"]),
  previousRequestId: z.string().uuid().nullable().optional(),
  /** Ids dos movimentos pedidos (PROTOCOL_ITEMS). Ausente = protocolo completo. */
  selectedItems: z.array(z.string().max(40)).max(20).optional(),
});
export type RequestInput = z.input<typeof requestSchema>;

function assertCanInvite(ctx: WorkspaceContext) {
  requireRole(ctx, "gestor", "profissional");
  if (!ctx.emailVerified) throw forbidden("Confirme seu e-mail antes de enviar convites.");
  if (ctx.workspace.environment === "real" && ctx.profile?.verificationStatus !== "verificado") {
    throw forbidden("Atendimento real exige registro profissional verificado.");
  }
}

function contactFor(person: typeof persons.$inferSelect, channel: Channel): string {
  const value = channel === "email" ? person.email : person.phone;
  if (!value) throw invalid(channel === "email" ? "A pessoa não tem e-mail cadastrado." : "A pessoa não tem telefone cadastrado.");
  return value;
}

/** Mensagem do convite: discreta, sem dados clínicos, sem nome do protocolo. */
function inviteMessage(workspaceName: string, url: string, days: number) {
  return `${workspaceName} enviou uma atividade para você pelo ${PLATFORM.name}.\n\nAcesse: ${url}\n\nO link é pessoal e vale por ${days} dia(s). Para entrar, use o código de acesso que o profissional vai passar para você separadamente.`;
}

/**
 * O wa.me exige o número internacional. Telefone brasileiro cadastrado só
 * com DDD (10 ou 11 dígitos) ganha o 55 na frente.
 */
export function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

async function createInvitation(
  db: Db,
  ctx: WorkspaceContext,
  person: typeof persons.$inferSelect,
  requestId: string,
  channel: Channel,
  days: number,
  baseUrl: string
) {
  const contact = contactFor(person, channel);
  const token = randomToken();
  // Código de acesso: mostrado só ao profissional, que o repassa à pessoa por
  // um meio diferente do link. Vale enquanto o convite valer; só o hash fica guardado.
  const code = randomCode();
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  const [inv] = await db
    .insert(invitations)
    .values({
      workspaceId: ctx.workspace.id,
      personId: person.id,
      assessmentRequestId: requestId,
      createdBy: ctx.userId,
      tokenHash: sha256(token),
      channel,
      expiresAt,
      codeHash: sha256(code),
      codeExpiresAt: expiresAt,
    })
    .returning();
  const url = `${baseUrl}/convite/${token}`;
  const message = inviteMessage(ctx.workspace.name, url, days);
  if (channel !== "whatsapp") {
    await sendMessage(db, { channel, recipient: contact, subject: `Atividade de ${ctx.workspace.name}`, body: message });
  }
  await audit(db, {
    workspaceId: ctx.workspace.id,
    actorType: "usuario",
    actorId: ctx.userId,
    action: "convite.criado",
    objectType: "invitation",
    objectId: inv.id,
    metadata: { canal: channel, dias: days },
  });
  // WhatsApp: o envio é uma ação explícita do profissional (link wa.me), sem automação.
  const whatsappUrl =
    channel === "whatsapp" ? `https://wa.me/${whatsappNumber(contact)}?text=${encodeURIComponent(message)}` : null;
  return { invitation: inv, url, whatsappUrl, code };
}

export async function createAssessmentRequest(db: Db, ctx: WorkspaceContext, input: RequestInput, baseUrl: string) {
  const data = requestSchema.parse(input);
  assertCanInvite(ctx);
  const person = await requireCareAccess(db, ctx, data.personId);
  const protocol = getProtocol(data.protocolId);
  if (!protocol || protocol.kind !== "camera") throw invalid("Protocolo inválido para avaliação a distância.");
  await assertProtocolExecutable(db, ctx.workspace, protocol.id);

  if (data.episodeId) {
    const [ep] = await db
      .select()
      .from(careEpisodes)
      .where(and(eq(careEpisodes.id, data.episodeId), eq(careEpisodes.workspaceId, ctx.workspace.id), eq(careEpisodes.personId, person.id)));
    if (!ep) throw notFound("Episódio");
  }
  if (data.previousRequestId) {
    const [prev] = await db
      .select()
      .from(assessmentRequests)
      .where(and(eq(assessmentRequests.id, data.previousRequestId), eq(assessmentRequests.workspaceId, ctx.workspace.id)));
    if (!prev || prev.personId !== person.id) throw notFound("Avaliação anterior");
    if (prev.protocolId !== protocol.id) throw invalid("A reavaliação precisa usar o mesmo protocolo.");
    // Reavaliação sem escolha explícita repete os mesmos movimentos da anterior.
    if (data.selectedItems === undefined) data.selectedItems = prev.selectedItems ?? undefined;
  }
  let selection: string[] | null;
  try {
    selection = normalizeSelection(protocol.id, data.selectedItems);
  } catch (e) {
    throw invalid(e instanceof Error ? e.message : "Seleção de movimentos inválida.");
  }

  return db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    const [request] = await tx
      .insert(assessmentRequests)
      .values({
        workspaceId: ctx.workspace.id,
        personId: person.id,
        episodeId: data.episodeId ?? null,
        requestedBy: ctx.userId,
        protocolId: protocol.id,
        protocolVersion: protocol.version,
        selectedItems: selection,
        instructions: data.instructions,
        supervision: data.supervision,
        dueAt: new Date(Date.now() + data.dueInDays * 86_400_000),
        previousRequestId: data.previousRequestId ?? null,
      })
      .returning();
    await audit(tx, {
      workspaceId: ctx.workspace.id,
      actorType: "usuario",
      actorId: ctx.userId,
      action: data.previousRequestId ? "avaliacao.reavaliacao_solicitada" : "avaliacao.solicitada",
      objectType: "assessment_request",
      objectId: request.id,
      metadata: { protocolo: protocol.id, versao: protocol.version },
    });
    const invite = await createInvitation(tx, ctx, person, request.id, data.channel, data.dueInDays, baseUrl);
    return { request, ...invite };
  });
}

async function getRequestForCare(db: Db, ctx: WorkspaceContext, requestId: string) {
  const [request] = await db
    .select()
    .from(assessmentRequests)
    .where(and(eq(assessmentRequests.id, requestId), eq(assessmentRequests.workspaceId, ctx.workspace.id)));
  if (!request) throw notFound("Avaliação");
  const person = await requireCareAccess(db, ctx, request.personId);
  return { request, person };
}

/** Novo link para a mesma solicitação; convites anteriores ainda ativos são revogados. */
export async function reissueInvitation(db: Db, ctx: WorkspaceContext, requestId: string, channel: Channel, baseUrl: string) {
  assertCanInvite(ctx);
  const { request, person } = await getRequestForCare(db, ctx, requestId);
  if (request.status === "cancelada" || request.status === "revisada") throw conflict("Esta avaliação já foi encerrada.");
  await assertProtocolExecutable(db, ctx.workspace, request.protocolId);
  await db
    .update(invitations)
    .set({ revokedAt: new Date(), revokedBy: ctx.userId })
    .where(and(eq(invitations.assessmentRequestId, request.id), isNull(invitations.revokedAt)));
  const days = Math.max(1, Math.ceil(((request.dueAt?.getTime() ?? Date.now()) - Date.now()) / 86_400_000)) || ACCESS.inviteDefaultDays;
  return createInvitation(db, ctx, person, request.id, channel, Math.min(days, ACCESS.inviteMaxDays), baseUrl);
}

export async function revokeInvitation(db: Db, ctx: WorkspaceContext, invitationId: string) {
  requireRole(ctx, "gestor", "profissional");
  const [inv] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.workspaceId, ctx.workspace.id)));
  if (!inv) throw notFound("Convite");
  await requireCareAccess(db, ctx, inv.personId);
  if (inv.revokedAt) return;
  await db.update(invitations).set({ revokedAt: new Date(), revokedBy: ctx.userId }).where(eq(invitations.id, inv.id));
  await audit(db, {
    workspaceId: ctx.workspace.id,
    actorType: "usuario",
    actorId: ctx.userId,
    action: "convite.revogado",
    objectType: "invitation",
    objectId: inv.id,
  });
}

export async function cancelRequest(db: Db, ctx: WorkspaceContext, requestId: string) {
  requireRole(ctx, "gestor", "profissional");
  const { request } = await getRequestForCare(db, ctx, requestId);
  if (request.status === "revisada") throw conflict("Avaliação já revisada não pode ser cancelada.");
  await db.update(assessmentRequests).set({ status: "cancelada", cancelledAt: new Date() }).where(eq(assessmentRequests.id, request.id));
  await db
    .update(invitations)
    .set({ revokedAt: new Date(), revokedBy: ctx.userId })
    .where(and(eq(invitations.assessmentRequestId, request.id), isNull(invitations.revokedAt)));
  await audit(db, {
    workspaceId: ctx.workspace.id,
    actorType: "usuario",
    actorId: ctx.userId,
    action: "avaliacao.cancelada",
    objectType: "assessment_request",
    objectId: request.id,
  });
}

// ---------------------------------------------------------------------------
// Leitura: medidas com revisão vigente
// ---------------------------------------------------------------------------

export interface MeasurementView {
  id: string;
  metricKey: string;
  label: string;
  movement: string;
  side: string;
  value: number | null;
  unit: string;
  method: string;
  attemptsPlanned: number | null;
  attemptsAnalyzed: number | null;
  quality: "apta" | "insuficiente";
  rejectionReason: string | null;
  review: {
    decision: "aceita" | "corrigida" | "descartada";
    correctedValue: number | null;
    justification: string | null;
    reviewerName: string;
    at: Date;
  } | null;
  reviewHistory: number;
}

function metricLabel(protocol: ProtocolDefinition | null, metricKey: string, side: string, movement: string): string {
  const def = protocol?.metrics.find((m) => m.key === metricKey && m.side === side);
  return def?.label ?? movement;
}

export async function loadMeasurements(db: Db, workspaceId: string, sessionIds: string[]) {
  if (!sessionIds.length) return new Map<string, MeasurementView[]>();
  const rows = await db
    .select()
    .from(measurements)
    .where(and(eq(measurements.workspaceId, workspaceId), inArray(measurements.sessionId, sessionIds)))
    .orderBy(asc(measurements.createdAt));
  const reviews = rows.length
    ? await db
        .select({ review: measurementReviews, reviewerName: users.name })
        .from(measurementReviews)
        .innerJoin(users, eq(users.id, measurementReviews.reviewerId))
        .where(
          inArray(
            measurementReviews.measurementId,
            rows.map((r) => r.id)
          )
        )
        .orderBy(asc(measurementReviews.createdAt))
    : [];
  const sessions = await db
    .select({ id: assessmentSessions.id, protocolId: assessmentSessions.protocolId })
    .from(assessmentSessions)
    .where(inArray(assessmentSessions.id, sessionIds));
  const protocolBySession = new Map(sessions.map((s) => [s.id, getProtocol(s.protocolId)]));

  const out = new Map<string, MeasurementView[]>();
  for (const m of rows) {
    const history = reviews.filter((r) => r.review.measurementId === m.id);
    const latest = history[history.length - 1];
    const view: MeasurementView = {
      id: m.id,
      metricKey: m.metricKey,
      label: metricLabel(protocolBySession.get(m.sessionId) ?? null, m.metricKey, m.side, m.movement),
      movement: m.movement,
      side: m.side,
      value: m.value,
      unit: m.unit,
      method: m.method,
      attemptsPlanned: m.attemptsPlanned,
      attemptsAnalyzed: m.attemptsAnalyzed,
      quality: m.quality,
      rejectionReason: m.rejectionReason,
      review: latest
        ? {
            decision: latest.review.decision,
            correctedValue: latest.review.correctedValue,
            justification: latest.review.justification,
            reviewerName: latest.reviewerName,
            at: latest.review.createdAt,
          }
        : null,
      reviewHistory: history.length,
    };
    const list = out.get(m.sessionId) ?? [];
    list.push(view);
    out.set(m.sessionId, list);
  }
  return out;
}

export async function getRequestDetail(db: Db, ctx: WorkspaceContext, requestId: string) {
  const { request, person } = await getRequestForCare(db, ctx, requestId);
  const protocol = getProtocol(request.protocolId);
  const [requester] = await db.select({ name: users.name }).from(users).where(eq(users.id, request.requestedBy));
  const invites = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.assessmentRequestId, request.id), eq(invitations.workspaceId, ctx.workspace.id)))
    .orderBy(desc(invitations.createdAt));
  const sessions = await db
    .select()
    .from(assessmentSessions)
    .where(and(eq(assessmentSessions.requestId, request.id), eq(assessmentSessions.workspaceId, ctx.workspace.id)))
    .orderBy(desc(assessmentSessions.startedAt));
  const measurementsBySession = await loadMeasurements(
    db,
    ctx.workspace.id,
    sessions.map((s) => s.id)
  );
  const feedbackVersions = await db
    .select({ feedback: feedbacks, authorName: users.name })
    .from(feedbacks)
    .innerJoin(users, eq(users.id, feedbacks.authorId))
    .where(and(eq(feedbacks.requestId, request.id), eq(feedbacks.workspaceId, ctx.workspace.id)))
    .orderBy(desc(feedbacks.version));
  const episode = request.episodeId
    ? (await db.select().from(careEpisodes).where(eq(careEpisodes.id, request.episodeId)))[0] ?? null
    : null;

  await audit(db, {
    workspaceId: ctx.workspace.id,
    actorType: "usuario",
    actorId: ctx.userId,
    action: "avaliacao.acessada",
    objectType: "assessment_request",
    objectId: request.id,
  });

  return {
    request,
    person,
    protocol,
    /** Movimentos pedidos (todos, se a solicitação foi do protocolo completo). */
    items: selectedItems(request.protocolId, request.selectedItems),
    fullProtocol: !request.selectedItems,
    requesterName: requester?.name ?? "—",
    episode,
    invitations: invites.map((i) => ({ ...i, status: invitationStatus(i) })),
    sessions: sessions.map((s) => ({ ...s, measurements: measurementsBySession.get(s.id) ?? [] })),
    feedbackVersions,
  };
}

// ---------------------------------------------------------------------------
// Revisão das medidas
// ---------------------------------------------------------------------------

export const reviewSchema = z.array(
  z
    .object({
      measurementId: z.string().uuid(),
      decision: z.enum(["aceita", "corrigida", "descartada"]),
      correctedValue: z.number().nullable().optional(),
      justification: z
        .string()
        .trim()
        .max(500)
        .optional()
        .transform((v) => v || null),
    })
    .superRefine((d, c) => {
      if (d.decision === "corrigida" && (d.correctedValue === null || d.correctedValue === undefined)) {
        c.addIssue({ code: "custom", message: "Informe o valor corrigido." });
      }
      if (d.decision !== "aceita" && !d.justification) {
        c.addIssue({ code: "custom", message: "Justifique a correção ou o descarte." });
      }
    })
);

/**
 * Registra a decisão do profissional para cada medida da sessão. Nada é
 * sobrescrito: cada revisão é uma nova linha; o valor original continua
 * guardado e visível.
 */
export async function reviewSession(
  db: Db,
  ctx: WorkspaceContext,
  sessionId: string,
  decisions: z.input<typeof reviewSchema>
) {
  const parsed = reviewSchema.parse(decisions);
  const [session] = await db
    .select()
    .from(assessmentSessions)
    .where(and(eq(assessmentSessions.id, sessionId), eq(assessmentSessions.workspaceId, ctx.workspace.id)));
  if (!session) throw notFound("Sessão");
  await requireCareAccess(db, ctx, session.personId);
  requireRole(ctx, "gestor", "profissional");
  if (session.status !== "concluida") throw conflict("Só é possível revisar sessões concluídas.");

  const ms = await db
    .select()
    .from(measurements)
    .where(and(eq(measurements.sessionId, session.id), eq(measurements.workspaceId, ctx.workspace.id)));
  const ids = new Set(ms.map((m) => m.id));
  if (parsed.some((d) => !ids.has(d.measurementId))) throw notFound("Medida");
  if (session.reviewStatus === "provisorio" && parsed.length !== ms.length) {
    throw invalid("Revise todas as medidas da sessão.");
  }
  // Medida sem valor válido só pode ser descartada ou corrigida (nunca "aceita" como número).
  for (const d of parsed) {
    const m = ms.find((x) => x.id === d.measurementId)!;
    if (d.decision === "aceita" && (m.value === null || m.quality !== "apta")) {
      throw invalid("Uma medida sem valor válido não pode ser aceita; corrija com justificativa ou descarte.");
    }
  }

  await db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    await tx.insert(measurementReviews).values(
      parsed.map((d) => ({
        workspaceId: ctx.workspace.id,
        measurementId: d.measurementId,
        reviewerId: ctx.userId,
        decision: d.decision,
        correctedValue: d.decision === "corrigida" ? (d.correctedValue ?? null) : null,
        justification: d.justification,
      }))
    );
    await tx
      .update(assessmentSessions)
      .set({ reviewStatus: "revisado", reviewedAt: new Date(), reviewedBy: ctx.userId })
      .where(eq(assessmentSessions.id, session.id));
    await audit(tx, {
      workspaceId: ctx.workspace.id,
      actorType: "usuario",
      actorId: ctx.userId,
      action: "avaliacao.medidas_revisadas",
      objectType: "assessment_session",
      objectId: session.id,
      metadata: {
        aceitas: parsed.filter((d) => d.decision === "aceita").length,
        corrigidas: parsed.filter((d) => d.decision === "corrigida").length,
        descartadas: parsed.filter((d) => d.decision === "descartada").length,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Devolutiva
// ---------------------------------------------------------------------------

export async function publishFeedback(
  db: Db,
  ctx: WorkspaceContext,
  requestId: string,
  input: { body: string; includeMeasurements: boolean }
) {
  requireRole(ctx, "gestor", "profissional");
  const { request } = await getRequestForCare(db, ctx, requestId);
  const body = input.body.trim();
  if (body.length < 10) throw invalid("Escreva a orientação para a pessoa (mínimo de 10 caracteres).");
  if (body.length > 5000) throw invalid("Orientação muito longa (máximo de 5000 caracteres).");
  if (request.status === "cancelada") throw conflict("Avaliação cancelada.");

  const sessions = await db
    .select()
    .from(assessmentSessions)
    .where(and(eq(assessmentSessions.requestId, request.id), eq(assessmentSessions.status, "concluida")));
  if (sessions.some((s) => s.reviewStatus === "provisorio")) {
    throw conflict("Revise as medidas antes de publicar a devolutiva.");
  }
  if (input.includeMeasurements && sessions.length === 0) {
    throw invalid("Não há medidas concluídas para incluir.");
  }

  return db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    const [last] = await tx
      .select()
      .from(feedbacks)
      .where(eq(feedbacks.requestId, request.id))
      .orderBy(desc(feedbacks.version))
      .limit(1);
    if (last) {
      await tx.update(feedbacks).set({ status: "substituida" }).where(and(eq(feedbacks.requestId, request.id), ne(feedbacks.status, "substituida")));
    }
    const [fb] = await tx
      .insert(feedbacks)
      .values({
        workspaceId: ctx.workspace.id,
        requestId: request.id,
        personId: request.personId,
        authorId: ctx.userId,
        version: (last?.version ?? 0) + 1,
        body,
        includeMeasurements: input.includeMeasurements,
      })
      .returning();
    if (request.status !== "revisada") {
      await tx.update(assessmentRequests).set({ status: "revisada" }).where(eq(assessmentRequests.id, request.id));
    }
    await audit(tx, {
      workspaceId: ctx.workspace.id,
      actorType: "usuario",
      actorId: ctx.userId,
      action: last ? "devolutiva.nova_versao" : "devolutiva.publicada",
      objectType: "feedback",
      objectId: fb.id,
      metadata: { versao: fb.version },
    });
    return fb;
  });
}

// ---------------------------------------------------------------------------
// Medição presencial (registro do profissional)
// ---------------------------------------------------------------------------

export const manualSchema = z.object({
  personId: z.string().uuid(),
  episodeId: z.string().uuid().nullable().optional(),
  items: z
    .array(
      z.object({
        movement: z.string().trim().min(2).max(80),
        side: z.enum(["direito", "esquerdo", "bilateral", "nao_se_aplica"]),
        value: z.number(),
        unit: z.enum(["graus", "centimetros", "segundos", "repeticoes"]),
        instrument: z.enum(Object.keys(MANUAL_INSTRUMENTS) as [keyof typeof MANUAL_INSTRUMENTS, ...(keyof typeof MANUAL_INSTRUMENTS)[]]),
      })
    )
    .min(1, "Informe ao menos uma medida.")
    .max(20),
  notes: z.string().trim().max(1000).optional(),
});

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export async function recordManualMeasurements(db: Db, ctx: WorkspaceContext, input: z.input<typeof manualSchema>) {
  const data = manualSchema.parse(input);
  requireRole(ctx, "gestor", "profissional");
  const person = await requireCareAccess(db, ctx, data.personId);
  const protocol = getProtocol("registro-presencial")!;
  return db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    const [request] = await tx
      .insert(assessmentRequests)
      .values({
        workspaceId: ctx.workspace.id,
        personId: person.id,
        episodeId: data.episodeId ?? null,
        requestedBy: ctx.userId,
        protocolId: protocol.id,
        protocolVersion: protocol.version,
        instructions: data.notes || null,
        status: "revisada",
      })
      .returning();
    const [session] = await tx
      .insert(assessmentSessions)
      .values({
        workspaceId: ctx.workspace.id,
        requestId: request.id,
        personId: person.id,
        idempotencyKey: `manual-${request.id}`,
        status: "concluida",
        reviewStatus: "revisado",
        origin: "manual_profissional",
        protocolId: protocol.id,
        protocolVersion: protocol.version,
        appVersion: PLATFORM.appVersion,
        recordedBy: ctx.userId,
        completedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: ctx.userId,
      })
      .returning();
    const inserted = await tx
      .insert(measurements)
      .values(
        data.items.map((i) => ({
          workspaceId: ctx.workspace.id,
          sessionId: session.id,
          metricKey: `manual.${slug(i.movement)}.${i.unit}`,
          movement: i.movement,
          side: i.side,
          value: i.value,
          unit: i.unit,
          method: i.instrument,
          quality: "apta" as const,
        }))
      )
      .returning();
    await tx.insert(measurementReviews).values(
      inserted.map((m) => ({ workspaceId: ctx.workspace.id, measurementId: m.id, reviewerId: ctx.userId, decision: "aceita" as const }))
    );
    await audit(tx, {
      workspaceId: ctx.workspace.id,
      actorType: "usuario",
      actorId: ctx.userId,
      action: "medicao_presencial.registrada",
      objectType: "assessment_request",
      objectId: request.id,
      metadata: { medidas: inserted.length },
    });
    return request;
  });
}

// ---------------------------------------------------------------------------
// Linha do tempo e comparação
// ---------------------------------------------------------------------------

export async function getPersonTimeline(db: Db, ctx: WorkspaceContext, personId: string) {
  await requireCareAccess(db, ctx, personId);
  const requests = await db
    .select({ request: assessmentRequests, requesterName: users.name })
    .from(assessmentRequests)
    .innerJoin(users, eq(users.id, assessmentRequests.requestedBy))
    .where(and(eq(assessmentRequests.workspaceId, ctx.workspace.id), eq(assessmentRequests.personId, personId)))
    .orderBy(desc(assessmentRequests.createdAt));
  const ids = requests.map((r) => r.request.id);
  const sessions = ids.length
    ? await db
        .select()
        .from(assessmentSessions)
        .where(and(eq(assessmentSessions.workspaceId, ctx.workspace.id), inArray(assessmentSessions.requestId, ids)))
    : [];
  const fbs = ids.length
    ? await db
        .select()
        .from(feedbacks)
        .where(and(eq(feedbacks.workspaceId, ctx.workspace.id), inArray(feedbacks.requestId, ids), eq(feedbacks.status, "publicada")))
    : [];
  return requests.map(({ request, requesterName }) => ({
    request,
    requesterName,
    protocol: getProtocol(request.protocolId),
    sessions: sessions.filter((s) => s.requestId === request.id),
    publishedFeedback: fbs.find((f) => f.requestId === request.id) ?? null,
  }));
}

function toComparable(
  s: typeof assessmentSessions.$inferSelect,
  ms: MeasurementView[]
): ComparableMeasurement[] {
  return ms.map((m) => ({
    metricKey: m.metricKey,
    label: m.label,
    side: m.side,
    unit: m.unit,
    method: m.method,
    origin: s.origin,
    quality: m.quality,
    value: m.value,
    reviewDecision: (m.review?.decision ?? null) as ReviewDecision,
    correctedValue: m.review?.correctedValue ?? null,
    protocolId: s.protocolId,
    protocolVersion: s.protocolVersion,
    algorithmVersion: s.algorithmVersion,
    capturedAt: s.completedAt ?? s.startedAt,
  }));
}

/** Compara a sessão concluída mais recente desta avaliação com a da avaliação anterior (reavaliação). */
export async function compareWithPrevious(db: Db, ctx: WorkspaceContext, requestId: string) {
  const { request } = await getRequestForCare(db, ctx, requestId);
  if (!request.previousRequestId) return null;
  const latestCompleted = async (rid: string) => {
    const [s] = await db
      .select()
      .from(assessmentSessions)
      .where(
        and(
          eq(assessmentSessions.workspaceId, ctx.workspace.id),
          eq(assessmentSessions.requestId, rid),
          eq(assessmentSessions.status, "concluida")
        )
      )
      .orderBy(desc(assessmentSessions.completedAt))
      .limit(1);
    return s ?? null;
  };
  const [before, after] = await Promise.all([latestCompleted(request.previousRequestId), latestCompleted(request.id)]);
  if (!before || !after) return { before, after, rows: [] };
  const ms = await loadMeasurements(db, ctx.workspace.id, [before.id, after.id]);
  return {
    before,
    after,
    rows: compareSessions(toComparable(before, ms.get(before.id) ?? []), toComparable(after, ms.get(after.id) ?? [])),
  };
}
