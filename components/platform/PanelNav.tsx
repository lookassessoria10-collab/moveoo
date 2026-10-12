"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PanelNav({
  links,
  vertical = true,
}: {
  links: { href: string; label: string; exact?: boolean }[];
  /** Vertical a partir de telas largas (barra lateral do painel); falso = sempre horizontal. */
  vertical?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação do painel" className={`no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 ${vertical ? "lg:flex-col lg:overflow-visible lg:pb-0" : ""}`}>
      {links.map((l) => {
        const active = l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-moveo-primarySoft text-moveo-primaryDark" : "text-moveo-muted hover:bg-moveo-bg hover:text-moveo-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
