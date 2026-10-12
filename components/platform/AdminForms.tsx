"use client";

import { useFormState } from "react-dom";
import { decideVerificationAction, recordReleaseAction } from "@/app/actions/admin";
import { Field, inputClass } from "./ui";
import { FormError, SubmitButton } from "./forms";

export function VerificationForm({ userId }: { userId: string }) {
  const [state, action] = useFormState(decideVerificationAction, undefined);
  if (state?.ok) return <p className="text-sm text-emerald-700">Decisão registrada.</p>;
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_2fr_2fr_auto] sm:items-end">
      <input type="hidden" name="userId" value={userId} />
      <select name="status" className={inputClass} aria-label="Decisão" defaultValue="verificado">
        <option value="verificado">Verificado</option>
        <option value="recusado">Recusado</option>
        <option value="pendente">Voltar a pendente</option>
      </select>
      <input name="source" required placeholder="Fonte consultada (obrigatória)" className={inputClass} aria-label="Fonte" />
      <input name="note" placeholder="Observação" className={inputClass} aria-label="Observação" />
      <SubmitButton variant="secondary">Registrar</SubmitButton>
      <div className="sm:col-span-4">
        <FormError state={state} />
      </div>
    </form>
  );
}

export function ReleaseForm({
  options,
}: {
  options: { featureKey: string; label: string; algorithmVersion: string; protocolVersion: string }[];
}) {
  const [state, action] = useFormState(recordReleaseAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <Field label="Recurso e versões" htmlFor="rel-key">
        <select
          id="rel-key"
          className={inputClass}
          onChange={(e) => {
            const o = options[Number(e.target.value)];
            const form = e.target.form!;
            (form.elements.namedItem("featureKey") as HTMLInputElement).value = o.featureKey;
            (form.elements.namedItem("algorithmVersion") as HTMLInputElement).value = o.algorithmVersion;
            (form.elements.namedItem("protocolVersion") as HTMLInputElement).value = o.protocolVersion;
          }}
        >
          {options.map((o, i) => (
            <option key={o.featureKey} value={i}>
              {o.label} — protocolo {o.protocolVersion}, algoritmo {o.algorithmVersion}
            </option>
          ))}
        </select>
      </Field>
      <input type="hidden" name="featureKey" defaultValue={options[0]?.featureKey} />
      <input type="hidden" name="algorithmVersion" defaultValue={options[0]?.algorithmVersion} />
      <input type="hidden" name="protocolVersion" defaultValue={options[0]?.protocolVersion} />
      <Field label="Novo estado" htmlFor="rel-state">
        <select id="rel-state" name="state" className={inputClass} defaultValue="demonstracao">
          <option value="desenvolvimento">Em desenvolvimento</option>
          <option value="demonstracao">Somente demonstração</option>
          <option value="em_validacao">Em validação</option>
          <option value="liberado">Liberado para escopo específico</option>
          <option value="suspenso">Suspenso</option>
        </select>
      </Field>
      <Field label="Escopo (público, indicação, restrições)" htmlFor="rel-scope">
        <textarea id="rel-scope" name="scope" rows={2} required className={inputClass} />
      </Field>
      <Field
        label="Evidências conferidas"
        htmlFor="rel-evidence"
        hint="Referencie relatórios de validação, parecer regulatório e responsável. O sistema registra a decisão humana; não emite aprovação."
      >
        <textarea id="rel-evidence" name="evidence" rows={3} required className={inputClass} />
      </Field>
      <FormError state={state} />
      {state?.ok && <p className="text-sm text-emerald-700">Decisão registrada.</p>}
      <SubmitButton>Registrar decisão</SubmitButton>
    </form>
  );
}
