"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { COOKIES } from "@/config/platform";
import { confirmInvitation, recordConsent, revokePersonSession } from "@/lib/server/services/personAccess";
import { requirePersonScope, runAction, setPersonSessionCookie, type ActionState } from "@/lib/server/session";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function confirmInviteAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await confirmInvitation(await getDb(), str(fd, "token"), str(fd, "code"));
  if (!r.ok) {
    const msg = {
      codigo: "Código incorreto. Confira com o profissional e tente de novo.",
      expirado: "Este convite não é mais válido. Peça um novo link ao profissional.",
      bloqueado: "Muitas tentativas com código errado. Peça um novo link e código ao profissional.",
    }[r.reason];
    return { error: msg, data: prev?.data };
  }
  setPersonSessionCookie(r.sessionToken);
  redirect("/acompanhamento");
}

export async function recordConsentsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const scope = await requirePersonScope();
  const db = await getDb();
  const keys = fd.getAll("key").map(String);
  const signer = str(fd, "signerName");
  const res = await runAction(async () => {
    for (const key of keys) {
      await recordConsent(db, scope, { key, decision: fd.get(`accept_${key}`) === "on" ? "aceito" : "recusado", signerName: signer });
    }
  });
  if (res?.error) return res;
  if (keys.some((k) => fd.get(`accept_${k}`) !== "on")) {
    return { error: "Sem todos os aceites, a atividade não pode ser feita por aqui. Sua escolha foi registrada; avise o profissional." };
  }
  redirect(`/acompanhamento/avaliacao/${scope.request.id}`);
}

export async function personLogoutAction(): Promise<void> {
  const token = cookies().get(COOKIES.person)?.value;
  if (token) await revokePersonSession(await getDb(), token);
  cookies().delete(COOKIES.person);
  redirect("/acompanhamento/sem-acesso?saiu=1");
}
