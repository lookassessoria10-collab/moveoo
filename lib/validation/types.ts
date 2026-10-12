// Tipos do modo de validação (comparação com goniômetro/inclinômetro).
// Usado apenas por quem entra com ?modo=validacao na URL — nunca aparece
// para o paciente comum.

import { FrameLandmarks } from "@/lib/types";

export type Instrument = "goniometro" | "inclinometro";

export type ValidationRegion = "ombro" | "joelho";

export type ValidationRecordStatus = "valida" | "cancelada";

/**
 * Uma linha do CSV exportado: uma repetição medida (ou cancelada) durante
 * o modo de validação. Nenhum campo identifica a pessoa — só códigos
 * digitados manualmente (ex.: "V01", "EX1").
 */
export interface ValidationRecord {
  /** Liga esta linha do CSV à sequência de pontos brutos correspondente (ver RawFrameRecord). */
  recordId: string;
  algorithmVersion: string;
  volunteerCode: string;
  examinerCode: string;
  region: ValidationRegion;
  test: string; // ex.: "flexion", "abduction", "squat", "sitToStand"
  side: string; // "right" | "left" | "both"
  repetitionIndex: number; // 1-based
  status: ValidationRecordStatus;
  cancelReason: string | null;
  /** Valor oficial que o app mostra hoje (platô suavizado no topo do movimento). */
  stablePeakDeg: number | null;
  /** Média do sinal já suavizado, do início do movimento até o pico. */
  meanDeg: number | null;
  /** Maior valor bruto (antes da suavização) visto durante a repetição. */
  rawMaxDeg: number | null;
  /** Confiança média (0 a 1) dos pontos do corpo usados, durante a repetição. */
  avgLandmarkConfidence: number | null;
  trunkCompensationDeg: number | null;
  view: "frente" | "perfil";
  instrument: Instrument;
  referenceValueDeg: number | null;
  /** Segundos entre o app travar o valor ("segure a posição") e o examinador confirmar. */
  secondsToConfirm: number | null;
  userAgent: string;
  timestampIso: string;
}

/**
 * Um quadro gravado dentro de uma repetição, ANTES da suavização —
 * matéria-prima para reprocessar com qualquer versão do algoritmo depois
 * (ver scripts/reprocess-validation.ts). Nenhuma imagem/vídeo, só
 * coordenadas.
 */
export interface RawFrameSample {
  /** performance.now() no momento da captura deste quadro. */
  t: number;
  /** Landmarks normalizados (0 a 1), espelhados — o mesmo referencial usado em todos os cálculos do app. */
  landmarks: FrameLandmarks;
  /** Landmarks 3D em metros (saída separada do MediaPipe) — null se o modelo não os entregou naquele quadro. */
  worldLandmarks: FrameLandmarks | null;
  /**
   * Proporção largura ÷ altura do quadro (lib/geometry.ts). Ausente nas
   * gravações anteriores à versão "2026.10-proporcao-v1" — nelas o
   * reprocessamento usa 1, que reproduz o cálculo antigo.
   */
  aspect?: number;
}

/**
 * A sequência bruta de uma repetição inteira (uma por linha do CSV,
 * ligada por "recordId"), incluindo a calibração daquele bloco — o
 * necessário para recalcular o valor medido com qualquer versão do
 * algoritmo sem precisar de nova coleta.
 */
export interface RawFrameRecord {
  recordId: string;
  algorithmVersion: string;
  volunteerCode: string;
  examinerCode: string;
  region: ValidationRegion;
  test: string;
  side: string;
  repetitionIndex: number;
  status: ValidationRecordStatus;
  referenceValueDeg: number | null;
  instrument: Instrument;
  /** Cópia do objeto de calibração do bloco (ex.: neutralArmAngleRight/Left, neutralTrunkAngle) — formato varia por região. */
  calibration: Record<string, unknown>;
  samples: RawFrameSample[];
}
