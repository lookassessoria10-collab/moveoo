"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import {
  addNoteAction,
  addTagAction,
  deactivateUserAction,
  decideVerificationAction,
  deleteUserAction,
  recordReleaseAction,
  removeTagAction,
  updateAccountAction,
  updateProfileAction,
} from "@/app/actions/admin";
import type { ActionState } from "@/lib/server/session";
import { UFS } from "@/lib/care/vocabulary";
import { Field, inputClass, type ButtonVariant } from "./ui";
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

// ---------------------------------------------------------------------------
// Ficha do usuário (/admin/usuarios/[id])
// ---------------------------------------------------------------------------

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

function Saved({ state }: { state: ActionState }) {
  const message = state?.ok ? state.data?.message : null;
  return message ? <p className="text-sm text-emerald-700">{String(message)}</p> : null;
}

/** Botão de uma ação da ficha (campos escondidos) com o resultado ao lado. */
export function AdminActionButton({
  action,
  fields,
  label,
  variant = "ghost",
  pendingLabel = "Salvando…",
}: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  variant?: ButtonVariant;
  pendingLabel?: string;
}) {
  const [state, formAction] = useFormState(action, undefined);
  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant={variant} pendingLabel={pendingLabel}>
          {label}
        </SubmitButton>
        <Saved state={state} />
      </div>
      <FormError state={state} />
    </form>
  );
}

export function AccountForm({ userId, name, email }: { userId: string; name: string; email: string }) {
  const [state, action] = useFormState(updateAccountAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" htmlFor="acc-name">
          <input id="acc-name" name="name" defaultValue={name} required className={inputClass} />
        </Field>
        <Field label="E-mail" htmlFor="acc-email" hint="Trocar o e-mail exige nova confirmação; links enviados ao endereço antigo deixam de valer.">
          <input id="acc-email" name="email" type="email" defaultValue={email} required className={inputClass} />
        </Field>
      </div>
      <FormError state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="secondary" pendingLabel="Salvando…">
          Salvar conta
        </SubmitButton>
        <Saved state={state} />
      </div>
    </form>
  );
}

export function ProfileForm({
  userId,
  profile,
}: {
  userId: string;
  profile: { profession: string; councilRegion: string; registrationNumber: string; jurisdictionUf: string } | null;
}) {
  const [state, action] = useFormState(updateProfileAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Profissão" htmlFor="pro-profession">
          <select id="pro-profession" name="profession" defaultValue={profile?.profession ?? "fisioterapia"} className={inputClass}>
            <option value="fisioterapia">Fisioterapia (CREFITO)</option>
            <option value="educacao_fisica">Educação física (CREF)</option>
          </select>
        </Field>
        <Field label="Região" htmlFor="pro-region">
          <input id="pro-region" name="councilRegion" defaultValue={profile?.councilRegion} required className={inputClass} />
        </Field>
        <Field label="Número" htmlFor="pro-number">
          <input id="pro-number" name="registrationNumber" defaultValue={profile?.registrationNumber} required className={inputClass} />
        </Field>
        <Field label="UF" htmlFor="pro-uf">
          <select id="pro-uf" name="jurisdictionUf" defaultValue={profile?.jurisdictionUf ?? "SP"} className={inputClass}>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-xs text-moveo-muted">Mudar qualquer um destes dados volta a verificação para pendente.</p>
      <FormError state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="secondary" pendingLabel="Salvando…">
          {profile ? "Salvar registro" : "Criar registro profissional"}
        </SubmitButton>
        <Saved state={state} />
      </div>
    </form>
  );
}

export function TagForm({ userId, suggestions }: { userId: string; suggestions: string[] }) {
  const [state, action] = useFormState(addTagAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex gap-2">
        <input
          name="tag"
          list="tag-suggestions"
          required
          maxLength={30}
          placeholder="ex.: beta, lead, parceiro"
          aria-label="Nova etiqueta"
          className={inputClass}
        />
        <datalist id="tag-suggestions">
          {suggestions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <SubmitButton variant="secondary" pendingLabel="…">
          Adicionar
        </SubmitButton>
      </div>
      <FormError state={state} />
    </form>
  );
}

export function TagChip({ userId, tag }: { userId: string; tag: string }) {
  const [state, action] = useFormState(removeTagAction, undefined);
  return (
    <form action={action} className="inline-flex">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="tag" value={tag} />
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
        {tag}
        <button
          type="submit"
          aria-label={`Remover a etiqueta ${tag}`}
          title={state?.error ?? "Remover"}
          className="flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800"
        >
          ×
        </button>
      </span>
    </form>
  );
}

export function NoteForm({ userId }: { userId: string }) {
  const [state, action] = useFormState(addNoteAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <textarea
        name="body"
        rows={3}
        required
        maxLength={2000}
        placeholder="Ex.: ligou pedindo demonstração para a equipe da clínica."
        aria-label="Nova anotação"
        className={inputClass}
      />
      <FormError state={state} />
      <SubmitButton variant="secondary" pendingLabel="Salvando…">
        Adicionar anotação
      </SubmitButton>
    </form>
  );
}

export function DeactivateForm({ userId }: { userId: string }) {
  const [state, action] = useFormState(deactivateUserAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <Field label="Motivo" htmlFor="deactivate-reason" hint="Fica registrado na ficha. A pessoa não vê.">
        <input id="deactivate-reason" name="reason" required minLength={3} maxLength={300} className={inputClass} />
      </Field>
      <FormError state={state} />
      <SubmitButton variant="danger" pendingLabel="Desativando…">
        Desativar conta
      </SubmitButton>
    </form>
  );
}

export function DeleteUserForm({ userId, email }: { userId: string; email: string }) {
  const [state, action] = useFormState(deleteUserAction, undefined);
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === email;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <Field label="Para confirmar, digite o e-mail da conta" htmlFor="delete-confirm" hint={email}>
        <input
          id="delete-confirm"
          name="confirmEmail"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className={inputClass}
        />
      </Field>
      <FormError state={state} />
      <button
        type="submit"
        disabled={!matches}
        className="inline-flex items-center justify-center rounded-xl bg-moveo-danger px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Excluir definitivamente
      </button>
    </form>
  );
}
