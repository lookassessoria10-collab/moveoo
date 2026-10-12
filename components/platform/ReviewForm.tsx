"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { reviewSessionAction } from "@/app/actions/care";
import { formatValue, SIDE_LABEL } from "@/lib/care/protocols";
import { inputClass } from "./ui";
import { FormError, SubmitButton } from "./forms";

export interface ReviewRow {
  id: string;
  label: string;
  side: string;
  unit: string;
  value: number | null;
  quality: "apta" | "insuficiente";
  rejectionReason: string | null;
  attempts: string;
}

/**
 * Revisão de todas as medidas de uma sessão. Medida sem valor válido não
 * pode ser aceita (o servidor também recusa): corrigir com justificativa
 * ou descartar.
 */
export function ReviewForm({ requestId, sessionId, rows }: { requestId: string; sessionId: string; rows: ReviewRow[] }) {
  const [state, action] = useFormState(reviewSessionAction, undefined);
  const [decisions, setDecisions] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.value !== null && r.quality === "apta" ? "aceita" : "descartada"]))
  );
  if (state?.ok) return <p className="text-sm text-emerald-700">Revisão registrada.</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="space-y-2">
        {rows.map((r) => {
          const valid = r.value !== null && r.quality === "apta";
          const decision = decisions[r.id];
          return (
            <div key={r.id} className="rounded-xl border border-moveo-border p-3">
              <input type="hidden" name="measurementId" value={r.id} />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-moveo-ink">
                  {r.label} <span className="text-moveo-muted">· {SIDE_LABEL[r.side] ?? r.side}</span>
                </p>
                <p className="text-sm">
                  <span className={valid ? "font-semibold text-moveo-ink" : "text-red-700"}>{formatValue(r.value, r.unit)}</span>
                  <span className="ml-2 text-xs text-moveo-muted">{r.attempts}</span>
                </p>
              </div>
              {!valid && r.rejectionReason && <p className="mt-1 text-xs text-red-700">{r.rejectionReason}</p>}
              <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr_2fr]">
                <select
                  name={`decision_${r.id}`}
                  value={decision}
                  onChange={(e) => setDecisions((d) => ({ ...d, [r.id]: e.target.value }))}
                  className={`${inputClass} sm:w-40`}
                  aria-label={`Decisão para ${r.label} ${r.side}`}
                >
                  <option value="aceita" disabled={!valid}>
                    Aceitar
                  </option>
                  <option value="corrigida">Corrigir</option>
                  <option value="descartada">Descartar</option>
                </select>
                {decision === "corrigida" ? (
                  <input
                    name={`corrected_${r.id}`}
                    inputMode="decimal"
                    required
                    placeholder={`Valor corrigido (${r.unit})`}
                    className={inputClass}
                    aria-label="Valor corrigido"
                  />
                ) : (
                  <span />
                )}
                {decision !== "aceita" ? (
                  <input
                    name={`justification_${r.id}`}
                    required
                    maxLength={500}
                    placeholder="Justificativa (obrigatória)"
                    className={inputClass}
                    aria-label="Justificativa"
                  />
                ) : (
                  <span />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <FormError state={state} />
      <SubmitButton pendingLabel="Registrando…">Registrar revisão</SubmitButton>
      <p className="text-xs text-moveo-muted">O valor original fica guardado; a sua decisão é registrada com autoria e data.</p>
    </form>
  );
}
