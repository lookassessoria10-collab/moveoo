import Link from "next/link";
import { getDb } from "@/db/client";
import { PersonShell } from "@/components/care/PersonShell";
import { getPublishedFeedbackForPerson } from "@/lib/server/services/personAccess";
import { requirePersonScope } from "@/lib/server/session";
import { formatValue, METHOD_LABEL, SIDE_LABEL } from "@/lib/care/protocols";
import { formatDate } from "@/lib/care/labels";

export default async function FeedbackPage() {
  const scope = await requirePersonScope();
  const fb = await getPublishedFeedbackForPerson(await getDb(), scope);
  return (
    <PersonShell
      workspaceName={scope.workspace.name}
      brandColor={scope.workspace.brandColor}
      logoUrl={scope.workspace.logoUrl}
      isDemo={scope.workspace.environment === "demonstracao"}
    >
      <Link href="/acompanhamento" className="text-sm text-moveo-muted">
        ← Minhas atividades
      </Link>
      <h1 className="mt-3 text-2xl font-bold">Retorno do profissional</h1>
      {!fb ? (
        <p className="mt-3 text-sm text-moveo-muted">Ainda não há retorno publicado.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-moveo-muted">
            {fb.authorName} · {formatDate(fb.feedback.publishedAt)}
            {fb.feedback.version > 1 && " · versão atualizada"}
          </p>
          <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-moveo-border bg-white p-5 text-base leading-relaxed">
            {fb.feedback.body}
          </div>
          {fb.reviewed.length > 0 && (
            <section className="mt-6">
              <h2 className="font-semibold">Medidas revisadas</h2>
              <ul className="mt-2 divide-y divide-moveo-border rounded-2xl border border-moveo-border bg-white">
                {fb.reviewed.map((m) => (
                  <li key={`${m.label}-${m.side}`} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                    <span>
                      {m.label}
                      {m.side !== "nao_se_aplica" && <span className="text-moveo-muted"> · {SIDE_LABEL[m.side]}</span>}
                      <span className="block text-xs text-moveo-muted">{METHOD_LABEL[m.method] ?? m.method}</span>
                    </span>
                    <strong>{formatValue(m.value, m.unit)}</strong>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-moveo-muted">
                Valores estimados e revisados pelo profissional. Eles descrevem o movimento observado e não são diagnóstico.
              </p>
            </section>
          )}
        </>
      )}
    </PersonShell>
  );
}
