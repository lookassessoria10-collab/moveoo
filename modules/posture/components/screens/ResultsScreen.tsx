"use client";

import { HomeLink as Link } from "@/components/shared/FlowShell";
import { ScreenShell, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { POSTURE_CONFIG } from "@/config/modules/posture";
import { usePostureStore } from "../../store";

export function ResultsScreen() {
  const result = usePostureStore((s) => s.result);
  const reset = usePostureStore((s) => s.reset);

  if (!result) return null;
  const { reading, summary, tips, isDemo } = result;

  return (
    <ScreenShell>
      {isDemo && (
        <div className="mb-4 rounded-xl bg-moveo-warn/15 px-4 py-2 text-center text-xs font-semibold text-moveo-warn">
          Modo demonstração — resultados fictícios
        </div>
      )}

      <h1 className="text-center text-2xl font-bold tracking-tight text-moveo-ink">
        POSTURA SENTADA OBSERVADA
      </h1>
      <p className="mt-1 text-center text-sm text-moveo-muted">
        Veja de forma simples o que observamos na sua postura
      </p>

      <Card className="mt-6 border-moveo-primary/30 bg-moveo-primarySoft">
        <p className="text-lg font-semibold leading-snug text-moveo-ink">{summary[0]}</p>
        {summary.length > 2 && (
          <ul className="mt-3 space-y-1.5">
            {summary.slice(1, -1).map((line, i) => (
              <li key={i} className="text-sm leading-relaxed text-moveo-ink/80">
                • {line}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-xs text-moveo-muted">Inclinação do tronco</p>
            <p className="text-2xl font-bold text-moveo-ink">{Math.round(reading.trunkTiltDeg)}°</p>
          </div>
          <div>
            <p className="text-xs text-moveo-muted">Cabeça à frente do ombro</p>
            <p className="text-2xl font-bold text-moveo-ink">{Math.round(reading.neckTiltDeg)}°</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-moveo-muted">
          Ângulos em relação à vertical, medidos durante a captura — apenas descritivo, não é um
          diagnóstico postural.
        </p>
      </Card>

      <Card className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moveo-muted">
          Recomendações gerais de ergonomia
        </p>
        <ul className="space-y-2">
          {tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-sm leading-relaxed text-moveo-ink">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-moveo-primarySoft text-xs text-moveo-primary">
                ✓
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 space-y-3">
        <Button variant="ghost" onClick={reset}>
          REFAZER CAPTURA
        </Button>
        <Link className="block">
          <Button variant="ghost">AVALIAR OUTRA REGIÃO</Button>
        </Link>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-moveo-muted">
        {POSTURE_CONFIG.copy.disclaimerFinal}
      </p>
    </ScreenShell>
  );
}
