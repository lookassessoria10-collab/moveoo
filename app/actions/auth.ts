"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { COOKIES } from "@/config/platform";
import {
  issueEmailVerification,
  login,
  logout,
  registerProfessional,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "@/lib/server/services/accounts";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { listUserWorkspaces, loadWorkspaceContext } from "@/lib/server/services/authz";
import {
  getBaseUrl,
  requireUser,
  runAction,
  setUserSessionCookie,
  setWorkspaceCookie,
  type ActionState,
} from "@/lib/server/session";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const db = await getDb();
  const res = await login(db, str(fd, "email"), str(fd, "password"));
  if (!res.ok) {
    return {
      error:
        res.reason === "bloqueado"
          ? "Acesso bloqueado temporariamente após várias tentativas. Tente de novo em alguns minutos ou redefina a senha."
          : "E-mail ou senha incorretos.",
    };
  }
  setUserSessionCookie(res.token);
  const next = str(fd, "next");
  if (next.startsWith("/painel") || next.startsWith("/admin")) redirect(next);
  // Administração da plataforma sem espaço próprio vai direto para /admin.
  const [user] = await db.select({ admin: users.isPlatformAdmin }).from(users).where(eq(users.id, res.userId));
  if (user?.admin && (await listUserWorkspaces(db, res.userId)).length === 0) redirect("/admin");
  redirect("/painel");
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const db = await getDb();
  const result = await runAction(async () => {
    const { workspace } = await registerProfessional(
      db,
      {
        name: str(fd, "name"),
        email: str(fd, "email"),
        password: str(fd, "password"),
        profession: str(fd, "profession") as "fisioterapia",
        councilRegion: str(fd, "councilRegion"),
        registrationNumber: str(fd, "registrationNumber"),
        jurisdictionUf: str(fd, "jurisdictionUf") as "SP",
        workspaceName: str(fd, "workspaceName"),
        workspaceKind: str(fd, "workspaceKind") as "autonomo",
      },
      getBaseUrl()
    );
    const session = await login(db, str(fd, "email"), str(fd, "password"));
    if (session.ok) setUserSessionCookie(session.token);
    setWorkspaceCookie(workspace.id);
  });
  if (result?.error) return result;
  redirect("/painel?bemvindo=1");
}

export async function logoutAction(): Promise<void> {
  const token = cookies().get(COOKIES.user)?.value;
  if (token) await logout(await getDb(), token);
  cookies().delete(COOKIES.user);
  cookies().delete(COOKIES.workspace);
  redirect("/");
}

export async function verifyEmailAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ok = await verifyEmail(await getDb(), str(fd, "token"));
  return ok ? { ok: true } : { error: "Link inválido, já utilizado ou expirado. Peça um novo no painel." };
}

export async function resendVerificationAction(): Promise<void> {
  const user = await requireUser();
  if (!user.emailVerifiedAt) await issueEmailVerification(await getDb(), user.id, user.email, getBaseUrl());
  redirect("/painel?verificacao=reenviada");
}

export async function requestResetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requestPasswordReset(await getDb(), str(fd, "email"), getBaseUrl());
  return { ok: true };
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const db = await getDb();
  if (str(fd, "password") !== str(fd, "confirm")) return { error: "As senhas não conferem." };
  return runAction(async () => {
    const ok = await resetPassword(db, str(fd, "token"), str(fd, "password"));
    if (!ok) return { error: "Link inválido, já utilizado ou expirado." };
    return { ok: true };
  });
}

export async function switchWorkspaceAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const id = str(fd, "workspaceId");
  // Só troca se o usuário for membro ativo (lança erro caso contrário).
  await loadWorkspaceContext(await getDb(), user.id, id);
  setWorkspaceCookie(id);
  redirect("/painel");
}
