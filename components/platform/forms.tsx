"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { buttonClass, type ButtonVariant } from "./ui";

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  pendingLabel = "Enviando…",
  name,
  value,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  pendingLabel?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={buttonClass(variant, className)} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormError({ state }: { state: { error?: string } | undefined }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">
      {state.error}
    </p>
  );
}
