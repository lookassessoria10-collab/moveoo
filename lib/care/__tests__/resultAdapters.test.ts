import { describe, expect, it } from "vitest";
import { adaptModuleResult } from "../resultAdapters";
import { compareMeasurements, effectiveValue, type ComparableMeasurement } from "../comparison";

const pain = { hadPain: false };
const attempt = (maxAngle: number | null, i = 1) => ({
  repetitionIndex: i,
  maxAngle,
  duration: 1200,
  averageAngularVelocity: 80,
  maxTrunkCompensation: 3,
  angleBeforeCompensation: null,
  frames: [{ timestamp: 1, shoulder: { x: 0.5, y: 0.5 } }],
});

function shoulderResult(overrides: Partial<{ blocks: unknown[]; isDemo: boolean }> = {}) {
  return {
    completedAt: Date.now(),
    isDemo: false,
    intake: { symptomSide: "right", initialPain: 2, problemDuration: "weeks" },
    blocks: [
      { side: "right", movement: "flexion", pain, attempts: [attempt(150, 1), attempt(160, 2), attempt(155, 3)] },
      { side: "left", movement: "flexion", pain, attempts: [attempt(140, 1)] },
      { side: "right", movement: "abduction", pain, attempts: [] },
      { side: "left", movement: "abduction", pain, attempts: [attempt(null, 1), attempt(-5, 2)] },
    ],
    ...overrides,
  };
}

describe("adaptModuleResult — ombro", () => {
  it("recalcula a média a partir das tentativas e registra tentativas analisadas", () => {
    const r = adaptModuleResult("ombro-camera", shoulderResult());
    const flexRight = r.measurements.find((m) => m.metricKey === "ombro.flexao.elevacao_media" && m.side === "direito")!;
    expect(flexRight.value).toBeCloseTo(155);
    expect(flexRight.attemptsAnalyzed).toBe(3);
    expect(flexRight.attemptsPlanned).toBe(3);
    expect(flexRight.quality).toBe("apta");
    expect(flexRight.method).toBe("camera_2d_mediapipe");
  });

  it("bloco sem tentativas NÃO vira 0°: valor nulo + captura insuficiente com motivo", () => {
    const r = adaptModuleResult("ombro-camera", shoulderResult());
    const abdRight = r.measurements.find((m) => m.metricKey === "ombro.abducao.elevacao_media" && m.side === "direito")!;
    expect(abdRight.value).toBeNull();
    expect(abdRight.quality).toBe("insuficiente");
    expect(abdRight.rejectionReason).toMatch(/Nenhuma repetição analisável/);
  });

  it("valores impossíveis (NaN/Infinity → null, negativos) são descartados e contados", () => {
    const r = adaptModuleResult("ombro-camera", shoulderResult());
    expect(r.discardedValues).toBe(2);
    const abdLeft = r.measurements.find((m) => m.metricKey === "ombro.abducao.elevacao_media" && m.side === "esquerdo")!;
    expect(abdLeft.value).toBeNull();
    expect(abdLeft.quality).toBe("insuficiente");
  });

  it("movimento ausente do resultado é registrado como não realizado", () => {
    const r = adaptModuleResult("ombro-camera", shoulderResult({ blocks: [] }));
    expect(r.measurements).toHaveLength(4);
    expect(r.measurements.every((m) => m.value === null && m.rejectionReason?.includes("não registrado"))).toBe(true);
  });

  it("quadros e pontos do corpo não são guardados no resumo", () => {
    const r = adaptModuleResult("ombro-camera", shoulderResult());
    expect(JSON.stringify(r.moduleSummary)).not.toContain("frames");
  });

  it("resultado de demonstração mantém a origem identificada", () => {
    const r = adaptModuleResult("ombro-camera", shoulderResult({ isDemo: true }));
    expect(r.origin).toBe("demonstracao");
    expect(r.measurements[0].method).toBe("demonstracao");
  });

  it("rejeita formato inválido", () => {
    expect(() => adaptModuleResult("ombro-camera", { blocks: "x" })).toThrow();
  });
});

