"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import {
  loginAction,
  registerAction,
  requestResetAction,
  resetPasswordAction,
  verifyEmailAction,
} from "@/app/actions/auth";
import { ACCESS } from "@/config/platform";
import { UFS } from "@/lib/care/vocabulary";
import { Field, Notice, inputClass } from "./ui";
import { FormError, SubmitButton } from "./forms";
import { useState } from "react";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useFormState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-mail" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Senha" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <FormError state={state} />
      <SubmitButton className="w-full" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href="/recuperar-senha" className="text-moveo-muted hover:text-moveo-ink">
          Esqueci a senha
        </Link>
        <Link href="/cadastro" className="font-medium text-moveo-primary">
          Criar conta
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useFormState(registerAction, undefined);
  const [profession, setProfession] = useState<"fisioterapia" | "educacao_fisica">("fisioterapia");
  const council = profession === "fisioterapia" ? "CREFITO" : "CREF";
  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-moveo-ink">Sua profissão</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["fisioterapia", "Fisioterapia"],
              ["educacao_fisica", "Educação física"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-medium ${
                profession === value ? "border-moveo-primary bg-moveo-primarySoft text-moveo-primaryDark" : "border-moveo-border"
              }`}
            >
              <input
                type="radio"
                name="profession"
                value={value}
                checked={profession === value}
                onChange={() => setProfession(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" htmlFor="name">
          <input id="name" name="name" autoComplete="name" required className={inputClass} />
        </Field>
        <Field label="E-mail" htmlFor="email">
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
      </div>
      <Field label="Senha" htmlFor="password" hint={`Mínimo de ${ACCESS.passwordMinLength} caracteres.`}>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={ACCESS.passwordMinLength} required className={inputClass} />
      </Field>

      <div className="rounded-xl bg-moveo-bg p-4">
        <p className="text-sm font-medium text-moveo-ink">Registro profissional ({council})</p>
        <p className="mt-0.5 text-xs text-moveo-muted">
          Informar o número não equivale a verificação. O registro fica &quot;não verificado&quot; até a conferência
          manual; até lá, você usa o espaço de demonstração.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Região" htmlFor="councilRegion">
            <input id="councilRegion" name="councilRegion" placeholder={profession === "fisioterapia" ? "ex.: 3" : "ex.: 4/SP"} required className={inputClass} />
          </Field>
          <Field label="Número" htmlFor="registrationNumber">
            <input id="registrationNumber" name="registrationNumber" required className={inputClass} />
          </Field>
          <Field label="UF de atuação" htmlFor="jurisdictionUf">
            <select id="jurisdictionUf" name="jurisdictionUf" required className={inputClass} defaultValue="SP">
              {UFS.map((uf) => (
                <option key={uf}>{uf}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do seu espaço de atendimento" htmlFor="workspaceName" hint="Ex.: seu nome, a clínica ou o estúdio.">
          <input id="workspaceName" name="workspaceName" required className={inputClass} />
        </Field>
        <Field label="Tipo" htmlFor="workspaceKind">
          <select id="workspaceKind" name="workspaceKind" className={inputClass} defaultValue="autonomo">
            <option value="autonomo">Profissional autônomo</option>
            <option value="clinica">Clínica</option>
            <option value="estudio">Estúdio</option>
            <option value="academia">Academia</option>
          </select>
        </Field>
      </div>

      <FormError state={state} />
      <SubmitButton className="w-full" pendingLabel="Criando conta…">
        Criar conta
      </SubmitButton>
      <p className="text-center text-xs text-moveo-muted">
        Ao criar a conta você concorda com os termos de uso e o aviso de privacidade (minutas em revisão).
      </p>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action] = useFormState(verifyEmailAction, undefined);
  if (state?.ok) {
    return (
      <Notice tone="success" title="E-mail confirmado">
        <Link href="/painel" className="underline">
          Ir para o painel
        </Link>
      </Notice>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError state={state} />
      <SubmitButton className="w-full">Confirmar meu e-mail</SubmitButton>
    </form>
  );
}

export function RequestResetForm() {
  const [state, action] = useFormState(requestResetAction, undefined);
  if (state?.ok) {
    return (
      <Notice tone="success">
        Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. O link vale por 1 hora.
      </Notice>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <Field label="E-mail da conta" htmlFor="email">
        <input id="email" name="email" type="email" required className={inputClass} />
      </Field>
      <SubmitButton className="w-full">Enviar link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useFormState(resetPasswordAction, undefined);
  if (state?.ok) {
    return (
      <Notice tone="success" title="Senha alterada">
        Todas as sessões abertas foram encerradas.{" "}
        <Link href="/entrar" className="underline">
          Entrar
        </Link>
      </Notice>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Nova senha" htmlFor="password">
        <input id="password" name="password" type="password" minLength={ACCESS.passwordMinLength} required className={inputClass} />
      </Field>
      <Field label="Repita a nova senha" htmlFor="confirm">
        <input id="confirm" name="confirm" type="password" required className={inputClass} />
      </Field>
      <FormError state={state} />
      <SubmitButton className="w-full">Salvar nova senha</SubmitButton>
    </form>
  );
}
