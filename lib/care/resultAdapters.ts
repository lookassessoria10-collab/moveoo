/**
 * Converte o resultado de um módulo de avaliação (ombro, joelho, coluna,
 * postura) no contrato de resultado da plataforma: uma lista de medidas,
 * cada uma com grandeza, lado, unidade, método, tentativas e qualidade.
 *
 * Roda NO SERVIDOR sobre o JSON enviado pelo navegador:
 * - O schema descarta tudo que não é resumo (quadros e pontos do corpo
 *   nunca são persistidos por este caminho).
 * - Os valores são recalculados a partir das tentativas, em vez de
 *   confiar nas médias prontas do cliente.
 * - Captura insuficiente vira `value: null` + motivo — nunca 0°.
 *   (Os módulos antigos usam average([]) = 0 e Math.max() = -Infinity
 *   quando não há tentativas; ver docs/auditoria.md.)
 */
import { z } from "zod";
import { getProtocol, type MetricDefinition, type ProtocolDefinition, type Region } from "./protocols";

// JSON transforma NaN/Infinity em null — por isso todo número é anulável.
const num = z.number().nullable();
const pain = z.object({
  hadPain: z.boolean(),
  intensity: z.number().min(0).max(10).nullable().optional(),
  moment: z.string().max(40).nullable().optional(),
});
const intakeBase = {
  initialPain: num,
  problemDuration: z.string().max(40),
};

const shoulderSchema = z.object({
  completedAt: z.number(),
  isDemo: z.boolean(),
  intake: z.object({ symptomSide: z.string().max(20), ...intakeBase }),
  blocks: z
    .array(
      z.object({
        side: z.enum(["right", "left"]),
        movement: z.enum(["flexion", "abduction"]),
        pain,
        attempts: z
          .array(
            z.object({
              repetitionIndex: z.number(),
              maxAngle: num,
              duration: num,
              maxTrunkCompensation: num,
              angleBeforeCompensation: num,
            })
          )
          .max(20),
      })
    )
    .max(8),
});

const kneeTest = z.object({
  side: z.enum(["right", "left", "both"]),
  pain,
  attempts: z
    .array(
      z.object({
        repetitionIndex: z.number(),
        maxAngle: num,
        duration: num,
        maxTrunkCompensation: num,
        handsUsed: z.boolean().nullable().optional(),
      })
    )
    .max(20),
  kneeAsymmetryDeg: num.optional(),
  maxHipLateralShift: num.optional(),
});
const kneeSchema = z.object({
  completedAt: z.number(),
  isDemo: z.boolean(),
  intake: z.object({ symptomSide: z.string().max(20), ...intakeBase }),
  flexionResults: z.array(kneeTest).max(4),
  squatResult: kneeTest.nullable(),
  sitToStandResult: kneeTest.nullable(),
});

const spineSchema = z.object({
  completedAt: z.number(),
  isDemo: z.boolean(),
  intake: z.object({ painArea: z.string().max(20), ...intakeBase }),
  results: z
    .array(
      z.object({
        test: z.enum(["flexion", "lateralRight", "lateralLeft", "extension"]),
        pain,
        attempts: z
          .array(z.object({ repetitionIndex: z.number(), maxAngle: num, duration: num, hipCompensation: num }))
          .max(20),
      })
    )
    .max(8),
});

const postureSchema = z.object({
  completedAt: z.number(),
  isDemo: z.boolean(),
  reading: z.object({
    trunkTiltDeg: num,
    neckTiltDeg: num,
    trunkTiltStdDev: num,
    neckTiltStdDev: num,
  }),
});

export interface MeasurementDraft {
  metricKey: string;
  movement: string;
  side: MetricDefinition["side"];
  value: number | null;
  unit: string;
  method: string;
  attemptsPlanned: number | null;
  attemptsAnalyzed: number | null;
  quality: "apta" | "insuficiente";
  rejectionReason: string | null;
}

export interface AdaptedResult {
  origin: "camera" | "demonstracao";
  /** Valores recebidos e descartados por serem impossíveis (NaN, infinito, fora da faixa) — registrados como evento técnico. */
  discardedValues: number;
  measurements: MeasurementDraft[];
  moduleSummary: unknown;
  reportedContext: Record<string, unknown>;
}

// Contador da conversão em andamento (os adaptadores são síncronos; zerado a cada chamada).
let discardedCounter = 0;

const ANGLE_MIN = 0;
const ANGLE_MAX = 180;

function isPlausibleAngle(v: number | null | undefined, min = ANGLE_MIN, max = ANGLE_MAX): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

const REASON_NOT_DONE = "Movimento não registrado nesta sessão.";
const REASON_NO_VALID = "Nenhuma repetição analisável (pontos do corpo ausentes ou valor fora do possível).";