describe("adaptModuleResult — joelho, coluna e postura", () => {
  it("joelho: sentar-levantar sem repetições não produz contagem 0", () => {
    const r = adaptModuleResult("joelho-camera", {
      completedAt: 1,
      isDemo: false,
      intake: { symptomSide: "testing", initialPain: 0, problemDuration: "no_pain" },
      flexionResults: [{ side: "right", pain, attempts: [{ repetitionIndex: 1, maxAngle: 110, duration: 900, maxTrunkCompensation: 2 }] }],
      squatResult: null,
      sitToStandResult: { side: "both", pain, attempts: [] },
    });
    const reps = r.measurements.find((m) => m.metricKey === "joelho.sentar_levantar.repeticoes")!;
    expect(reps.value).toBeNull();
    expect(reps.quality).toBe("insuficiente");
    const left = r.measurements.find((m) => m.metricKey === "joelho.flexao.amplitude_media" && m.side === "esquerdo")!;
    expect(left.value).toBeNull();
  });

  it("coluna: inclinações laterais ficam com o lado anatômico informado pelo teste", () => {
    const r = adaptModuleResult("coluna-camera", {
      completedAt: 1,
      isDemo: false,
      intake: { painArea: "no_pain", initialPain: 0, problemDuration: "no_pain" },
      results: [
        { test: "lateralRight", pain, attempts: [{ repetitionIndex: 1, maxAngle: 25, duration: 800, hipCompensation: 1 }] },
        { test: "lateralLeft", pain, attempts: [{ repetitionIndex: 1, maxAngle: 20, duration: 800, hipCompensation: 1 }] },
      ],
    });
    const right = r.measurements.find((m) => m.metricKey === "coluna.inclinacao_lateral.inclinacao_media" && m.side === "direito")!;
    const left = r.measurements.find((m) => m.metricKey === "coluna.inclinacao_lateral.inclinacao_media" && m.side === "esquerdo")!;
    expect(right.value).toBe(25);
    expect(left.value).toBe(20);
  });

  it("postura: leitura nula vira captura insuficiente", () => {
    const r = adaptModuleResult("postura-sentada-camera", {
      completedAt: 1,
      isDemo: false,
      reading: { trunkTiltDeg: null, neckTiltDeg: 12, trunkTiltStdDev: 1, neckTiltStdDev: 1 },
    });
    expect(r.measurements[0].quality).toBe("insuficiente");
    expect(r.measurements[1].value).toBe(12);
  });
});

describe("comparação entre avaliações", () => {
  const base: ComparableMeasurement = {
    metricKey: "ombro.flexao.elevacao_media",
    side: "direito",
    unit: "graus",
    method: "camera_2d_mediapipe",
    origin: "camera",
    quality: "apta",
    value: 95,
    reviewDecision: "aceita",
    correctedValue: null,
    protocolId: "ombro-camera",
    protocolVersion: "1.0.0",
    algorithmVersion: "2026.09-smoothing-v1",
    capturedAt: new Date(),
  };

  it("mesma grandeza, método e versões: mostra a diferença (sem rotular como melhora)", () => {
    const row = compareMeasurements(base, { ...base, value: 110 });
    expect(row.compatible).toBe(true);
    expect(row.difference).toBe(15);
  });

  it("versão do algoritmo diferente: incompatível e explica o motivo", () => {
    const row = compareMeasurements(base, { ...base, value: 110, algorithmVersion: "2026.10-x" });
    expect(row.compatible).toBe(false);
    expect(row.difference).toBeNull();
    expect(row.reasons.join(" ")).toMatch(/algoritmo/);
  });

  it("métodos diferentes (câmera × goniômetro) não são comparados diretamente", () => {
    const row = compareMeasurements(base, { ...base, method: "goniometro", origin: "manual_profissional" });
    expect(row.compatible).toBe(false);
  });

  it("correção do profissional vale para a comparação; descarte remove o valor", () => {
    expect(effectiveValue({ ...base, reviewDecision: "corrigida", correctedValue: 100 })).toBe(100);
    expect(effectiveValue({ ...base, reviewDecision: "descartada" })).toBeNull();
    const row = compareMeasurements({ ...base, reviewDecision: "corrigida", correctedValue: 100 }, { ...base, value: 110 });
    expect(row.difference).toBe(10);
  });
});
