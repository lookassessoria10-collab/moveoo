import { PageHeader, Panel } from "@/components/platform/ui";
import { PersonForm } from "@/components/platform/CareForms";
import { getWorkspaceContext } from "@/lib/server/session";
import { vocabularyFor } from "@/lib/care/vocabulary";

export const metadata = { title: "Cadastrar" };

export default async function NewPersonPage() {
  const ctx = await getWorkspaceContext();
  const v = vocabularyFor(ctx.profile?.profession);
  return (
    <>
      <PageHeader
        back={{ href: "/painel/pessoas", label: v.persons.charAt(0).toUpperCase() + v.persons.slice(1) }}
        title={`Cadastrar ${v.person}`}
        subtitle={
          ctx.role === "assistente"
            ? "Você cadastra; um gestor define qual profissional vai acompanhar."
            : `Você ficará vinculado como profissional responsável.`
        }
      />
      <Panel>
        <PersonForm personLabel={v.person} episodeLabel={v.episode} episodeHint={v.episodeHint} />
      </Panel>
    </>
  );
}
