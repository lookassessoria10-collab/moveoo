import { getDb } from "@/db/client";
import { PrintButton } from "@/components/platform/PrintButton";
import { compareWithPrevious, getRequestDetail } from "@/lib/server/services/assessments";
import { audit } from "@/lib/server/services/core";
import { getWorkspaceContext, orNotFound } from "@/lib/server/session";
import { effectiveValue } from "@/lib/care/comparison";
import { formatValue, METHOD_LABEL, SIDE_LABEL } from "@/lib/care/protocols";
import { DECISION_LABEL, ORIGIN_LABEL, REVIEW_STATUS, formatDate } from "@/lib/care/labels";
import { PLATFORM } from "@/config/platform";

export const metadata = { title: "Relatório" };

/**
 * Relatório gerado a partir dos dados PERSISTIDOS. Preserva origem,
 * método, versões, qualidade, estado de revisão e limitações. Resultado
 * provisório aparece como provisório — nunca como documento validado.
 * PDF: "Salvar como PDF" na janela de impressão do navegador.
 */
export default async function ReportPage({ params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext();
  const db = await getDb();
  const d = await orNotFound(getRequestDetail(db, ctx, params.id));
  const comparison = await compareWithPrevious(db, ctx, d.request.id);
  const session = d.sessions.find((s) => s.status === "concluida");
  const feedback = d.feedbackVersions.find((f) => f.feedback.status === "publicada");
  await audit(db, {
    workspaceId: ctx.workspace.id,
    actorType: "usuario",
    actorId: ctx.userId,
    action: "relatorio.gerado",
    objectType: "assessment_request",
    objectId: d.request.id,
    metadata: { revisado: session?.reviewStatus === "revisado" },
  });

  return (
    <article className="mx-auto max-w-3xl bg-white p-8 text-sm text-moveo-ink print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>
      <header className="border-b border-moveo-border pb-4">
        <p className="text-xs uppercase tracking-wide text-moveo-muted">{ctx.workspace.name}</p>
        <h1 className="mt-1 text-2xl font-bold">Relatório de avaliação de movimento</h1>
        <p className="mt-1">{d.protocol?.title}</p>
        {d.person.isFictitious && <p className="mt-2 font-semibold text-violet-800">REGISTRO FICTÍCIO — ESPAÇO DE DEMONSTRAÇÃO</p>}
        {session?.reviewStatus !== "revisado" && (
          <p className="mt-2 font-semibold text-amber-800">RESULTADO PROVISÓRIO — AINDA NÃO REVISADO PELO PROFISSIONAL</p>
        )}
      </header>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-moveo-muted">Pessoa</p>
          <p>{d.person.fullName}</p>
        </div>
        <div>
          <p className="text-xs text-moveo-muted">Profissional solicitante</p>
          <p>{d.requesterName}</p>
        </div>
        <div>
          <p className="text-xs text-moveo-muted">Objetivo / episódio</p>
          <p>{d.episode?.title ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-moveo-muted">Data da captura</p>
          <p>{formatDate(session?.completedAt)}</p>
        </div>
      </section>

      {session ? (
        <>
          <section className="mt-6">
            <h2 className="text-base font-semibold">Medidas</h2>
            <p className="text-xs text-moveo-muted">
              Origem: {ORIGIN_LABEL[session.origin].label} · Estado: {REVIEW_STATUS[session.reviewStatus].label}
            </p>
            <table className="mt-2 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-moveo-border text-xs text-moveo-muted">
                  <th className="py-1.5 pr-2 font-medium">Medida</th>
                  <th className="py-1.5 pr-2 font-medium">Lado</th>
                  <th className="py-1.5 pr-2 font-medium">Valor</th>
                  <th className="py-1.5 pr-2 font-medium">Método · tentativas</th>
                  <th className="py-1.5 font-medium">Revisão</th>
                </tr>
              </thead>
              <tbody>
                {session.measurements.map((m) => {
                  const v = effectiveValue({
                    value: m.value,
                    quality: m.quality,
                    reviewDecision: m.review?.decision ?? null,
                    correctedValue: m.review?.correctedValue ?? null,
                  });
                  return (
                    <tr key={m.id} className="border-b border-moveo-border/60 align-top">
                      <td className="py-1.5 pr-2">{m.label}</td>
                      <td className="py-1.5 pr-2">{SIDE_LABEL[m.side] ?? m.side}</td>
                      <td className="py-1.5 pr-2">
                        {formatValue(v, m.unit)}
                        {m.review?.decision === "corrigida" && (
                          <span className="block text-xs text-moveo-muted">original: {formatValue(m.value, m.unit)}</span>
                        )}
                        {m.quality === "insuficiente" && <span className="block text-xs text-red-700">{m.rejectionReason}</span>}
                      </td>
                      <td className="py-1.5 pr-2 text-xs">
                        {METHOD_LABEL[m.method] ?? m.method}
                        {m.attemptsPlanned !== null && ` · ${m.attemptsAnalyzed ?? 0}/${m.attemptsPlanned}`}
                      </td>
                      <td className="py-1.5 text-xs">
                        {m.review ? `${DECISION_LABEL[m.review.decision].label}${m.review.justification ? ` — ${m.review.justification}` : ""}` : "Provisório"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {comparison && comparison.rows.length > 0 && (
            <section className="mt-6">
              <h2 className="text-base font-semibold">Comparação com a avaliação anterior</h2>
              <ul className="mt-2 space-y-1">
                {comparison.rows.map((r) => (
                  <li key={`${r.metricKey}-${r.side}`}>
                    {r.label} ({SIDE_LABEL[r.side] ?? r.side}):{" "}
                    {r.compatible
                      ? `${formatValue(r.before, r.unit)} → ${formatValue(r.after, r.unit)} (diferença ${r.difference !== null && r.difference > 0 ? "+" : ""}${formatValue(r.difference, r.unit)})${r.provisional ? " — inclui valor não revisado" : ""}`
                      : `não comparável — ${r.reasons.join(" ")}`}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-moveo-muted">
                A diferença numérica não indica, por si só, melhora ou piora clinicamente relevante.
              </p>
            </section>
          )}
        </>
      ) : (
        <p className="mt-6">Nenhuma sessão concluída.</p>
      )}

      <section className="mt-6">
        <h2 className="text-base font-semibold">Orientação do profissional</h2>
        {feedback ? (
          <>
            <p className="mt-1 whitespace-pre-wrap">{feedback.feedback.body}</p>
            <p className="mt-1 text-xs text-moveo-muted">
              Versão {feedback.feedback.version} · {feedback.authorName} · {formatDate(feedback.feedback.publishedAt)}
            </p>
          </>
        ) : (
          <p className="mt-1 text-moveo-muted">Ainda não publicada.</p>
        )}
      </section>

      <section className="mt-6 border-t border-moveo-border pt-4 text-xs text-moveo-muted">
        <p className="font-semibold">Método e limitações</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {d.protocol?.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
          {d.protocol?.kind === "camera" && (
            <li>Estimativa por câmera 2D, sem validação clínica. Não é goniometria, não identifica lesões e não substitui a avaliação profissional.</li>
          )}
        </ul>
        {session && (
          <p className="mt-2">
            Rastreabilidade: protocolo {session.protocolId} {session.protocolVersion} · algoritmo {session.algorithmVersion ?? "—"} · modelo{" "}
            {session.modelId ?? "—"} · {PLATFORM.name} {session.appVersion}
          </p>
        )}
        <p className="mt-2">Gerado em {formatDate(new Date())} a partir dos registros armazenados.</p>
      </section>
    </article>
  );
}
