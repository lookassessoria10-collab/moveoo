import Link from "next/link";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/care/labels";

const TONE: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warn: "bg-amber-50 text-amber-900 ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  demo: "bg-violet-50 text-violet-800 ring-violet-200",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm text-moveo-muted hover:text-moveo-ink">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-moveo-ink">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-moveo-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-moveo-border bg-white p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold text-moveo-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-moveo-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-moveo-border bg-moveo-bg/60 px-4 py-8 text-center">
      <p className="font-medium text-moveo-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-moveo-muted">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${TONE[tone]}`} role={tone === "danger" ? "alert" : "status"}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}

const BTN = {
  primary: "bg-moveo-primary text-white hover:bg-moveo-primaryDark",
  secondary: "bg-moveo-primarySoft text-moveo-primaryDark hover:bg-moveo-border",
  ghost: "border border-moveo-border bg-white text-moveo-ink hover:bg-moveo-bg",
  danger: "bg-moveo-danger text-white hover:opacity-90",
};
export type ButtonVariant = keyof typeof BTN;
export const buttonClass = (v: ButtonVariant = "primary", extra = "") =>
  `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BTN[v]} ${extra}`;

export function LinkButton({
  href,
  variant = "primary",
  children,
  className = "",
}: {
  href: string;
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

export const inputClass =
  "block w-full rounded-xl border border-moveo-border bg-white px-3 py-2.5 text-sm text-moveo-ink shadow-sm placeholder:text-slate-400 focus:border-moveo-primary focus:outline-none focus:ring-2 focus:ring-moveo-primary/30";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-moveo-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-moveo-muted">{hint}</p>}
    </div>
  );
}

export function DefinitionList({ items }: { items: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.term}>
          <dt className="text-xs font-medium uppercase tracking-wide text-moveo-muted">{i.term}</dt>
          <dd className="mt-0.5 text-moveo-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MoveoLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight text-moveo-ink ${className}`}>
      <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-moveo-primary text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 18 L8 8 L12 14 L16 6 L21 18" />
        </svg>
      </span>
      <span className="text-lg">Moveo</span>
    </span>
  );
}
