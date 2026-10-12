/**
 * Utilitários das rotas JSON usadas pela pessoa atendida durante a
 * atividade (iniciar, enviar resultado, interromper).
 */
import "server-only";
import { NextResponse } from "next/server";
import { getDb, type Db } from "@/db/client";
import { isDomainError } from "./errors";
import { getPersonScope } from "./session";
import type { PersonScope } from "./services/personAccess";

const MAX_BODY_BYTES = 512 * 1024;
const STATUS: Record<string, number> = {
  nao_encontrado: 404,
  acesso_negado: 403,
  invalido: 422,
  conflito: 409,
  bloqueado_liberacao: 423,
};

export async function withPersonScope(
  req: Request,
  fn: (ctx: { db: Db; scope: PersonScope; body: Record<string, unknown> }) => Promise<object>
) {
  // Mesma origem: impede que outra página dispare ações com o cookie da pessoa.
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }
  const scope = await getPersonScope();
  if (!scope) return NextResponse.json({ error: "Sessão expirada. Abra o link do convite de novo." }, { status: 401 });
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Envio grande demais." }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
  }
  try {
    const result = await fn({ db: await getDb(), scope, body });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (isDomainError(e)) return NextResponse.json({ error: e.message }, { status: STATUS[e.code] ?? 400 });
    if (e && typeof e === "object" && "issues" in e) return NextResponse.json({ error: "Dados inválidos." }, { status: 422 });
    // Sem conteúdo clínico no log: só a mensagem técnica.
    console.error("[acompanhamento] erro inesperado:", e instanceof Error ? e.message : "desconhecido");
    return NextResponse.json({ error: "Erro inesperado. Tente de novo." }, { status: 500 });
  }
}
