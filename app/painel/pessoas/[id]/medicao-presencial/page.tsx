import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { careEpisodes } from "@/db/schema";
import { PageHeader, Panel } from "@/components/platform/ui";
import { ManualMeasurementForm } from "@/components/platform/CareForms";
import { requireCareAccess } from "@/lib/server/services/authz";
import { getWorkspaceContext, orNotFound } from "@/lib/server/session";

export const metadata = { title: "Medição presencial" };

export default async function ManualPage({ params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext();
  const db = await getDb();
  const person = await orNotFound(requireCareAccess(db, ctx, params.id));
  const episodes = await db
    .select({ id: careEpisodes.id, title: careEpisodes.title })
    .from(careEpisodes)
    .where(and(eq(careEpisodes.workspaceId, ctx.workspace.id), eq(careEpisodes.personId, person.id), eq(careEpisodes.status, "ativo")));
  return (
    <>
      <PageHeader
        back={{ href: `/painel/pessoas/${person.id}`, label: person.fullName }}
        title="Registrar medição presencial"
        subtitle="Medidas feitas por você, identificadas com o instrumento. Nunca são apresentadas como mensuração automática."
      />
      <Panel>
        <ManualMeasurementForm personId={person.id} episodes={episodes} />
      </Panel>
    </>
  );
}
