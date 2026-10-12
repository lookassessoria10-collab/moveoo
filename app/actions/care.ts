"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { createPerson, addMember, setRelationship, createEpisode } from "@/lib/server/services/people";
import {
  cancelRequest,
  createAssessmentRequest,
  publishFeedback,
  recordManualMeasurements,
  reissueInvitation,
  revokeInvitation,
  reviewSession,
} from "@/lib/server/services/assessments";
import { createWorkspace, updateWorkspaceSettings } from "@/lib/server/services/workspaces";
import {
  getBaseUrl,
  getWorkspaceContext,
  requireUser,
  runAction,
  setWorkspaceCookie,
  type ActionState,
} from "@/lib/server/session";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createPersonAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspaceContext();
  let personId = "";
  const res = await runAction(async () => {
    const p = await createPerson(await getDb(), ctx, {
      fullName: str(fd, "fullName"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      preferredChannel: str(fd, "preferredChannel") as "email",
      city: str(fd, "city"),
      uf: str(fd, "uf") as "SP",
      episodeTitle: str(fd, "episodeTitle"),
      modality: str(fd, "modality") as "remoto",
      remoteSuitabilityNote: str(fd, "remoteSuitabilityNote"),
    });
    personId = p.id;
  });
  if (res?.error) return res;
  redirect(ctx.role === "assistente" ? "/painel/pessoas" : `/painel/pessoas/${personId}`);
}

export async function createEpisodeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspaceContext();
  const personId = str(fd, "personId");
  const res = await runAction(async () => {
    await createEpisode(await getDb(), ctx, personId, {
      title: str(fd, "title"),
      modality: str(fd, "modality") as "remoto",
      remoteSuitabilityNote: str(fd, "remoteSuitabilityNote"),
    });
  });
  revalidatePath(`/painel/pessoas/${personId}`);
  return res;
}

/** Cria solicitação + convite. O link só existe nesta resposta (o banco guarda só o hash). */
export async function createRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspaceContext();
  return runAction(async () => {
    const { request, url, whatsappUrl, invitation, code } = await createAssessmentRequest(
      await getDb(),
      ctx,
      {
        personId: str(fd, "personId"),
        protocolId: str(fd, "protocolId"),
        episodeId: str(fd, "episodeId") || null,
        instructions: str(fd, "instructions"),
        supervision: (str(fd, "supervision") || "sem_supervisao") as "sem_supervisao",
        dueInDays: Number(str(fd, "dueInDays") || 7),
        channel: str(fd, "channel") as "email",
        previousRequestId: str(fd, "previousRequestId") || null,
        // Formulário sempre envia a lista marcada; vazia = nenhum movimento (o serviço recusa).
        selectedItems: fd.has("itemsPresent") ? fd.getAll("selectedItems").map(String) : undefined,
      },
      getBaseUrl()
    );
    return { ok: true, data: { requestId: request.id, url, whatsappUrl, code, channel: invitation.channel } };
  });
}

export async function reissueInvitationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspaceContext();
  const requestId = str(fd, "requestId");
  const res = await runAction(async () => {
    const { url, whatsappUrl, invitation, code } = await reissueInvitation(await getDb(), ctx, requestId, str(fd, "channel") as "email", getBaseUrl());
    return { ok: true, data: { url, whatsappUrl, code, channel: invitation.channel } };
  });
  revalidatePath(`/painel/avaliacoes/${requestId}`);
  return res;
}

export async function revokeInvitationAction(fd: FormData): Promise<void> {
  const ctx = await getWorkspaceContext();
  await revokeInvitation(await getDb(), ctx, str(fd, "invitationId"));
  revalidatePath(`/painel/avaliacoes/${str(fd, "requestId")}`);
}

export async function cancelRequestAction(fd: FormData): Promise<void> {
  const ctx = await getWorkspaceContext();
  await cancelRequest(await getDb(), ctx, str(fd, "requestId"));
  revalidatePath(`/painel/avaliacoes/${str(fd, "requestId")}`);
}

export async function reviewSessionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspaceContext();
  const ids = fd.getAll("measurementId").map(String);
  const res = await runAction(async () => {
    await reviewSession(
      await getDb(),
      ctx,
      str(fd, "sessionId"),
      ids.map((id) => {
        const decision = str(fd, `decision_${id}`) as "aceita" | "corrigida" | "descartada";
        const raw = str(fd, `corrected_${id}`).replace(",", ".");
        return {
          measurementId: id,
          decision,
          correctedValue: decision === "corrigida" && raw !== "" ? Number(raw) : null,
          justification: str(fd, `justification_${id}`),
        };
      })
    );
  });
  revalidatePath(`/painel/avaliacoes/${str(fd, "requestId")}`);
  return res;
}

export async function publishFeedbackAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspaceContext();
  const requestId = str(fd, "requestId");
  const res = await runAction(async () => {
    await publishFeedback(await getDb(), ctx, requestId, {
      body: String(fd.get("body") ?? ""),
      includeMeasurements: fd.get("includeMeasurements") === "on",
    });
  });
  revalidatePath(`/painel/avaliacoes/${requestId}`);
  return res;
}

export async function manualMeasurementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspaceContext();
  let requestId = "";
  const rows = fd.getAll("movement").map(String);
  const res = await runAction(async () => {
    const items = rows
      .map((movement, i) => ({
        movement: movement.trim(),
        side: String(fd.getAll("side")[i]) as "direito",
        value: Number(String(fd.getAll("value")[i]).replace(",", ".")),
        unit: String(fd.getAll("unit")[i]) as "graus",
        instrument: String(fd.getAll("instrument")[i]) as "goniometro",
      }))
      .filter((i) => i.movement !== "");
    if (items.some((i) => !Number.isFinite(i.value))) return { error: "Informe valores numéricos." };
    const r = await recordManualMeasurements(await getDb(), ctx, {
      personId: str(fd, "personId"),
      episodeId: str(fd, "episodeId") || null,
      items,
      notes: str(fd, "notes"),
    });
    requestId = r.id;
  });
  if (res?.error) return res;
  redirect(`/painel/avaliacoes/${requestId}`);
}

export async function addMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspaceContext();
  const res = await runAction(async () => {
    await addMember(await getDb(), ctx, str(fd, "email"), str(fd, "role") as "profissional");
  });
  revalidatePath("/painel/equipe");
  return res;
}

export async function setRelationshipAction(fd: FormData): Promise<void> {
  const ctx = await getWorkspaceContext();
  const personId = str(fd, "personId");
  await setRelationship(await getDb(), ctx, personId, str(fd, "professionalUserId"), str(fd, "active") === "1");
  revalidatePath(`/painel/pessoas/${personId}`);
  revalidatePath("/painel/pessoas");
}

export async function updateWorkspaceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await getWorkspaceContext();
  const res = await runAction(async () => {
    await updateWorkspaceSettings(await getDb(), ctx, { name: str(fd, "name"), brandColor: str(fd, "brandColor") });
  });
  revalidatePath("/painel", "layout");
  return res;
}

export async function createWorkspaceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = "";
  const res = await runAction(async () => {
    const ws = await createWorkspace(await getDb(), user.id, {
      name: str(fd, "name"),
      kind: str(fd, "kind") as "clinica",
      environment: str(fd, "environment") as "demonstracao",
    });
    id = ws.id;
  });
  if (res?.error) return res;
  setWorkspaceCookie(id);
  redirect("/painel");
}
