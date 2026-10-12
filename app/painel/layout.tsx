import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { logoutAction, resendVerificationAction, switchWorkspaceAction } from "@/app/actions/auth";
import { PanelNav } from "@/components/platform/PanelNav";
import { MoveoLogo, Notice } from "@/components/platform/ui";
import { listUserWorkspaces } from "@/lib/server/services/authz";
import { getWorkspaceContext } from "@/lib/server/session";
import { isLocalMode } from "@/lib/server/environment";
import { vocabularyFor, PROFESSION_LABEL } from "@/lib/care/vocabulary";
import { ROLE_LABEL } from "@/lib/care/labels";

export const metadata: Metadata = { title: { default: "Painel", template: "%s · Moveo" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const ctx = await getWorkspaceContext();
  const workspaces = await listUserWorkspaces(await getDb(), ctx.userId);
  const v = vocabularyFor(ctx.profile?.profession);
  const persons = v.persons.charAt(0).toUpperCase() + v.persons.slice(1);

  const links = [
    { href: "/painel", label: "Hoje", exact: true },
    { href: "/painel/pessoas", label: persons },
    { href: "/painel/equipe", label: "Equipe" },
    { href: "/painel/espaco", label: "Espaço" },
    { href: "/painel/perfil", label: "Meu perfil" },
    ...(ctx.isPlatformAdmin ? [{ href: "/admin", label: "Administração" }] : []),
    ...(isLocalMode() ? [{ href: "/dev/caixa-de-saida", label: "Caixa de saída (local)" }] : []),
  ];

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="no-print border-b border-moveo-border bg-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:flex-none lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:block">
          <MoveoLogo />
          <form action={logoutAction} className="lg:hidden">
            <button className="text-sm text-moveo-muted hover:text-moveo-ink">Sair</button>
          </form>
        </div>

        <div className="px-4 pb-3">
          <form action={switchWorkspaceAction} className="rounded-xl bg-moveo-bg p-3">
            <label htmlFor="workspaceId" className="text-xs font-medium uppercase tracking-wide text-moveo-muted">
              Espaço
            </label>
            {workspaces.length > 1 ? (
              <div className="mt-1 flex gap-2">
                <select
                  id="workspaceId"
                  name="workspaceId"
                  defaultValue={ctx.workspace.id}
                  className="min-w-0 flex-1 rounded-lg border border-moveo-border bg-white px-2 py-1.5 text-sm"
                >
                  {workspaces.map((w) => (
                    <option key={w.workspace.id} value={w.workspace.id}>
                      {w.workspace.name}
                    </option>
                  ))}
                </select>
                <button className="rounded-lg bg-white px-2 text-xs font-medium ring-1 ring-moveo-border">Trocar</button>
              </div>
            ) : (
              <p className="mt-1 truncate text-sm font-semibold text-moveo-ink">{ctx.workspace.name}</p>
            )}
            <p className="mt-1 text-xs text-moveo-muted">
              {ROLE_LABEL[ctx.role]}
              {ctx.profile ? ` · ${PROFESSION_LABEL[ctx.profile.profession]}` : ""}
            </p>
          </form>
        </div>

        <PanelNav links={links} />

        <div className="hidden border-t border-moveo-border px-4 py-4 lg:mt-auto lg:block">
          <p className="truncate text-sm font-medium text-moveo-ink">{ctx.userName}</p>
          <form action={logoutAction} className="mt-2">
            <button className="text-sm text-moveo-muted hover:text-moveo-ink">Sair</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="no-print space-y-2 px-4 pt-4 sm:px-8">
          {ctx.workspace.environment === "demonstracao" && (
            <Notice tone="demo" title="Espaço de demonstração">
              Use apenas pessoas e dados fictícios. Os registros daqui nunca se misturam com atendimento real nem
              servem como evidência de validação.
            </Notice>
          )}
          {!ctx.emailVerified && (
            <Notice tone="warn" title="Confirme seu e-mail">
              <span>Enviamos um link de confirmação. Convites só podem ser enviados depois disso. </span>
              <form action={resendVerificationAction} className="inline">
                <button className="font-semibold underline">Reenviar link</button>
              </form>
            </Notice>
          )}
        </div>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

