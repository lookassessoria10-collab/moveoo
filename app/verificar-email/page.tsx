import type { Metadata } from "next";
import { AuthShell } from "@/components/platform/AuthShell";
import { VerifyEmailForm } from "@/components/platform/AuthForms";

export const metadata: Metadata = { title: "Confirmar e-mail" };

// A confirmação exige um clique (POST): pré-visualizadores de e-mail que abrem o link não consomem o token.
export default function VerifyEmailPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <AuthShell title="Confirmar e-mail">
      <VerifyEmailForm token={searchParams.token ?? ""} />
    </AuthShell>
  );
}
