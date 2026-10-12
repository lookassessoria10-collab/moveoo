"use client";

import { useFormState } from "react-dom";
import { beginInviteAction, confirmInviteAction } from "@/app/actions/person";
import { FormError, SubmitButton } from "@/components/platform/forms";
import { inputClass } from "@/components/platform/ui";

/**
 * Passo 1: clique explícito em "Continuar" (prévias de link não chegam aqui).
 * Passo 2: código enviado ao contato cadastrado.
 */
export function InviteFlow({ token }: { token: string }) {
  const [begin, beginAction] = useFormState(beginInviteAction, undefined);
  const [confirm, confirmAction] = useFormState(confirmInviteAction, undefined);
  const sent = begin?.ok ? (begin.data as { masked: string; channel: string }) : null;

  if (!sent) {
    return (
      <form action={beginAction} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <p className="text-sm text-moveo-muted">
          Para proteger seus dados, vamos enviar um código de 6 dígitos para o contato que você informou ao profissional.
        </p>
        <FormError state={begin} />
        <SubmitButton className="w-full py-4 text-base" pendingLabel="Enviando código…">
          Continuar
        </SubmitButton>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-moveo-ink">
        Enviamos um código para <strong>{sent.masked}</strong>. Ele vale por 10 minutos.
      </p>
      <form action={confirmAction} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <label htmlFor="code" className="block text-sm font-medium">
          Código de acesso
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          className={`${inputClass} text-center text-2xl tracking-[0.4em]`}
        />
        <FormError state={confirm} />
        <SubmitButton className="w-full py-4 text-base" pendingLabel="Confirmando…">
          Entrar
        </SubmitButton>
      </form>
      <form action={beginAction}>
        <input type="hidden" name="token" value={token} />
        <button className="text-sm text-moveo-muted underline">Enviar outro código</button>
      </form>
    </div>
  );
}
