"use client";

import { useFormState } from "react-dom";
import { recordConsentsAction } from "@/app/actions/person";
import { FormError, SubmitButton } from "@/components/platform/forms";
import { inputClass } from "@/components/platform/ui";

export function ConsentForm({ docs }: { docs: { key: string; title: string; body: string; version: string; accepted: boolean }[] }) {
  const [state, action] = useFormState(recordConsentsAction, undefined);
  return (
    <form action={action} className="space-y-5">
      {docs.map((d) => (
        <section key={d.key} className="rounded-2xl border border-moveo-border bg-white p-4">
          <input type="hidden" name="key" value={d.key} />
          <h2 className="font-semibold">{d.title}</h2>
          <div className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-moveo-bg p-3 text-sm leading-relaxed text-moveo-ink">
            {d.body}
          </div>
          <p className="mt-1 text-xs text-moveo-muted">Versão {d.version}</p>
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input type="checkbox" name={`accept_${d.key}`} defaultChecked={d.accepted} className="mt-0.5 h-5 w-5" />
            <span>Li e aceito</span>
          </label>
        </section>
      ))}
      <div className="space-y-1.5">
        <label htmlFor="signerName" className="block text-sm font-medium">
          Seu nome completo
        </label>
        <input id="signerName" name="signerName" required autoComplete="name" className={inputClass} />
        <p className="text-xs text-moveo-muted">
          Se você é responsável por outra pessoa (por exemplo, um menor de idade), não continue: este acompanhamento ainda
          não está disponível nessa situação.
        </p>
      </div>
      <FormError state={state} />
      <SubmitButton className="w-full py-4 text-base" pendingLabel="Registrando…">
        Registrar e continuar
      </SubmitButton>
    </form>
  );
}
