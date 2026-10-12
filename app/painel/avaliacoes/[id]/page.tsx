import Link from "next/link";
import { getDb } from "@/db/client";
import { Badge, DefinitionList, EmptyState, LinkButton, Notice, PageHeader, Panel } from "@/components/platform/ui";
import { SubmitButton } from "@/components/platform/forms";
import { FeedbackForm, ReissueForm } from "@/components/platform/CareForms";
import { ReviewForm } from "@/components/platform/ReviewForm";
import { cancelRequestAction, revokeInvitationAction } from "@/app/actions/care";
import { compareWithPrevious, getRequestDetail, type MeasurementView } from "@/lib/server/services/assessments";
import { getWorkspaceContext, orNotFound } from "@/lib/server/session";
import { formatValue, METHOD_LABEL, SIDE_LABEL } from "@/lib/care/protocols";
import {
  CHANNEL_LABEL,
  DECISION_LABEL,
  INTERRUPTION_LABEL,
  INVITATION_STATUS,
  ORIGIN_LABEL,
  QUALITY_LABEL,
  REQUEST_STATUS,
  REVIEW_STATUS,
  SESSION_STATUS,
  formatDate,
} from "@/lib/care/labels";

export const metadata = { title: "Avaliação" };

const CONTEXT_LABEL: Record<string, string> = {
  ladoDosSintomas: "Lado dos sintomas",
  areaDosSintomas: "Área dos sintomas",
  dorInicial: "Dor no início (0–10)",
  tempoDeQueixa: "Há quanto tempo",
};

const CONTEXT_VALUE: Record<string, string> = {
  right: "direito",
  left: "esquerdo",
  both: "os dois",
  testing: "sem queixa (só testando)",
  today: "hoje",
  days: "alguns dias",
  weeks: "algumas semanas",
  months: "alguns meses",
  over_6_months: "mais de 6 meses",
  no_pain: "sem dor",
  neck: "pescoço",
  upperBack: "parte alta das costas",
  lowerBack: "parte baixa das costas (lombar)",
  multiple: "mais de uma região",
};

function contextValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return CONTEXT_VALUE[String(v)] ?? String(v);
}

function attemptsText(m: MeasurementView) {
  if (m.attemptsPlanned === null) return "";
  return `${m.attemptsAnalyzed ?? 0} de ${m.attemptsPlanned} tentativas analisadas`;
}

