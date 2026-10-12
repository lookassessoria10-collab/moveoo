/**
 * Ligação entre os serviços e o Next.js: cookies, usuário atual, espaço
 * atual e escopo da pessoa atendida. Toda página protegida chama uma das
 * funções `require*` — os layouts não bastam, porque não são
 * re-renderizados em toda navegação.
 */
import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { ACCESS, COOKIES } from "@/config/platform";
import { userFromSessionToken } from "./services/accounts";
import { listUserWorkspaces, loadWorkspaceContext, type WorkspaceContext } from "./services/authz";
import { personScopeFromToken, type PersonScope } from "./services/personAccess";
import { isDomainError } from "./errors";
import { isLocalMode } from "./environment";

// Em hospedagem local (rede Wi-Fi, sem HTTPS) o cookie não pode exigir conexão segura.
const secure = !isLocalMode();

export function getBaseUrl(): string {
  if (process.env.MOVEO_BASE_URL) return process.env.MOVEO_BASE_URL.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export function setUserSessionCookie(token: string) {
  cookies().set(COOKIES.user, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: ACCESS.userSessionDays * 86_400,
  });
}

export function setPersonSessionCookie(token: string) {
  cookies().set(COOKIES.person, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: ACCESS.personSessionHours * 3600,
  });
}

export function setWorkspaceCookie(workspaceId: string) {
  cookies().set(COOKIES.workspace, workspaceId, { httpOnly: true, sameSite: "lax", secure, path: "/" });
}

export const getCurrentUser = cache(async () => {
  const token = cookies().get(COOKIES.user)?.value;
  if (!token) return null;
  return userFromSessionToken(await getDb(), token);
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/painel");
  return user;
}

/** Espaço atual: o do cookie, se o usuário for membro ativo; senão, o primeiro. */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  const user = await requireUser();
  const db = await getDb();
  const preferred = cookies().get(COOKIES.workspace)?.value;
  if (preferred) {
    try {
      return await loadWorkspaceContext(db, user.id, preferred);
    } catch (e) {
      if (!isDomainError(e)) throw e;
    }
  }
  const list = await listUserWorkspaces(db, user.id);
  if (!list.length) redirect("/novo-espaco");
  return loadWorkspaceContext(db, user.id, list[0].workspace.id);
});

export const getPersonScope = cache(async (): Promise<PersonScope | null> => {
  const token = cookies().get(COOKIES.person)?.value;
  if (!token) return null;
  return personScopeFromToken(await getDb(), token);
});

export async function requirePersonScope(): Promise<PersonScope> {
  const scope = await getPersonScope();
  if (!scope) redirect("/acompanhamento/sem-acesso");
  return scope;
}

/** Para server actions: converte erros de domínio em mensagem para o formulário. */
export type ActionState = { error?: string; ok?: boolean; data?: Record<string, unknown> } | undefined;

export async function runAction(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (isDomainError(e)) return { error: e.message };
    if (e && typeof e === "object" && "issues" in e) {
      const issues = (e as { issues: { message: string }[] }).issues;
      return { error: issues[0]?.message ?? "Dados inválidos." };
    }
    // redirect()/notFound() do Next precisam continuar propagando
    throw e;
  }
}

/** Em páginas: acesso negado e inexistente viram 404 (não revelam existência). */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  const { notFound } = await import("next/navigation");
  try {
    return await p;
  } catch (e) {
    if (isDomainError(e) && (e.code === "nao_encontrado" || e.code === "acesso_negado")) notFound();
    throw e;
  }
}
