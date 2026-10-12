import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { assessmentRequests, careEpisodes } from "@/db/schema";
import { Notice, PageHeader, Panel } from "@/components/platform/ui";
import { RequestForm } from "@/components/platform/CareForms";
import { requireCareAccess } from "@/lib/server/services/authz";
import { assertProtocolExecutable } from "@/lib/server/services/core";
import { isDomainError } from "@/lib/server/errors";
import { CAMERA_PROTOCOLS } from "@/lib/care/protocols";
import { getWorkspaceContext, orNotFound } from "@/lib/server/session";

export const metadata = { title: "Solicitar avaliação" };

export default async function RequestPage({ params, searchParams }: { params: { id: string }; searchParams: { reavaliar?: string } }) {
  const ctx = await getWorkspaceContext();
  const db = await getDb();
  const person = await orNotFound(requireCareAccess(db, ctx, params.id));
  const episodes = await db
    .select({ id: careEpisodes.id, title: careEpisodes.title })
    .from(careEpisodes)
    .where(and(eq(careEpisodes.workspaceId, ctx.workspace.id), eq(careEpisodes.personId, person.id), eq(careEpisodes.status, "ativo")));

  let previous: typeof assessmentRequests.$inferSelect | null = null;
  if (searchParams.reavaliar) {
    [previous] = await db
      .select()
      .from(assessmentRequests)
      .where(
        and(
          eq(assessmentRequests.id, searchParams.reavaliar),
          eq(assessmentRequests.workspaceId, ctx.workspace.id),
          eq(assessmentRequests.personId, person.id)
        )
      );
  }

  const protocols = await Promise.all(
    CAMERA_PROTOCOLS.map(async (p) => {
      let blocked: string | null = null;
      try {
        await assertProtocolExecutable(db, ctx.workspace, p.id);
      } catch (e) {
        if (!isDomainError(e)) throw e;
        blocked = e.message;
      }
      return { id: p.id, title: p.title, capture: p.capture, blocked };
    })
  );

  return (
    <>
      <PageHeader
        back={{ href: `/painel/pessoas/${person.id}`, label: person.fullName }}
        title={previous ? "Solicitar reavaliação" : "Solicitar avaliação"}
        subtitle={`Para ${person.fullName}. A pessoa recebe um convite individual com prazo.`}
      />
      {!ctx.emailVerified && (
        <div className="mb-4">
          <Notice tone="warn">Confirme seu e-mail para poder enviar convites.</Notice>
        </div>
      )}
      {previous && (
        <div className="mb-4">
          <Notice tone="info">Reavaliação usa o mesmo protocolo da avaliação anterior, para que os resultados possam ser comparados.</Notice>
        </div>
      )}
      <Panel>
        <RequestForm
          personId={person.id}
          protocols={protocols}
          episodes={episodes}
          defaultChannel={person.preferredChannel}
          hasEmail={!!person.email}
          hasPhone={!!person.phone}
          previousRequestId={previous?.id}
          fixedProtocolId={previous?.protocolId}
        />
      </Panel>
    </>
  );
}
