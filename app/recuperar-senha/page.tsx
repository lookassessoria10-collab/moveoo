import type { Metadata } from "next";
import { AuthShell } from "@/components/platform/AuthShell";
import { RequestResetForm } from "@/components/platform/AuthForms";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function RequestResetPage() {
  return (
    <AuthShell title="Recuperar acesso" subtitle="Enviaremos um link para criar uma nova senha.">
      <RequestResetForm />
    </AuthShell>
  );
}
