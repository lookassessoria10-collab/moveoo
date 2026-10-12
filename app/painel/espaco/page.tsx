import { getDb } from "@/db/client";
import { Badge, DefinitionList, Notice, PageHeader, Panel } from "@/components/platform/ui";
import { NewWorkspaceForm, WorkspaceSettingsForm } from "@/components/platform/CareForms";
import { getWorkspaceContext } from "@/lib/server/session";
import { getReleaseState, RELEASE_STATE_LABEL } from "@/lib/server/services/core";
import { CAMERA_PROTOCOLS } from "@/lib/care/protocols";
import { WORKSPACE_KIND_LABEL, formatDate } from "@/lib/care/labels";

export const metadata = { title: "Espaço" };

export default async function WorkspacePage() {
  const ctx = await getWorkspaceContext();
  const db = await getDb();
  const releases = await Promise.all(
    CAMERA_PROTOCOLS.map(async (p) => ({
      p,
      ...(await getReleaseState(db, p.featureKey!, { algorithmVersion: p.algorithmVersion!, protocolVersion: p.version })),
    }))
  );
  const isDemo = ctx.workspace.environment === "demonstracao";
  return (
    <>
      <PageHeader title={ctx.workspace.name} subtitle={WORKSPACE_KIND_LABEL[ctx.workspace.kind]} />
      <div className="space-y-4">
        <Panel title="Ambiente">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isDemo ? "demo" : "success"}>{isDemo ? "Demonstração (dados fictícios)" : "Atendimento real"}</Badge>
            <span className="text-sm text-moveo-muted">criado em {formatDate(ctx.workspace.createdAt, false)}</span>
          </div>
          <p className="mt-3 text-sm text-moveo-muted">
            {isDemo
              ? "Espaços de demonstração nunca se tornam reais: para atender pessoas reais, crie um espaço de atendimento real (exige registro verificado)."
              : "Funções de mensuração só podem ser usadas quando houver liberação registrada para a versão em uso."}
          </p>
        </Panel>

        <Panel title="Funções de mensuração" description="Estado decidido pela administração da plataforma, por versão de protocolo e algoritmo. O plano contratado não altera este estado.">
          <ul className="divide-y divide-moveo-border">
            {releases.map(({ p, state }) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  {p.shortTitle} <span className="text-xs text-moveo-muted">· protocolo {p.version} · algoritmo {p.algorithmVersion}</span>
                </span>
                <Badge tone={state === "liberado" ? "success" : state === "suspenso" ? "danger" : "warn"}>{RELEASE_STATE_LABEL[state]}</Badge>
              </li>
            ))}
          </ul>
          {isDemo && (
            <div className="mt-3">
              <Notice tone="info">Neste espaço de demonstração todas as funções podem ser testadas com dados fictícios, exceto as suspensas.</Notice>
            </div>
          )}
        </Panel>

        {ctx.role === "gestor" && (
          <Panel title="Identidade exibida à pessoa atendida" description="O nome e a cor aparecem no convite e nas telas de atividade.">
            <WorkspaceSettingsForm name={ctx.workspace.name} brandColor={ctx.workspace.brandColor} />
          </Panel>
        )}

        <Panel title="Novo espaço">
          <NewWorkspaceForm canCreateReal={ctx.profile?.verificationStatus === "verificado"} />
        </Panel>

        <Panel title="Planos e assinatura">
          <DefinitionList items={[{ term: "Plano", value: "Em definição (piloto)" }, { term: "Limites", value: "Sem limites nesta fase" }]} />
          <p className="mt-3 text-xs text-moveo-muted">
            Limites comerciais nunca ampliam acesso a dados, liberam funções pendentes ou apagam registros sujeitos a guarda.
          </p>
        </Panel>
      </div>
    </>
  );
}
