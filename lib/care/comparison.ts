/**
 * Regras de comparação entre avaliações.
 *
 * Só se compara a mesma grandeza, do mesmo lado, com o mesmo método,
 * protocolo (mesma versão principal) e versão do algoritmo, ambas com
 * valor válido. Qualquer diferença vira um motivo explícito de
 * incompatibilidade. A diferença numérica é apresentada como diferença —
 * nunca como "melhora" ou "piora": a interpretação é do profissional.
 */

export type ReviewDecision = "aceita" | "corrigida" | "descartada" | null;

export interface ComparableMeasurement {
  metricKey: string;
  label?: string;
  side: string;
  unit: string;
  method: string;
  origin: string;
  quality: "apta" | "insuficiente";
  value: number | null;
  reviewDecision: ReviewDecision;
  correctedValue: number | null;
  protocolId: string;
  protocolVersion: string;
  algorithmVersion: string | null;
  capturedAt: Date;
}

/** Valor que vale para leitura e comparação: correção do profissional > original; descartada = sem valor. */
export function effectiveValue(m: Pick<ComparableMeasurement, "value" | "reviewDecision" | "correctedValue" | "quality">): number | null {
  if (m.reviewDecision === "descartada") return null;
  if (m.reviewDecision === "corrigida") return m.correctedValue;
  if (m.quality !== "apta") return null;
  return m.value;
}

const major = (v: string) => v.split(".")[0];

export interface ComparisonRow {
  metricKey: string;
  label?: string;
  side: string;
  unit: string;
  before: number | null;
  after: number | null;
  difference: number | null;
  compatible: boolean;
  reasons: string[];
  /** true se algum dos dois valores ainda não foi revisado pelo profissional. */
  provisional: boolean;
}

export function compareMeasurements(before: ComparableMeasurement, after: ComparableMeasurement): ComparisonRow {
  const reasons: string[] = [];
  const vb = effectiveValue(before);
  const va = effectiveValue(after);

  if (before.metricKey !== after.metricKey || before.side !== after.side) {
    reasons.push("Grandezas ou lados diferentes.");
  }
  if (before.unit !== after.unit) reasons.push("Unidades diferentes.");
  if (vb === null || va === null) reasons.push("Uma das avaliações não tem valor válido para esta medida.");
  if (before.origin === "demonstracao" || after.origin === "demonstracao") {
    if (before.origin !== after.origin) reasons.push("Uma das avaliações é de demonstração (dado fictício).");
  }
  if (before.method !== after.method) reasons.push(`Métodos diferentes (${before.method} × ${after.method}).`);
  if (before.protocolId !== after.protocolId) {
    reasons.push("Protocolos diferentes.");
  } else if (major(before.protocolVersion) !== major(after.protocolVersion)) {
    reasons.push(`Versão do protocolo mudou (${before.protocolVersion} → ${after.protocolVersion}).`);
  }
  if ((before.algorithmVersion ?? "") !== (after.algorithmVersion ?? "")) {
    reasons.push(
      `Versão do algoritmo de cálculo mudou (${before.algorithmVersion ?? "—"} → ${after.algorithmVersion ?? "—"}).`
    );
  }

  const compatible = reasons.length === 0;
  return {
    metricKey: after.metricKey,
    label: after.label ?? before.label,
    side: after.side,
    unit: after.unit,
    before: vb,
    after: va,
    difference: compatible && vb !== null && va !== null ? va - vb : null,
    compatible,
    reasons,
    provisional: before.reviewDecision === null || after.reviewDecision === null,
  };
}

/** Pareia as medidas de duas sessões pela grandeza + lado e compara cada par. */
export function compareSessions(before: ComparableMeasurement[], after: ComparableMeasurement[]): ComparisonRow[] {
  const keyOf = (m: ComparableMeasurement) => `${m.metricKey}|${m.side}`;
  const beforeMap = new Map(before.map((m) => [keyOf(m), m]));
  const rows: ComparisonRow[] = [];
  for (const a of after) {
    const b = beforeMap.get(keyOf(a));
    if (b) {
      rows.push(compareMeasurements(b, a));
    } else {
      rows.push({
        metricKey: a.metricKey,
        label: a.label,
        side: a.side,
        unit: a.unit,
        before: null,
        after: effectiveValue(a),
        difference: null,
        compatible: false,
        reasons: ["Medida ausente na avaliação anterior."],
        provisional: a.reviewDecision === null,
      });
    }
  }
  return rows;
}
