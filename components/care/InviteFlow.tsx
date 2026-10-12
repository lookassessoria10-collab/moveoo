"use client";

import { useFormState } from "react-dom";
import { confirmInviteAction } from "@/app/actions/person";
import { FormError, SubmitButton } from "@/components/platform/forms";
import { inputClass } from "@/components/platform/ui";

/**
 * A pessoa digita o código de acesso que o profissional passou por outro
 * meio (pessoalmente, por ligação). Abrir o link sozinho não dá acesso a
 * nada — prévias de link não chegam a este formulário.
 */
export function InviteFlow({ token }: { token: string }) {
  const [state, action] = useFormState(confirmInviteAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <label htmlFor="code" className="block text-sm font-medium">
        Código de acesso
      </label>
      <p className="text-sm text-moveo-muted">
        Digite o código de 6 dígitos que o profissional passou para você. Ele protege seus dados caso este link seja
        encaminhado para outra pessoa.
      </p>
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
      <FormError state={state} />
      <SubmitButton className="w-full py-4 text-base" pendingLabel="Confirmando…">
        Entrar
      </SubmitButton>
      <p className="text-center text-xs text-moveo-muted">Não recebeu o código? Peça ao profissional que acompanha você.</p>
    </form>
  );
}
