import { getDb } from "@/db/client";
import { Badge, Notice, PageHeader, Panel } from "@/components/platform/ui";
import { ReleaseForm } from "@/components/platform/AdminForms";
import { listReleaseOverview } from "@/lib/server/services/admin";
import { FEATURES, RELEASE_STATE_LABEL } from "@/lib/server/services/core";
import { requireAdmin } from "@/lib/server/session";
import { formatDate } from "@/lib/care/labels";

export const metadata = { title: "Liberação por recurso" };

export default async function ReleasesPage() {
  const admin = await requireAdmin();
  const { current, history, modelVersion } = await listReleaseOverview(await getDb(), admin.id);
  return (
    <>
      <PageHeader
        title="Liberação por recurso e versão"
        subtitle="Controle no servidor: vale para telas, rotas da API e chamadas diretas. Planos comerciais não alteram este estado."
      />
      <div className="mb-4">
        <Notice tone="warn" title="Decisão humana, não aprovação regulatória">
          Registrar &quot;liberado&quot; não substitui enquadramento, notificação/registro na Anvisa, validação clínica nem
          parecer jurídico. Use os critérios de docs/regulatorio/criterios-de-liberacao.md.
        </Notice>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Estado atual (versões em uso)" description={`Modelo e runtime em uso: ${modelVersion}. Trocar qualquer versão exige nova decisão.`}>
          <ul className="divide-y divide-moveo-border text-sm">
            {current.map((c) => (
              <li key={c.featureKey} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  {FEATURES[c.featureKey]?.label}
                  <span className="block text-xs text-moveo-muted">
                    protocolo {c.protocolVersion} · algoritmo {c.algorithmVersion}
                  </span>
                </span>
                <Badge tone={c.state === "liberado" ? "success" : c.state === "suspenso" ? "danger" : "warn"}>{RELEASE_STATE_LABEL[c.state]}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Registrar decisão">
          <ReleaseForm
            options={current.map((c) => ({
              featureKey: c.featureKey,
              label: FEATURES[c.featureKey]?.label ?? c.featureKey,
              algorithmVersion: c.algorithmVersion,
              protocolVersion: c.protocolVersion,
            }))}
          />
        </Panel>
      </div>
      <Panel title="Histórico de decisões" className="mt-4">
        {history.length === 0 ? (
          <p className="text-sm text-moveo-muted">Nenhuma decisão registrada: todos os recursos estão em desenvolvimento.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {history.map(({ release, decidedByName }) => (
              <li key={release.id} className="rounded-xl bg-moveo-bg p-3">
                <p className="flex flex-wrap items-center gap-2">
                  <strong>{FEATURES[release.featureKey]?.label ?? release.featureKey}</strong>
                  <Badge>{RELEASE_STATE_LABEL[release.state]}</Badge>
                  <span className="text-xs text-moveo-muted">
                    protocolo {release.protocolVersion} · algoritmo {release.algorithmVersion} · modelo {release.modelVersion || "—"} · {decidedByName} · {formatDate(release.decidedAt)}
                  </span>
                </p>
                <p className="mt-1 text-xs">Escopo: {release.scope}</p>
                <p className="text-xs">Evidências: {release.evidence}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
