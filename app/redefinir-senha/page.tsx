import type { Metadata } from "next";
import { AuthShell } from "@/components/platform/AuthShell";
import { ResetPasswordForm } from "@/components/platform/AuthForms";

export const metadata: Metadata = { title: "Nova senha" };

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <AuthShell title="Criar nova senha">
      <ResetPasswordForm token={searchParams.token ?? ""} />
    </AuthShell>
  );
}
