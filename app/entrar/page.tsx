import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/platform/AuthShell";
import { LoginForm } from "@/components/platform/AuthForms";
import { getCurrentUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  if (await getCurrentUser()) redirect("/painel");
  return (
    <AuthShell title="Entrar no Moveo" subtitle="Área de profissionais. Pacientes e alunos acessam pelo link do convite.">
      <LoginForm next={searchParams.next} />
    </AuthShell>
  );
}