function MeasurementTable({ ms }: { ms: MeasurementView[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-moveo-muted">
          <tr>
            <th className="py-2 pr-3 font-medium">Medida</th>
            <th className="py-2 pr-3 font-medium">Lado</th>
            <th className="py-2 pr-3 font-medium">Valor original</th>
            <th className="py-2 pr-3 font-medium">Qualidade</th>
            <th className="py-2 pr-3 font-medium">Revisão</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-moveo-border">
          {ms.map((m) => (
            <tr key={m.id} className="align-top">
              <td className="py-2 pr-3">
                <p className="text-moveo-ink">{m.label}</p>
                <p className="text-xs text-moveo-muted">{METHOD_LABEL[m.method] ?? m.method}</p>
              </td>
              <td className="py-2 pr-3">{SIDE_LABEL[m.side] ?? m.side}</td>
              <td className="py-2 pr-3">
                <span className={m.value === null ? "text-red-700" : "font-semibold"}>{formatValue(m.value, m.unit)}</span>
                <p className="text-xs text-moveo-muted">{attemptsText(m)}</p>
              </td>
              <td className="py-2 pr-3">
                <Badge tone={QUALITY_LABEL[m.quality].tone}>{QUALITY_LABEL[m.quality].label}</Badge>
                {m.rejectionReason && <p className="mt-1 max-w-[220px] text-xs text-red-700">{m.rejectionReason}</p>}
              </td>
              <td className="py-2 pr-3">
                {m.review ? (
                  <>
                    <Badge tone={DECISION_LABEL[m.review.decision].tone}>{DECISION_LABEL[m.review.decision].label}</Badge>
                    {m.review.decision === "corrigida" && (
                      <p className="mt-1 text-xs">
                        Valor corrigido: <strong>{formatValue(m.review.correctedValue, m.unit)}</strong>
                      </p>
                    )}
                    {m.review.justification && <p className="mt-1 max-w-[220px] text-xs text-moveo-muted">“{m.review.justification}”</p>}
                    <p className="mt-1 text-xs text-moveo-muted">
                      {m.review.reviewerName} · {formatDate(m.review.at)}
                      {m.reviewHistory > 1 && ` · ${m.reviewHistory} revisões`}
                    </p>
                  </>
                ) : (
                  <Badge tone="warn">Provisório</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext();
  const db = await getDb();
  const d = await orNotFound(getRequestDetail(db, ctx, params.id));
  const comparison = await compareWithPrevious(db, ctx, d.request.id);
  const status = REQUEST_STATUS[d.request.status];
  const isManual = d.protocol?.kind === "manual";
  const open = d.request.status === "pendente" || d.request.status === "em_andamento";
  const completed = d.sessions.filter((s) => s.status === "concluida");
  const currentFeedback = d.feedbackVersions.find((f) => f.feedback.status === "publicada");
  const pendingReview = completed.some((s) => s.reviewStatus === "provisorio");

  return (
    <>
      <PageHeader
        back={{ href: `/painel/pessoas/${d.person.id}`, label: d.person.fullName }}
        title={d.protocol?.title ?? d.request.protocolId}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {d.person.isFictitious && <Badge tone="demo">registro fictício</Badge>}
            {d.request.previousRequestId && (
              <Link href={`/painel/avaliacoes/${d.request.previousRequestId}`} className="underline">
                reavaliação da anterior
              </Link>
            )}
          </span>
        }
        actions={
          <>
            {completed.length > 0 && (
              <LinkButton href={`/painel/avaliacoes/${d.request.id}/relatorio`} variant="ghost">
                Relatório
              </LinkButton>
            )}
            {!isManual && (d.request.status === "revisada" || d.request.status === "aguardando_revisao") && (
              <LinkButton href={`/painel/pessoas/${d.person.id}/solicitar?reavaliar=${d.request.id}`} variant="secondary">
                Solicitar reavaliação
              </LinkButton>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {d.sessions.length === 0 && (
            <Panel title="Resultado">
              <EmptyState title="A pessoa ainda não realizou esta avaliação." />
            </Panel>
          )}

          {d.sessions.map((s) => {
            const origin = ORIGIN_LABEL[s.origin];
            const ctxEntries = Object.entries((s.reportedContext ?? {}) as Record<string, unknown>);
            const painBlocks = (ctxEntries.find(([k]) => k === "dorDuranteOsMovimentos")?.[1] ?? []) as {
              bloco: string;
              houveDor: boolean;
              intensidade: number | null;
            }[];
            return (
              <Panel
                key={s.id}
                title={`Sessão de ${formatDate(s.startedAt)}`}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={SESSION_STATUS[s.status].tone}>{SESSION_STATUS[s.status].label}</Badge>
                    {s.status === "concluida" && <Badge tone={REVIEW_STATUS[s.reviewStatus].tone}>{REVIEW_STATUS[s.reviewStatus].label}</Badge>}
                    <Badge tone={origin.tone}>{origin.label}</Badge>
                  </div>
                }
              >
                {s.status === "interrompida" && (
                  <Notice tone="danger" title="Atividade interrompida">
                    Motivo: {INTERRUPTION_LABEL[s.interruptionReason ?? ""] ?? s.interruptionReason ?? "não informado"}. Nenhum
                    resultado foi gerado. {open && "A pessoa pode tentar de novo pelo mesmo link enquanto ele estiver válido."}
                  </Notice>
                )}
                {s.status === "concluida" && (
                  <div className="space-y-5">
                    {s.origin === "demonstracao" && (
                      <Notice tone="demo">Resultado de demonstração: valores fictícios, sem relação com movimento real.</Notice>
                    )}
                    <MeasurementTable ms={s.measurements} />

                    {(ctxEntries.length > 0 || painBlocks.length > 0) && (
                      <div className="rounded-xl bg-moveo-bg p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-moveo-muted">Informado pela pessoa (não medido)</p>
                        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                          {ctxEntries
                            .filter(([k]) => k in CONTEXT_LABEL)
                            .map(([k, val]) => (
                              <div key={k}>
                                <dt className="text-xs text-moveo-muted">{CONTEXT_LABEL[k]}</dt>
                                <dd>{contextValue(val)}</dd>
                              </div>
                            ))}
                        </dl>
                        {painBlocks.length > 0 && (
                          <ul className="mt-3 space-y-1 text-sm">
                            {painBlocks.map((p) => (
                              <li key={p.bloco}>
                                {p.bloco}: {p.houveDor ? `relatou dor${p.intensidade !== null ? ` (${p.intensidade}/10)` : ""}` : "sem dor relatada"}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {!isManual &&
                      (s.reviewStatus === "provisorio" ? (
                        <div>
                          <h3 className="mb-2 text-sm font-semibold">Revisar medidas</h3>
                          <ReviewForm
                            requestId={d.request.id}
                            sessionId={s.id}
                            rows={s.measurements.map((m) => ({
                              id: m.id,
                              label: m.label,
                              side: m.side,
                              unit: m.unit,
                              value: m.value,
                              quality: m.quality,
                              rejectionReason: m.rejectionReason,
                              attempts: attemptsText(m),
                            }))}
                          />
                        </div>
                      ) : (
                        <details className="rounded-xl border border-moveo-border p-3">
                          <summary className="cursor-pointer text-sm font-medium">Revisar novamente (mantém o histórico)</summary>
                          <div className="mt-3">
                            <ReviewForm
                              requestId={d.request.id}
                              sessionId={s.id}
                              rows={s.measurements.map((m) => ({
                                id: m.id,
                                label: m.label,
                                side: m.side,
                                unit: m.unit,
                                value: m.value,
                                quality: m.quality,
                                rejectionReason: m.rejectionReason,
                                attempts: attemptsText(m),
                              }))}
                            />
                          </div>
                        </details>
                      ))}

                    <details className="text-xs text-moveo-muted">
                      <summary className="cursor-pointer">Rastreabilidade (versões)</summary>
                      <DefinitionList
                        items={[
                          { term: "Protocolo", value: `${s.protocolId} ${s.protocolVersion}` },
                          { term: "Algoritmo", value: s.algorithmVersion ?? "—" },
                          { term: "Modelo", value: s.modelId ?? "—" },
                          { term: "Runtime", value: s.runtimeVersion ?? "—" },
                          { term: "Aplicativo", value: s.appVersion },
                          { term: "Concluída em", value: formatDate(s.completedAt) },
                        ]}
                      />
                    </details>
                  </div>
                )}
              </Panel>
            );
          })}

          {comparison && (
            <Panel
              title="Comparação com a avaliação anterior"
              description="Só são comparadas medidas da mesma grandeza, lado, método, protocolo e versão do cálculo. A diferença não é rótulo de melhora: a interpretação é sua."
            >
              {comparison.rows.length === 0 ? (
                <p className="text-sm text-moveo-muted">Ainda não há duas sessões concluídas para comparar.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-moveo-muted">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Medida</th>
                        <th className="py-2 pr-3 font-medium">Antes</th>
                        <th className="py-2 pr-3 font-medium">Agora</th>
                        <th className="py-2 pr-3 font-medium">Diferença</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-moveo-border">
                      {comparison.rows.map((r) => (
                        <tr key={`${r.metricKey}-${r.side}`} className="align-top">
                          <td className="py-2 pr-3">
                            {r.label} <span className="text-moveo-muted">· {SIDE_LABEL[r.side] ?? r.side}</span>
                          </td>
                          <td className="py-2 pr-3">{formatValue(r.before, r.unit)}</td>
                          <td className="py-2 pr-3">{formatValue(r.after, r.unit)}</td>
                          <td className="py-2 pr-3">
                            {r.compatible ? (
                              <>
                                <strong>
                                  {r.difference !== null && r.difference > 0 ? "+" : ""}
                                  {formatValue(r.difference, r.unit)}
                                </strong>
                                {r.provisional && <p className="text-xs text-amber-800">inclui valor ainda não revisado</p>}
                              </>
                            ) : (
                              <span className="text-xs text-moveo-muted">Não comparável: {r.reasons.join(" ")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          <Panel title="Devolutiva para a pessoa" description="Só a versão publicada mais recente aparece para a pessoa. Versões anteriores ficam no histórico.">
            {pendingReview ? (
              <Notice tone="warn">Revise as medidas antes de publicar a devolutiva.</Notice>
            ) : d.request.status === "cancelada" ? (
              <p className="text-sm text-moveo-muted">Avaliação cancelada.</p>
            ) : (
              <FeedbackForm requestId={d.request.id} current={currentFeedback?.feedback.body ?? ""} canIncludeMeasurements={completed.length > 0} />
            )}
            {d.feedbackVersions.length > 0 && (
              <div className="mt-5 border-t border-moveo-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-moveo-muted">Histórico</p>
                <ul className="mt-2 space-y-3">
                  {d.feedbackVersions.map(({ feedback, authorName }) => (
                    <li key={feedback.id} className="text-sm">
                      <p className="flex flex-wrap items-center gap-2">
                        <strong>Versão {feedback.version}</strong>
                        <Badge tone={feedback.status === "publicada" ? "success" : "neutral"}>
                          {feedback.status === "publicada" ? "vigente" : "substituída"}
                        </Badge>
                        <span className="text-xs text-moveo-muted">
                          {authorName} · {formatDate(feedback.publishedAt)}
                        </span>
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-moveo-muted">{feedback.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Solicitação">
            <DefinitionList
              items={[
                { term: "Solicitada por", value: d.requesterName },
                { term: "Em", value: formatDate(d.request.createdAt) },
                { term: "Prazo", value: formatDate(d.request.dueAt) },
                { term: "Supervisão", value: d.request.supervision === "sessao_ao_vivo" ? "Somente em sessão ao vivo" : "Sem supervisão" },
                { term: "Protocolo", value: `${d.request.protocolId} ${d.request.protocolVersion}` },
                { term: "Objetivo", value: d.episode?.title ?? "—" },
              ]}
            />
            {d.request.instructions && (
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-moveo-bg p-3 text-sm">{d.request.instructions}</p>
            )}
            {open && (
              <form action={cancelRequestAction} className="mt-4">
                <input type="hidden" name="requestId" value={d.request.id} />
                <SubmitButton variant="ghost">Cancelar solicitação</SubmitButton>
              </form>
            )}
          </Panel>

          {!isManual && (
            <Panel title="Convites">
              {d.invitations.length === 0 ? (
                <p className="text-sm text-moveo-muted">Sem convites.</p>
              ) : (
                <ul className="space-y-3">
                  {d.invitations.map((inv) => {
                    const st = INVITATION_STATUS[inv.status];
                    const active = inv.status === "criado" || inv.status === "acessado" || inv.status === "confirmado";
                    return (
                      <li key={inv.id} className="rounded-xl bg-moveo-bg p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>{CHANNEL_LABEL[inv.channel]}</span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-moveo-muted">
                          Criado {formatDate(inv.createdAt)} · expira {formatDate(inv.expiresAt)}
                          {inv.confirmedAt && ` · confirmado ${formatDate(inv.confirmedAt)}`}
                        </p>
                        {active && (
                          <form action={revokeInvitationAction} className="mt-2">
                            <input type="hidden" name="invitationId" value={inv.id} />
                            <input type="hidden" name="requestId" value={d.request.id} />
                            <button className="text-xs font-medium text-red-700 underline">Revogar acesso</button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {open && (
                <div className="mt-4 border-t border-moveo-border pt-4">
                  <ReissueForm requestId={d.request.id} defaultChannel={d.person.preferredChannel} />
                </div>
              )}
            </Panel>
          )}

          {d.protocol && d.protocol.limitations.length > 0 && (
            <Panel title="Limitações do protocolo">
              <ul className="list-disc space-y-1 pl-5 text-sm text-moveo-muted">
                {d.protocol.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {!isManual && (
                <p className="mt-3 text-xs text-moveo-muted">
                  Estimativa por câmera 2D sem validação clínica. Não é goniometria nem diagnóstico.
                </p>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
