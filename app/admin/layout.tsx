import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PanelNav } from "@/components/platform/PanelNav";
import { MoveoLogo } from "@/components/platform/ui";
import { requireAdmin } from "@/lib/server/session";
import { logoutAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: { default: "Administração", template: "%s · Administração Moveo" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-moveo-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <MoveoLogo />
            <span className="rounded-full bg-moveo-ink px-2 py-0.5 text-xs font-semibold text-white">Administração</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/painel" className="text-moveo-muted hover:text-moveo-ink">
              Painel
            </Link>
            <form action={logoutAction}>
              <button className="text-moveo-muted hover:text-moveo-ink">Sair</button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-1 sm:px-5">
          <PanelNav
            vertical={false}
            links={[
              { href: "/admin", label: "Verificação profissional", exact: true },
              { href: "/admin/liberacoes", label: "Liberação por recurso" },
              { href: "/admin/espacos", label: "Espaços" },
              { href: "/admin/auditoria", label: "Auditoria" },
            ]}
          />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
