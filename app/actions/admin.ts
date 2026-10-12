"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { decideVerification, recordReleaseDecision } from "@/lib/server/services/admin";
import {
  addUserNote,
  addUserTag,
  confirmEmailManually,
  deactivateUser,
  deleteUser,
  deleteUserNote,
  reactivateUser,
  removeUserTag,
  setPlatformAdmin,
  unlockUser,
  updateAccount,
  updateProfessionalProfile,
} from "@/lib/server/services/adminUsers";
import { requireAdmin, runAction, type ActionState } from "@/lib/server/session";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function decideVerificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await runAction(async () => {
    await decideVerification(await getDb(), admin.id, {
      userId: str(fd, "userId"),
      status: str(fd, "status") as "verificado",
      source: str(fd, "source"),
      note: str(fd, "note"),
    });
  });
  revalidatePath("/admin/verificacao");
  revalidatePath(`/admin/usuarios/${str(fd, "userId")}`);
  return res;
}

export async function recordReleaseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await runAction(async () => {
    await recordReleaseDecision(await getDb(), admin.id, {
      featureKey: str(fd, "featureKey"),
      algorithmVersion: str(fd, "algorithmVersion"),
      protocolVersion: str(fd, "protocolVersion"),
      state: str(fd, "state") as "desenvolvimento",
      scope: str(fd, "scope"),
      evidence: str(fd, "evidence"),
    });
  });
  revalidatePath("/admin/liberacoes");
  return res;
}

// ---------------------------------------------------------------------------
// Gestão de usuários (/admin/usuarios)
// ---------------------------------------------------------------------------

const ok = (message: string): ActionState => ({ ok: true, data: { message } });

/** Executa a alteração na ficha do usuário e atualiza a ficha e a lista. */
async function onUser(fd: FormData, fn: (adminId: string, userId: string) => Promise<ActionState | void>): Promise<ActionState> {
  const admin = await requireAdmin();
  const userId = str(fd, "userId");
  const res = await runAction(async () => fn(admin.id, userId));
  revalidatePath(`/admin/usuarios/${userId}`);
  revalidatePath("/admin/usuarios");
  return res;
}

export async function updateAccountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return onUser(fd, async (adminId, userId) => {
    const { changed } = await updateAccount(await getDb(), adminId, { userId, name: str(fd, "name"), email: str(fd, "email") });
    if (!changed.length) return ok("Nada mudou.");
    return ok(changed.includes("email") ? "Salvo. O novo e-mail precisa ser confirmado." : "Salvo.");
  });
}

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return onUser(fd, async (adminId, userId) => {
    const r = await updateProfessionalProfile(await getDb(), adminId, {
      userId,
      profession: str(fd, "profession") as "fisioterapia",
      councilRegion: str(fd, "councilRegion"),
      registrationNumber: str(fd, "registrationNumber"),
      jurisdictionUf: str(fd, "jurisdictionUf") as "SP",
    });
    if (!r.changed.length) return ok("Nada mudou.");
    return ok(r.verificationReset ? "Salvo. A verificação voltou para pendente — confira o novo registro." : "Salvo.");
  });
}

export async function confirmEmailAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return onUser(fd, async (adminId, userId) => {
    await confirmEmailManually(await getDb(), adminId, userId);
    return ok("E-mail marcado como confirmado.");
  });
}

export async function unlockUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return onUser(fd, async (adminId, userId) => {
    await unlockUser(await getDb(), adminId, userId);
    return ok("Acesso destravado.");
  });
}

export async function setAdminAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return onUser(fd, async (adminId, userId) => {
    const makeAdmin = str(fd, "makeAdmin") === "1";
    await setPlatformAdmin(await getDb(), adminId, userId, makeAdmin);
    return ok(makeAdmin ? "Acesso de administração concedido." : "Acesso de administração removido.");
  });
}

export async function deactivateUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return onUser(fd, async (adminId, userId) => {
    await deactivateUser(await getDb(), adminId, { userId, reason: str(fd, "reason") });
    return ok("Conta desativada.");
  });
}

export async function reactivateUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return onUser(fd, async (adminId, userId) => {
    await reactivateUser(await getDb(), adminId, userId);
    return ok("Conta reativada.");
  });
}

export async function deleteUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const res = await runAction(async () => {
    await deleteUser(await getDb(), admin.id, { userId: str(fd, "userId"), confirmEmail: str(fd, "confirmEmail") });
  });
  if (res?.error) return res;
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?excluido=1");
}

export async function addTagAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return onUser(fd, async (adminId, userId) => {
    await addUserTag(await getDb(), adminId, userId, str(fd, "tag"));
  });
}

export async function removeTagAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return onUser(fd, async (adminId, userId) => {
    await removeUserTag(await getDb(), adminId, userId, str(fd, "tag"));
  });
}

export async function addNoteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return onUser(fd, async (adminId, userId) => {
    await addUserNote(await getDb(), adminId, { userId, body: str(fd, "body") });
  });
}

export async function deleteNoteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return onUser(fd, async (adminId) => {
    await deleteUserNote(await getDb(), adminId, str(fd, "noteId"));
  });
}
