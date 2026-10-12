/**
 * Registro de protocolos de avaliação.
 *
 * Um protocolo diz exatamente O QUE é coletado, COMO (posição da câmera,
 * tentativas) e QUAIS grandezas resultam, com unidade e limitações. Cada
 * resultado persistido guarda id + versão do protocolo, versão do
 * algoritmo e do modelo — é isso que permite comparar avaliações ou
 * explicar por que não são comparáveis.
 *
 * Os protocolos de câmera reaproveitam os módulos existentes (ombro,
 * joelho, coluna, postura) sem alterar seus cálculos. Nenhum deles é
 * clinicamente validado; o estado de liberação de cada um é controlado
 * em lib/server/services/core.ts (assertProtocolExecutable).
 */
import { ALGORITHM_VERSION } from "@/config/precision";

export type ProtocolId =
  | "ombro-camera"
  | "joelho-camera"
  | "coluna-camera"
  | "postura-sentada-camera"
  | "registro-presencial";

export type Region = "shoulder" | "knee" | "spine" | "posture";

export interface MetricDefinition {
  key: string;
  label: string;
  movement: string;
  side: "direito" | "esquerdo" | "bilateral" | "nao_se_aplica";
  unit: "graus" | "segundos" | "repeticoes" | "proporcao";
}

export interface ProtocolDefinition {
  id: ProtocolId;
  version: string;
  title: string;
  shortTitle: string;
  kind: "camera" | "manual";
  region: Region | null;
  /** Chave do controle de liberação. null = função administrativa (sem mensuração automática). */
  featureKey: string | null;
  method: string;
  algorithmVersion: string | null;
  attemptsPerMovement: number | null;
  capture: string;
  personInstructions: string;
  metrics: MetricDefinition[];
  limitations: string[];
}

const CAMERA_METHOD = "camera_2d_mediapipe";

