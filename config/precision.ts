/**
 * Configuração central da iniciativa de precisão (2026).
 *
 * Este arquivo concentra TODOS os números novos (tolerâncias, tempos,
 * faixas) introduzidos pelas melhorias de precisão combinadas com a
 * equipe. Ele não substitui config/app.ts nem config/modules/*.ts — esses
 * continuam sendo a configuração de cada módulo já existente (ombro,
 * joelho, coluna, postura) e não são alterados por esta iniciativa. A
 * ideia é que qualquer novo ajuste relacionado a "quão precisa é a
 * medição" tenha, a partir de agora, um único lugar para ser revisado, em
 * vez de espalhado por vários arquivos.
 *
 * Cada seção abaixo é preenchida no passo do plano indicado no comentário
 * — ainda vazia até chegarmos naquele passo, para não inventar números
 * antes de desenhar como cada checagem realmente vai funcionar.
 *
 * IMPORTANTE — nenhum valor aqui foi validado clinicamente. Campos
 * marcados como "PROVISÓRIO — revisar com equipe médica" (ver
 * `referenceRanges`, passo 8) nunca devem ser exibidos na tela do
 * paciente — apenas no modo de validação/profissional (passo 2).
 */

/**
 * Versão do algoritmo de medição, usada no modo de validação (passo 2)
 * para marcar cada linha do CSV exportado. Deve ser incrementada em
 * qualquer mudança que afete o VALOR medido (suavização, estabilização,
 * protocolo do ombro, uso de coordenadas 3D etc.) — não precisa mudar por
 * ajustes só visuais/de texto.
 *
 * Histórico:
 * - "2026.09-baseline": primeira marca, antes de qualquer mudança de
 *   cálculo desta iniciativa — usada para medir a linha de base do
 *   algoritmo atual (passo 2), antes de comparar com os passos seguintes.
 * - "2026.09-smoothing-v1": passo 3 — liga o suavizador de pontos do
 *   corpo (lib/smoothing.ts) que já existia pronto, mas não estava
 *   conectado em nenhum módulo. Só afeta o valor medido para quem coletar
 *   dados de validação a partir de agora — CSVs anteriores (baseline)
 *   têm "algorithmVersion" diferente e não devem ser comparados linha a
 *   linha com os novos sem levar essa mudança em conta.
 * - "2026.10-proporcao-v1": corrige a proporção da imagem no cálculo de
 *   todos os ângulos (lib/geometry.ts, docs/auditoria.md A1). Antes, x
 *   (normalizado pela largura) e y (pela altura) eram tratados na mesma
 *   escala: com o celular em pé, um segmento a 45° saía como ~60,6°.
 *   Muda os valores de ombro, joelho, tronco e postura — resultados e
 *   CSVs das versões anteriores NÃO são comparáveis com os novos (a
 *   plataforma recusa a comparação automática entre versões). As
 *   amostras brutas passam a gravar a proporção de cada quadro.
 */
export const ALGORITHM_VERSION = "2026.10-proporcao-v1";

export const PRECISION_CONFIG = {
  // Passo 2 — modo de validação com goniômetro/inclinômetro.
  validation: {
    // Passo intermediário (antes do passo 4): gravação dos pontos do
    // corpo quadro a quadro, ANTES da suavização — para reprocessar
    // depois com qualquer versão do algoritmo, sem precisar de nova
    // coleta. Ver lib/validation/rawFrameDb.ts.
    //
    // 0 = grava todo quadro processado durante a repetição, sem pular
    // nenhum. Cheguei a considerar gravar só 1 a cada ~80ms (~12,5
    // quadros por segundo) para ocupar menos espaço, mas voltei atrás:
    // o suavizador (lib/smoothing.ts) reage a CADA quadro que recebe,
    // não a um intervalo de tempo fixo — se o reprocessamento receber
    // uma sequência mais espaçada do que a que o suavizador realmente
    // viu ao vivo, o resultado da suavização reprocessada não bate mais
    // com o que o app mediu de verdade. Como o custo em espaço de
    // gravar tudo é pequeno (poucas centenas de KB por repetição, não
    // imagem/vídeo, só números), preferi manter fiel em vez de
    // economizar espaço que não estava fazendo falta. Se algum dia o
    // volume virar problema na prática, é só aumentar este número.
    rawFrameSampleIntervalMs: 0,
  },

  // Passo 3 — ligar o suavizador de pontos do corpo (lib/smoothing.ts).
  //
  // Filtro usado: média móvel exponencial (EMA — "Exponential Moving
  // Average"), um dos filtros de suavização mais simples e comuns que
  // existem. Para cada ponto do corpo, em vez de confiar 100% na leitura
  // nova da câmera, ele mistura a leitura nova com o valor já suavizado
  // do quadro anterior:
  //
  //   novo_suavizado = suavizado_anterior + alpha × (bruto_novo − suavizado_anterior)
  //
  // alpha = quanto peso a leitura NOVA recebe nessa mistura, de 0 a 1.
  //   - Mais perto de 1: responde mais rápido ao movimento real, mas
  //     suaviza menos o tremor.
  //   - Mais perto de 0: suaviza mais o tremor, mas demora mais para
  //     "acompanhar" um movimento rápido.
  //
  // Efeito colateral esperado (e por isso o modo de validação existe):
  // esse tipo de filtro SEMPRE atrasa um pouco a detecção do pico (o app
  // pode demorar alguns quadros a mais para perceber que a pessoa já
  // chegou no topo do movimento) e PODE reduzir levemente o valor do
  // pico relatado, se o movimento for rápido e a pessoa não segurar a
  // posição no topo — o filtro "não tem tempo" de acompanhar um pico
  // muito rápido e passageiro. Se a pessoa segura a posição por um
  // instante no topo (como o passo 5 vai reforçar com o "segure...
  // pronto"), o filtro tem tempo de alcançar o valor real, e esse efeito
  // fica bem menor.
  smoothing: {
    // 0.35 é o valor com que lib/smoothing.ts (PointEmaFilter) já foi
    // escrito e testado isoladamente — mantido aqui como o mesmo número,
    // só que agora documentado e num lugar central em vez de um valor
    // padrão perdido dentro da classe.
    emaAlpha: 0.35,
  },

  // Passo 4 — checagens antes de medir (inclinação do celular, luz).
  preCheck: {},

  // Passo 5 — estabilização por tempo + mediana + repetição extra.
  stabilization: {},

  // Passo 6 — compensação (ex.: tronco) detectada em tempo real.
  compensation: {},

  // Passo 7 — novo protocolo do ombro (flexão de perfil, elevação de frente).
  shoulderProtocol: {},

  // Passo 8 — indicador de confiabilidade do resultado (Alta/Média/Baixa).
  reliability: {},

  // Passo 8 — PROVISÓRIO, revisar com equipe médica antes de qualquer uso.
  // Nunca exibido na tela do paciente — só no modo de validação/profissional.
  referenceRanges: {},
} as const;

export type PrecisionConfig = typeof PRECISION_CONFIG;