function makeMetric(
  protocol: ProtocolDefinition,
  metric: MetricDefinition,
  method: string,
  values: (number | null | undefined)[] | null,
  opts: { min?: number; max?: number; aggregate?: (xs: number[]) => number } = {}
): MeasurementDraft {
  const base = {
    metricKey: metric.key,
    movement: metric.movement,
    side: metric.side,
    unit: metric.unit,
    method,
    attemptsPlanned: protocol.attemptsPerMovement,
  };
  if (values === null) {
    return { ...base, value: null, attemptsAnalyzed: 0, quality: "insuficiente", rejectionReason: REASON_NOT_DONE };
  }
  const valid = values.filter((v): v is number => isPlausibleAngle(v, opts.min, opts.max));
  discardedCounter += values.length - valid.length;
  if (valid.length === 0) {
    return { ...base, value: null, attemptsAnalyzed: 0, quality: "insuficiente", rejectionReason: REASON_NO_VALID };
  }
  const value = (opts.aggregate ?? mean)(valid);
  return { ...base, value, attemptsAnalyzed: valid.length, quality: "apta", rejectionReason: null };
}

function metricFor(protocol: ProtocolDefinition, key: string, side: string): MetricDefinition {
  const m = protocol.metrics.find((x) => x.key === key && x.side === side);
  if (!m) throw new Error(`Métrica ${key}/${side} não existe no protocolo ${protocol.id}`);
  return m;
}

const SIDE_PT = { right: "direito", left: "esquerdo" } as const;

function painContext(label: string, p: z.infer<typeof pain>) {
  return { bloco: label, houveDor: p.hadPain, intensidade: p.intensity ?? null, momento: p.moment ?? null };
}

function adaptShoulder(raw: unknown, protocol: ProtocolDefinition): Omit<AdaptedResult, "discardedValues"> {
  const r = shoulderSchema.parse(raw);
  const method = r.isDemo ? "demonstracao" : protocol.method;
  const measurements: MeasurementDraft[] = [];
  for (const movement of ["flexion", "abduction"] as const) {
    for (const side of ["right", "left"] as const) {
      const block = r.blocks.find((b) => b.movement === movement && b.side === side);
      const key = movement === "flexion" ? "ombro.flexao.elevacao_media" : "ombro.abducao.elevacao_media";
      const metric = metricFor(protocol, key, SIDE_PT[side]);
      measurements.push(makeMetric(protocol, metric, method, block ? block.attempts.map((a) => a.maxAngle) : null));
    }
  }
  return {
    origin: r.isDemo ? "demonstracao" : "camera",
    measurements,
    moduleSummary: r,
    reportedContext: {
      ladoDosSintomas: r.intake.symptomSide,
      dorInicial: r.intake.initialPain,
      tempoDeQueixa: r.intake.problemDuration,
      dorDuranteOsMovimentos: r.blocks.map((b) =>
        painContext(`${b.movement === "flexion" ? "Flexão" : "Elevação lateral"} ${SIDE_PT[b.side]}`, b.pain)
      ),
    },
  };
}