export const PROTOCOLS: Record<ProtocolId, ProtocolDefinition> = {
  "ombro-camera": {
    id: "ombro-camera",
    version: "1.0.0",
    title: "Ombro — elevação do braço (flexão e elevação lateral), vista frontal",
    shortTitle: "Ombro",
    kind: "camera",
    region: "shoulder",
    featureKey: "mensuracao_camera_ombro",
    method: CAMERA_METHOD,
    algorithmVersion: ALGORITHM_VERSION,
    attemptsPerMovement: 3,
    capture: "Celular apoiado, de frente para a pessoa; tronco e braços inteiros visíveis.",
    personInstructions:
      "Você vai levantar cada braço para a frente e para o lado, três vezes, até onde for confortável.",
    metrics: [
      { key: "ombro.flexao.elevacao_media", label: "Flexão — elevação do braço em relação ao tronco", movement: "flexao", side: "direito", unit: "graus" },
      { key: "ombro.flexao.elevacao_media", label: "Flexão — elevação do braço em relação ao tronco", movement: "flexao", side: "esquerdo", unit: "graus" },
      { key: "ombro.abducao.elevacao_media", label: "Elevação lateral — elevação do braço em relação ao tronco", movement: "abducao", side: "direito", unit: "graus" },
      { key: "ombro.abducao.elevacao_media", label: "Elevação lateral — elevação do braço em relação ao tronco", movement: "abducao", side: "esquerdo", unit: "graus" },
    ],
    limitations: [
      "Elevação do braço em relação ao tronco; não isola a articulação glenoumeral.",
      "A flexão é observada em vista frontal: a câmera 2D não separa bem o plano sagital do frontal.",
      "Inclinação do tronco e movimento fora do plano alteram a estimativa.",
    ],
  },
  "joelho-camera": {
    id: "joelho-camera",
    version: "1.0.0",
    title: "Joelho — flexão por lado, agachamento e sentar-levantar",
    shortTitle: "Joelho",
    kind: "camera",
    region: "knee",
    featureKey: "mensuracao_camera_joelho",
    method: CAMERA_METHOD,
    algorithmVersion: ALGORITHM_VERSION,
    attemptsPerMovement: 3,
    capture:
      "Flexão e sentar-levantar com o celular de lado (quadril, joelho e tornozelo visíveis); agachamento de frente.",
    personInstructions:
      "Você vai dobrar cada joelho, fazer agachamentos e sentar e levantar de uma cadeira estável, sempre até onde for confortável.",
    metrics: [
      { key: "joelho.flexao.amplitude_media", label: "Flexão do joelho (em pé)", movement: "flexao", side: "direito", unit: "graus" },
      { key: "joelho.flexao.amplitude_media", label: "Flexão do joelho (em pé)", movement: "flexao", side: "esquerdo", unit: "graus" },
      { key: "joelho.agachamento.flexao_media", label: "Agachamento — flexão média dos joelhos no ponto mais baixo", movement: "agachamento", side: "bilateral", unit: "graus" },
      { key: "joelho.agachamento.assimetria_media", label: "Agachamento — diferença média entre os joelhos", movement: "agachamento", side: "bilateral", unit: "graus" },
      { key: "joelho.sentar_levantar.repeticoes", label: "Sentar e levantar — repetições analisadas", movement: "sentar_levantar", side: "bilateral", unit: "repeticoes" },
      { key: "joelho.sentar_levantar.tempo_medio", label: "Sentar e levantar — tempo médio do início ao pico", movement: "sentar_levantar", side: "bilateral", unit: "segundos" },
      { key: "joelho.sentar_levantar.apoio_maos", label: "Sentar e levantar — repetições com indício de apoio das mãos", movement: "sentar_levantar", side: "bilateral", unit: "repeticoes" },
    ],
    limitations: [
      "Roupa, posição da câmera e segmentos escondidos afetam a medida.",
      "Agachamento coletado só de frente: não é reconstrução 3D.",
      "Sentar e levantar não mede força muscular.",
      "O indício de apoio das mãos é heurístico (mãos próximas ao quadril).",
    ],
  },
  "coluna-camera": {
    id: "coluna-camera",
    version: "1.0.0",
    title: "Tronco — flexão, inclinações laterais e extensão (inclinação global)",
    shortTitle: "Tronco",
    kind: "camera",
    region: "spine",
    featureKey: "mensuracao_camera_coluna",
    method: CAMERA_METHOD,
    algorithmVersion: ALGORITHM_VERSION,
    attemptsPerMovement: 3,
    capture: "Flexão e extensão com o celular de lado; inclinações laterais de frente.",
    personInstructions:
      "Você vai inclinar o tronco para a frente, para os lados e para trás, sempre até onde for confortável.",
    metrics: [
      { key: "coluna.flexao.inclinacao_media", label: "Flexão anterior — inclinação global do tronco", movement: "flexao", side: "nao_se_aplica", unit: "graus" },
      { key: "coluna.inclinacao_lateral.inclinacao_media", label: "Inclinação lateral — inclinação global do tronco", movement: "inclinacao_lateral", side: "direito", unit: "graus" },
      { key: "coluna.inclinacao_lateral.inclinacao_media", label: "Inclinação lateral — inclinação global do tronco", movement: "inclinacao_lateral", side: "esquerdo", unit: "graus" },
      { key: "coluna.extensao.inclinacao_media", label: "Extensão — inclinação global do tronco", movement: "extensao", side: "nao_se_aplica", unit: "graus" },
    ],
    limitations: [
      "Inclinação global do segmento ombros–quadril; não corresponde à amplitude lombar nem a segmentos da coluna.",
      "Movimento da pelve pode confundir a leitura.",
    ],
  },
  "postura-sentada-camera": {
    id: "postura-sentada-camera",
    version: "1.0.0",
    title: "Postura sentada — observação descritiva (vista lateral)",
    shortTitle: "Postura sentada",
    kind: "camera",
    region: "posture",
    featureKey: "observacao_camera_postura",
    method: CAMERA_METHOD,
    algorithmVersion: ALGORITHM_VERSION,
    attemptsPerMovement: null,
    capture: "Celular de lado, pessoa sentada na posição habitual de trabalho.",
    personInstructions: "Sente-se como costuma ficar no dia a dia e permaneça parado por alguns segundos.",
    metrics: [
      { key: "postura.tronco.inclinacao", label: "Inclinação do tronco em relação à vertical", movement: "postura_sentada", side: "nao_se_aplica", unit: "graus" },
      { key: "postura.pescoco.inclinacao", label: "Inclinação da cabeça em relação ao ombro", movement: "postura_sentada", side: "nao_se_aplica", unit: "graus" },
    ],
    limitations: [
      "Descrição da posição observada durante a captura; não conclui doença, causa de dor nem diagnóstico ergonômico.",
    ],
  },
  "registro-presencial": {
    id: "registro-presencial",
    version: "1.0.0",
    title: "Registro de medição presencial (feita pelo profissional)",
    shortTitle: "Medição presencial",
    kind: "manual",
    region: null,
    featureKey: null,
    method: "manual_profissional",
    algorithmVersion: null,
    attemptsPerMovement: null,
    capture: "Medição realizada pelo profissional, com o instrumento informado.",
    personInstructions: "",
    metrics: [],
    limitations: ["Valor informado pelo profissional; o método e o instrumento ficam registrados com a medida."],
  },
};

