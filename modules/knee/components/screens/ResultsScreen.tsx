"use client";

import { HomeLink as Link } from "@/components/shared/FlowShell";
import { ScreenShell, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { painLabel } from "@/lib/resultRules";
import { KNEE_CONFIG } from "@/config/modules/knee";
import { useKneeStore } from "../../store";
import { ValidationDataCard } from "@/components/shared/ValidationDataCard";

function AmplitudeBar({ label, right, left }: { label: string; right: number | null; left: number | null }) {
  const pct = (v: number | null) => (v === null ? 0 : Math.min(100, (v / 150) * 100));
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moveo-muted">{label}</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-semibold text-moveo-right">Direito</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-moveo-border">
            <div className="h-full rounded-full bg-moveo-right" style={{ width: `${pct(right)}%` }} />
          </div>
          <span className="w-9 shrink-0 text-right text-xs font-semibold text-moveo-ink">
            {right !== null ? `${Math.round(right)}°` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-semibold text-moveo-left">Esquerdo</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-moveo-border">
            <div className="h-full rounded-full bg-moveo-left" style={{ width: `${pct(left)}%` }} />
          </div>
          <span className="w-9 shrink-0 text-right text-xs font-semibold text-moveo-ink">
            {left !== null ? `${Math.round(left)}°` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function asymmetryLabel(diffDeg: number): "Baixa" | "Moderada" | "Elevada" {
  if (diffDeg <= 5) return "Baixa";
  if (diffDeg <= 10) return "Moderada";
  return "Elevada";
}

export function ResultsScreen() {
  const result = useKneeStore((s) => s.result);
  const setScreen = useKneeStore((s) => s.setScreen);
  const reset = useKneeStore((s) => s.reset);

  if (!result) return null;
  const { flexionResults, squatResult, sitToStandResult, flexionComparison, summary, isDemo } = result;
  const right = flexionResults.find((r) => r.side === "right");
  const left = flexionResults.find((r) => r.side === "left");

  return (
    <ScreenShell>
      {isDemo && (
        <div className="mb-4 rounded-xl bg-moveo-warn/15 px-4 py-2 text-center text-xs font-semibold text-moveo-warn">
          Modo demonstração — resultados fictícios
        </div>
      )}

      <h1 className="text-center text-2xl font-bold tracking-tight text-moveo-ink">
        AVALIAÇÃO FUNCIONAL DO JOELHO
      </h1>
      <p className="mt-1 text-center text-sm text-moveo-muted">
        Veja de forma simples o que observamos no seu movimento
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

      {(right || left) && (
        <Card className="mt-6">
          <AmplitudeBar
            label="Flexão do joelho"
            right={right?.averageMaxAngle ?? null}
            left={left?.averageMaxAngle ?? null}
          />
        </Card>
      )}

      {squatResult && (
        <Card className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moveo-muted">
            Agachamento
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-moveo-muted">Amplitude observada</p>
              <p className="text-2xl font-bold text-moveo-ink">
                {Math.round(squatResult.averageMaxAngle)}°
              </p>
            </div>
            <div>
              <p className="text-xs text-moveo-muted">Diferença entre joelhos</p>
              <p className="text-2xl font-bold text-moveo-ink">
                {asymmetryLabel(squatResult.kneeAsymmetryDeg ?? 0)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {sitToStandResult && (
        <Card className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moveo-muted">
            Sentar e levantar
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-moveo-muted">Tempo médio</p>
              <p className="text-2xl font-bold text-moveo-ink">
                {(
                  sitToStandResult.attempts.reduce((sum, a) => sum + a.duration, 0) /
                  sitToStandResult.attempts.length /
                  1000
                ).toFixed(1)}
                s
              </p>
            </div>
            <div>
              <p className="text-xs text-moveo-muted">Uso das mãos</p>
              <p className="text-2xl font-bold text-moveo-ink">
                {sitToStandResult.attempts.some((a) => a.handsUsed) ? "Sim" : "Não"}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moveo-muted">
          Dor relatada durante os testes
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Flexão direita", pain: right?.pain },
            { label: "Flexão esquerda", pain: left?.pain },
            { label: "Agachamento", pain: squatResult?.pain },
            { label: "Sentar/levantar", pain: sitToStandResult?.pain },
          ]
            .filter((x) => x.pain)
            .map((x) => (
              <div key={x.label}>
                <p className="text-xs text-moveo-muted">{x.label}</p>
                <p className="text-sm font-semibold text-moveo-ink">
                  {painLabel(x.pain?.hadPain ? x.pain.intensity ?? 0 : 0)}
                </p>
              </div>
            ))}
        </div>
      </Card>

      <div className="mt-6 space-y-3">
        <Button variant="secondary" onClick={() => setScreen("technicalReport")}>
          VER DADOS DETALHADOS
        </Button>
        <Button variant="ghost" onClick={reset}>
          REFAZER TESTE
        </Button>
        <Link className="block">
          <Button variant="ghost">AVALIAR OUTRA REGIÃO</Button>
        </Link>
      </div>

      <ValidationDataCard />

      <p className="mt-6 text-center text-xs leading-relaxed text-moveo-muted">
        {KNEE_CONFIG.copy.disclaimerFinal}
      </p>
    </ScreenShell>
  );
}
