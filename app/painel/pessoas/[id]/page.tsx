import Link from "next/link";
import { getDb } from "@/db/client";
import { Badge, DefinitionList, EmptyState, LinkButton, PageHeader, Panel } from "@/components/platform/ui";
import { EpisodeForm } from "@/components/platform/CareForms";
import { getPersonForCare } from "@/lib/server/services/people";
import { getPersonTimeline } from "@/lib/server/services/assessments";
import { getWorkspaceContext, orNotFound } from "@/lib/server/session";
import { vocabularyFor } from "@/lib/care/vocabulary";
import { CHANNEL_LABEL, ORIGIN_LABEL, REQUEST_STATUS, SESSION_STATUS, formatDate } from "@/lib/care/labels";

export const metadata = { title: "Ficha" };

const MODALITY: Record<string, string> = { presencial: "Presencial", remoto: "A distância", hibrido: "Híbrido" };

export default async function PersonPage({ params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext();
  const db = await getDb();
  const { person, episodes, consents } = await orNotFound(getPersonForCare(db, ctx, params.id));
  const timeline = await getPersonTimeline(db, ctx, person.id);
  const v = vocabularyFor(ctx.profile?.profession);

  return (
    <>
      <PageHeader
        back={{ href: "/painel/pessoas", label: v.persons.charAt(0).toUpperCase() + v.persons.slice(1) }}
        title={person.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {person.isFictitious && <Badge tone="demo">registro fictício</Badge>}
            <span>
              {[person.email, person.phone, [person.city, person.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
            </span>
          </span>
        }
        actions={
          <>
            <LinkButton href={`/painel/pessoas/${person.id}/solicitar`}>Solicitar avaliação</LinkButton>
            <LinkButton href={`/painel/pessoas/${person.id}/medicao-presencial`} variant="ghost">
              Registrar medição presencial
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Linha do tempo" description="Avaliações solicitadas, realizadas e revisadas, da mais recente para a mais antiga.">
            {timeline.length === 0 ? (
              <EmptyState title="Nenhuma avaliação ainda.">Solicite a primeira avaliação ou registre uma medição presencial.</EmptyState>
            ) : (
              <ol className="relative space-y-4 border-l border-moveo-border pl-5">
                {timeline.map(({ request, protocol, sessions, publishedFeedback, requesterName }) => {
                  const st = REQUEST_STATUS[request.status];
                  const latest = sessions.sort((a, b) => +b.startedAt - +a.startedAt)[0];
                  return (
                    <li key={request.id} className="relative">
                      <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-moveo-primary" />
                      <Link
                        href={`/painel/avaliacoes/${request.id}`}
                        className="block rounded-xl border border-moveo-border p-3 transition-colors hover:border-moveo-primary"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-moveo-ink">
                            {protocol?.shortTitle ?? request.protocolId}
                            {request.previousRequestId && <span className="text-moveo-muted"> · reavaliação</span>}
                          </p>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-moveo-muted">
                          {formatDate(request.createdAt)} · por {requesterName}
                          {latest && (
                            <>
                              {" "}
                              · sessão {SESSION_STATUS[latest.status].label.toLowerCase()} ({ORIGIN_LABEL[latest.origin].label.toLowerCase()})
                            </>
                          )}
                          {publishedFeedback && <> · devolutiva v{publishedFeedback.version} publicada</>}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title={v.episode.charAt(0).toUpperCase() + v.episode.slice(1)}>
            <ul className="space-y-3">
              {episodes.map((e) => (
                <li key={e.id} className="rounded-xl bg-moveo-bg p-3 text-sm">
                  <p className="font-medium text-moveo-ink">{e.title}</p>
                  <p className="text-moveo-muted">
                    {MODALITY[e.modality]} · desde {formatDate(e.openedAt, false)} {e.status === "encerrado" && "· encerrado"}
                  </p>
                  {e.remoteSuitabilityNote && <p className="mt-1 text-xs text-moveo-muted">Adequação do remoto: {e.remoteSuitabilityNote}</p>}
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-moveo-border pt-4">
              <EpisodeForm personId={person.id} episodeLabel={v.episode} />
            </div>
          </Panel>

          <Panel title="Consentimentos" description="Registrados pela própria pessoa, com versão do texto.">
            {consents.length === 0 ? (
              <p className="text-sm text-moveo-muted">Nenhum registro ainda. A pessoa registra ao abrir o primeiro convite.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {consents.map(({ record, doc }) => (
                  <li key={record.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {doc.title} <span className="text-xs text-moveo-muted">({doc.version})</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={record.decision === "aceito" ? "success" : "neutral"}>{record.decision}</Badge>
                      <span className="text-xs text-moveo-muted">{formatDate(record.recordedAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Contato">
            <DefinitionList
              items={[
                { term: "Canal preferido", value: CHANNEL_LABEL[person.preferredChannel] },
                { term: "Cadastro", value: formatDate(person.createdAt, false) },
              ]}
            />
            {ctx.role === "gestor" && (
              <Link href={`/painel/pessoas/${person.id}/vinculos`} className="mt-4 inline-block text-sm font-medium text-moveo-primary">
                Gerenciar vínculos de atendimento →
              </Link>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