export const CAMERA_PROTOCOLS = Object.values(PROTOCOLS).filter((p) => p.kind === "camera");

export function getProtocol(id: string): ProtocolDefinition | null {
  return (PROTOCOLS as Record<string, ProtocolDefinition>)[id] ?? null;
}

// ---------------------------------------------------------------------------
// Movimentos que podem ser pedidos separadamente
// ---------------------------------------------------------------------------

/**
 * Um item é a menor parte de um protocolo que o profissional pode pedir
 * sozinha (ex.: só a flexão do ombro direito). `moduleKey` identifica o
 * teste na fila do módulo de câmera; `metrics` lista as medidas que o
 * item produz (grandeza + lado), para que o resultado contenha só o que
 * foi pedido.
 */
export interface ProtocolItem {
  id: string;
  label: string;
  moduleKey: string;
  metrics: [string, MetricDefinition["side"]][];
}

export const PROTOCOL_ITEMS: Partial<Record<ProtocolId, ProtocolItem[]>> = {
  "ombro-camera": [
    { id: "flexao-direito", label: "Flexão — braço direito", moduleKey: "flexion:right", metrics: [["ombro.flexao.elevacao_media", "direito"]] },
    { id: "flexao-esquerdo", label: "Flexão — braço esquerdo", moduleKey: "flexion:left", metrics: [["ombro.flexao.elevacao_media", "esquerdo"]] },
    { id: "abducao-direito", label: "Elevação lateral — braço direito", moduleKey: "abduction:right", metrics: [["ombro.abducao.elevacao_media", "direito"]] },
    { id: "abducao-esquerdo", label: "Elevação lateral — braço esquerdo", moduleKey: "abduction:left", metrics: [["ombro.abducao.elevacao_media", "esquerdo"]] },
  ],
  "joelho-camera": [
    { id: "flexao-direito", label: "Flexão — joelho direito", moduleKey: "flexion:right", metrics: [["joelho.flexao.amplitude_media", "direito"]] },
    { id: "flexao-esquerdo", label: "Flexão — joelho esquerdo", moduleKey: "flexion:left", metrics: [["joelho.flexao.amplitude_media", "esquerdo"]] },
    {
      id: "agachamento",
      label: "Agachamento",
      moduleKey: "squat:both",
      metrics: [
        ["joelho.agachamento.flexao_media", "bilateral"],
        ["joelho.agachamento.assimetria_media", "bilateral"],
      ],
    },
    {
      id: "sentar-levantar",
      label: "Sentar e levantar",
      moduleKey: "sitToStand:both",
      metrics: [
        ["joelho.sentar_levantar.repeticoes", "bilateral"],
        ["joelho.sentar_levantar.tempo_medio", "bilateral"],
        ["joelho.sentar_levantar.apoio_maos", "bilateral"],
      ],
    },
  ],
  "coluna-camera": [
    { id: "flexao", label: "Flexão anterior do tronco", moduleKey: "flexion", metrics: [["coluna.flexao.inclinacao_media", "nao_se_aplica"]] },
    { id: "inclinacao-direita", label: "Inclinação lateral — direita", moduleKey: "lateralRight", metrics: [["coluna.inclinacao_lateral.inclinacao_media", "direito"]] },
    { id: "inclinacao-esquerda", label: "Inclinação lateral — esquerda", moduleKey: "lateralLeft", metrics: [["coluna.inclinacao_lateral.inclinacao_media", "esquerdo"]] },
    { id: "extensao", label: "Extensão do tronco", moduleKey: "extension", metrics: [["coluna.extensao.inclinacao_media", "nao_se_aplica"]] },
  ],
};

