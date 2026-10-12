import { getDb } from "@/db/client";
import { eq } from "drizzle-orm";
import { professionalProfiles } from "@/db/schema";
import { AuthShell } from "@/components/platform/AuthShell";
import { NewWorkspaceForm } from "@/components/platform/CareForms";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Novo espaço" };

export default async function NewWorkspacePage() {
  const user = await requireUser();
  const [profile] = await (await getDb()).select().from(professionalProfiles).where(eq(professionalProfiles.userId, user.id));
  return (
    <AuthShell wide title="Crie um espaço de atendimento" subtitle="Você não participa de nenhum espaço ativo.">
      {user.isPlatformAdmin && (
        <p className="mb-4 text-sm">
          <a href="/admin" className="font-medium text-moveo-primary">
            Ir para a administração da plataforma →
          </a>
        </p>
      )}
      <NewWorkspaceForm canCreateReal={profile?.verificationStatus === "verificado"} />
    </AuthShell>
  );
}
