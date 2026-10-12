import type { ReactNode } from "react";

/** Moldura das telas da pessoa atendida: identidade do espaço que convidou, discreta e legível no celular. */
export function PersonShell({
  workspaceName,
  brandColor,
  logoUrl,
  isDemo,
  children,
  footer,
}: {
  workspaceName: string;
  brandColor: string;
  logoUrl?: string | null;
  isDemo?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-6">
      <header className="mb-6 flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={workspaceName} className="h-9 w-auto" />
        ) : (
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-xl text-base font-bold text-white"
            style={{ backgroundColor: brandColor }}
          >
            {workspaceName.slice(0, 1)}
          </span>
        )}
        <span className="text-base font-semibold text-moveo-ink">{workspaceName}</span>
      </header>
      {isDemo && (
        <p className="mb-4 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-800 ring-1 ring-inset ring-violet-200">
          Ambiente de demonstração — dados fictícios.
        </p>
      )}
      <div className="flex-1">{children}</div>
      <footer className="mt-10 space-y-2 text-center text-xs text-moveo-muted">
        {footer}
        <p>
          Plataforma Moveo · <a href="/privacidade" className="underline">Privacidade</a>
        </p>
      </footer>
    </main>
  );
}