export function protocolItems(protocolId: string): ProtocolItem[] {
  return PROTOCOL_ITEMS[protocolId as ProtocolId] ?? [];
}

/**
 * Normaliza a seleção recebida: só ids existentes, na ordem do protocolo.
 * Retorna null quando a seleção cobre o protocolo inteiro (ou o protocolo
 * não é separável). Lança erro se nenhum item válido foi escolhido.
 */
export function normalizeSelection(protocolId: string, selected: string[] | null | undefined): string[] | null {
  const items = protocolItems(protocolId);
  if (!items.length || !selected) return null;
  const chosen = items.filter((i) => selected.includes(i.id)).map((i) => i.id);
  if (chosen.length === 0) throw new Error("Escolha ao menos um movimento.");
  return chosen.length === items.length ? null : chosen;
}

/** Itens efetivamente pedidos (todos, quando a seleção é null). */
export function selectedItems(protocolId: string, selection: string[] | null | undefined): ProtocolItem[] {
  const items = protocolItems(protocolId);
  return selection ? items.filter((i) => selection.includes(i.id)) : items;
}

/** Instrumentos aceitos no registro presencial. */
export const MANUAL_INSTRUMENTS = {
  goniometro: "Goniômetro",
  inclinometro: "Inclinômetro",
  fita_metrica: "Fita métrica",
  cronometro: "Cronômetro",
  contagem: "Contagem",
} as const;
export type ManualInstrument = keyof typeof MANUAL_INSTRUMENTS;

export const UNIT_LABEL: Record<string, string> = {
  graus: "°",
  segundos: "s",
  repeticoes: "rep.",
  proporcao: "",
  centimetros: "cm",
};

export const SIDE_LABEL: Record<string, string> = {
  direito: "Direito",
  esquerdo: "Esquerdo",
  bilateral: "Bilateral",
  nao_se_aplica: "—",
};

export const METHOD_LABEL: Record<string, string> = {
  camera_2d_mediapipe: "Câmera do celular (estimativa 2D)",
  demonstracao: "Demonstração (dado fictício)",
  goniometro: "Goniômetro (profissional)",
  inclinometro: "Inclinômetro (profissional)",
  fita_metrica: "Fita métrica (profissional)",
  cronometro: "Cronômetro (profissional)",
  contagem: "Contagem (profissional)",
};

export function formatValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "sem valor";
  const digits = unit === "segundos" ? 1 : 0;
  const suffix = UNIT_LABEL[unit] ?? ` ${unit}`;
  return `${value.toFixed(digits)}${suffix === "°" ? "°" : suffix ? ` ${suffix}` : ""}`;
}
