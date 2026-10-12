"use client";

import { HomeLink as Link } from "@/components/shared/FlowShell";
import { ScreenShell, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { painLabel } from "@/lib/resultRules";
import { SPINE_CONFIG } from "@/config/modules/spine";
import { useSpineStore } from "../../store";

const TEST_LABEL: Record<string, string> = {
  flexion: "Flexão anterior",
  lateralRight: "Inclinação direita",
  lateralLeft: "Inclinação esquerda",
  extension: "Extensão confortável",
};

function AmplitudeBar({ label, right, left }: { label: string; right: number | null; left: number | null }) {
  const pct = (v: number | null) => (v === null ? 0 : Math.min(100, (v / 60) * 100));
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moveo-muted">{label}</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-semibold text-moveo-right">Direita</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-moveo-border">
            <div className="h-full rounded-full bg-moveo-right" style={{ width: `${pct(right)}%` }} />
          </div>
          <span className="w-9 shrink-0 text-right text-xs font-semibold text-moveo-ink">
            {right !== null ? `${Math.round(right)}°` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-semibold text-moveo-left">Esquerda</span>
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

export function ResultsScreen() {
  const result = useSpineStore((s) => s.result);
  const setScreen = useSpineStore((s) => s.setScreen);
  const reset = useSpineStore((s) => s.reset);

  if (!result) return null;
  const { results, lateralDifference, staticPosture, summary, isDemo } = result;
  const flexion = results.find((r) => r.test === "flexion");
  const extension = results.find((r) => r.test === "extension");
  const right = results.find((r) => r.test === "lateralRight");
  const left = results.find((r) => r.test === "lateralLeft");

  return (
    <ScreenShell>
      {isDemo && (
        <div className="mb-4 rounded-xl bg-moveo-warn/15 px-4 py-2 text-center text-xs font-semibold text-moveo-warn">
          Modo demonstração — resultados fictícios
        </div>
      )}

      <h1 className="text-center text-2xl font-bold tracking-tight text-moveo-ink">
        MOVIMENTO DO TRONCO
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
            label="Inclinação lateral"
            right={right?.averageMaxAngle ?? null}
            left={left?.averageMaxAngle ?? null}
          />
        </Card>
      )}

      <Card className="mt-4">
        <div className="grid grid-cols-2 gap-3">
          {flexion && (
            <div>
              <p className="text-xs text-moveo-muted">Flexão anterior</p>
              <p className="text-2xl font-bold text-moveo-ink">{Math.round(flexion.averageMaxAngle)}°</p>
            </div>
          )}
          {extension && (
            <div>
              <p className="text-xs text-moveo-muted">Extensão confortável</p>
              <p className="text-2xl font-bold text-moveo-ink">{Math.round(extension.averageMaxAngle)}°</p>
            </div>
          )}
          {lateralDifference !== null && (
            <div>
              <p className="text-xs text-moveo-muted">Diferença lateral</p>
              <p className="text-2xl font-bold text-moveo-ink">{Math.round(lateralDifference)}°</p>
            </div>
          )}
        </div>
      </Card>

      {staticPosture && (
        <Card className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moveo-muted">
            Postura observada (posição inicial)
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-moveo-muted">Ombros</p>
              <p className="text-lg font-bold text-moveo-ink">{Math.abs(staticPosture.shoulderTiltDeg).toFixed(1)}°</p>
            </div>
            <div>
              <p className="text-xs text-moveo-muted">Quadril</p>
              <p className="text-lg font-bold text-moveo-ink">{Math.abs(staticPosture.hipTiltDeg).toFixed(1)}°</p>
            </div>
            <div>
              <p className="text-xs text-moveo-muted">Cabeça</p>
              <p className="text-lg font-bold text-moveo-ink">{Math.abs(staticPosture.headTiltDeg).toFixed(1)}°</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-moveo-muted">
            Diferença de altura observada em cada linha na captura inicial — apenas descritivo, não é um
            diagnóstico postural.
          </p>
        </Card>
      )}

      <Card className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moveo-muted">
          Dor relatada durante os testes
        </p>
        <div className="grid grid-cols-2 gap-3">
          {results.map((r) => (
            <div key={r.test}>
              <p className="text-xs text-moveo-muted">{TEST_LABEL[r.test]}</p>
              <p className="text-sm font-semibold text-moveo-ink">
                {painLabel(r.pain.hadPain ? r.pain.intensity ?? 0 : 0)}
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

      <p className="mt-6 text-center text-xs leading-relaxed text-moveo-muted">
        {SPINE_CONFIG.copy.disclaimerFinal}
      </p>
    </ScreenShell>
  );
}
