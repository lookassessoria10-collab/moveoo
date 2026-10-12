import Link from "next/link";
import type { ReactNode } from "react";
import { MoveoLogo } from "./ui";

export function AuthShell({ title, subtitle, children, wide = false }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-moveo-bg px-4 py-10">
      <Link href="/" className="mb-8">
        <MoveoLogo />
      </Link>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl border border-moveo-border bg-white p-6 shadow-sm sm:p-8`}>
        <h1 className="text-xl font-bold text-moveo-ink">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-moveo-muted">{subtitle}</div>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
