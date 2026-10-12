import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { PersonShell } from "@/components/care/PersonShell";
import { InviteFlow } from "@/components/care/InviteFlow";
import { getInvitationLanding } from "@/lib/server/services/personAccess";
import { MoveoLogo } from "@/components/platform/ui";

// Prévias de link (WhatsApp, e-mail) veem só isto: sem nome, sem dados clínicos.
export const metadata: Metadata = {
  title: "Convite",
  description: "Convite pessoal para uma atividade.",
  robots: { index: false, follow: false },
  openGraph: { title: "Convite pessoal", description: "Abra para continuar." },
};
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const landing = await getInvitationLanding(await getDb(), params.token);
  if (!landing) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <MoveoLogo />
        <h1 className="mt-8 text-xl font-bold">Este convite não está disponível</h1>
        <p className="mt-2 text-sm text-moveo-muted">
          O link pode ter expirado, sido substituído ou cancelado. Peça um novo link ao profissional que acompanha você.
        </p>
      </main>
    );
  }
  return (
    <PersonShell workspaceName={landing.workspaceName} brandColor={landing.brandColor} logoUrl={landing.logoUrl} isDemo={landing.isDemo}>
      <h1 className="text-2xl font-bold leading-tight">Você recebeu uma atividade</h1>
      <p className="mt-2 text-base text-moveo-muted">
        {landing.workspaceName} enviou uma atividade para você fazer pelo celular, no seu tempo.
      </p>
      <div className="mt-8">
        <InviteFlow token={params.token} />
      </div>
    </PersonShell>
  );
}