function adaptKnee(raw: unknown, protocol: ProtocolDefinition): Omit<AdaptedResult, "discardedValues"> {
  const r = kneeSchema.parse(raw);
  const method = r.isDemo ? "demonstracao" : protocol.method;
  const measurements: MeasurementDraft[] = [];

  for (const side of ["right", "left"] as const) {
    const res = r.flexionResults.find((x) => x.side === side);
    const metric = metricFor(protocol, "joelho.flexao.amplitude_media", SIDE_PT[side]);
    measurements.push(makeMetric(protocol, metric, method, res ? res.attempts.map((a) => a.maxAngle) : null));
  }

  const squat = r.squatResult;
  measurements.push(
    makeMetric(protocol, metricFor(protocol, "joelho.agachamento.flexao_media", "bilateral"), method, squat ? squat.attempts.map((a) => a.maxAngle) : null)
  );
  // A assimetria é calculada no aparelho a partir dos quadros; só vale se houve repetição analisável.
  const squatHasValid = !!squat && squat.attempts.some((a) => isPlausibleAngle(a.maxAngle));
  measurements.push(
    makeMetric(
      protocol,
      metricFor(protocol, "joelho.agachamento.assimetria_media", "bilateral"),
      method,
      squat ? (squatHasValid ? [squat.kneeAsymmetryDeg ?? null] : []) : null
    )
  );

  const sts = r.sitToStandResult;
  const stsValid = sts ? sts.attempts.filter((a) => isPlausibleAngle(a.maxAngle)) : null;
  const countMetric = (key: string, count: (xs: NonNullable<typeof stsValid>) => number): MeasurementDraft => {
    const metric = metricFor(protocol, key, "bilateral");
    const draft = makeMetric(protocol, metric, method, stsValid ? stsValid.map((a) => a.maxAngle) : null);
    if (draft.quality === "apta" && stsValid) draft.value = count(stsValid);
    return draft;
  };
  measurements.push(countMetric("joelho.sentar_levantar.repeticoes", (xs) => xs.length));
  measurements.push(
    makeMetric(
      protocol,
      metricFor(protocol, "joelho.sentar_levantar.tempo_medio", "bilateral"),
      method,
      stsValid ? stsValid.map((a) => (a.duration === null ? null : a.duration / 1000)) : null,
      { min: 0.05, max: 30 }
    )
  );
  measurements.push(countMetric("joelho.sentar_levantar.apoio_maos", (xs) => xs.filter((a) => a.handsUsed).length));

  const label: Record<string, string> = { right: "direito", left: "esquerdo", both: "bilateral" };
  return {
    origin: r.isDemo ? "demonstracao" : "camera",
    measurements,
    moduleSummary: r,
    reportedContext: {
      ladoDosSintomas: r.intake.symptomSide,
      dorInicial: r.intake.initialPain,
      tempoDeQueixa: r.intake.problemDuration,
      dorDuranteOsMovimentos: [
        ...r.flexionResults.map((x) => painContext(`Flexão ${label[x.side]}`, x.pain)),
        ...(squat ? [painContext("Agachamento", squat.pain)] : []),
        ...(sts ? [painContext("Sentar e levantar", sts.pain)] : []),
      ],
    },
  };
}

const SPINE_MAP = {
  flexion: { key: "coluna.flexao.inclinacao_media", side: "nao_se_aplica", label: "Flexão anterior" },
  lateralRight: { key: "coluna.inclinacao_lateral.inclinacao_media", side: "direito", label: "Inclinação lateral direita" },
  lateralLeft: { key: "coluna.inclinacao_lateral.inclinacao_media", side: "esquerdo", label: "Inclinação lateral esquerda" },
  extension: { key: "coluna.extensao.inclinacao_media", side: "nao_se_aplica", label: "Extensão" },
} as const;

function adaptSpine(raw: unknown, protocol: ProtocolDefinition): Omit<AdaptedResult, "discardedValues"> {
  const r = spineSchema.parse(raw);
  const method = r.isDemo ? "demonstracao" : protocol.method;
  const measurements = (Object.keys(SPINE_MAP) as (keyof typeof SPINE_MAP)[]).map((test) => {
    const def = SPINE_MAP[test];
    const res = r.results.find((x) => x.test === test);
    return makeMetric(protocol, metricFor(protocol, def.key, def.side), method, res ? res.attempts.map((a) => a.maxAngle) : null);
  });
  return {
    origin: r.isDemo ? "demonstracao" : "camera",
    measurements,
    moduleSummary: r,
    reportedContext: {
      areaDosSintomas: r.intake.painArea,
      dorInicial: r.intake.initialPain,
      tempoDeQueixa: r.intake.problemDuration,
      dorDuranteOsMovimentos: r.results.map((x) => painContext(SPINE_MAP[x.test].label, x.pain)),
    },
  };
}

function adaptPosture(raw: unknown, protocol: ProtocolDefinition): Omit<AdaptedResult, "discardedValues"> {
  const r = postureSchema.parse(raw);
  const method = r.isDemo ? "demonstracao" : protocol.method;
  const single = (key: string, v: number | null) =>
    makeMetric(protocol, metricFor(protocol, key, "nao_se_aplica"), method, [v], { min: -90, max: 90 });
  return {
    origin: r.isDemo ? "demonstracao" : "camera",
    measurements: [single("postura.tronco.inclinacao", r.reading.trunkTiltDeg), single("postura.pescoco.inclinacao", r.reading.neckTiltDeg)],
    moduleSummary: r,
    reportedContext: {},
  };
}

const ADAPTERS: Record<Region, (raw: unknown, p: ProtocolDefinition) => Omit<AdaptedResult, "discardedValues">> = {
  shoulder: adaptShoulder,
  knee: adaptKnee,
  spine: adaptSpine,
  posture: adaptPosture,
};

export function adaptModuleResult(protocolId: string, raw: unknown): AdaptedResult {
  const protocol = getProtocol(protocolId);
  if (!protocol || protocol.kind !== "camera" || !protocol.region) {
    throw new Error(`Protocolo sem módulo de câmera: ${protocolId}`);
  }
  discardedCounter = 0;
  const adapted = ADAPTERS[protocol.region](raw, protocol);
  return { ...adapted, discardedValues: discardedCounter };
}
