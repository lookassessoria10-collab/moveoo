import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/platform/AuthShell";
import { RegisterForm } from "@/components/platform/AuthForms";
import { getCurrentUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/painel");
  return (
    <AuthShell
      wide
      title="Criar conta de profissional"
      subtitle={
        <>
          Para fisioterapeutas e profissionais de educação física. Já tem conta?{" "}
          <Link href="/entrar" className="font-medium text-moveo-primary">
            Entrar
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
