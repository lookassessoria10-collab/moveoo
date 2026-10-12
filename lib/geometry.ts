import { Point2D } from "./types";

/**
 * Proporção largura ÷ altura do quadro que o MediaPipe analisou.
 *
 * Os pontos do MediaPipe vêm normalizados SEPARADAMENTE: x de 0 a 1 na
 * largura e y de 0 a 1 na altura. Num vídeo 720×1280 (celular em pé), uma
 * unidade de x vale 720 px e uma de y vale 1280 px — calcular ângulos
 * direto nesses números distorce tudo que não é 0°, 90° ou 180° (um
 * segmento a 45° saía como ~60,6°). Antes de qualquer ângulo, cada
 * diferença em x é multiplicada por esta proporção, o que põe x e y na
 * mesma escala. (docs/auditoria.md, achado A1; ALGORITHM_VERSION
 * "2026.10-proporcao-v1".)
 *
 * É atualizada a cada quadro pelo laço de detecção (usePoseLandmarker),
 * com as dimensões do vídeo lidas no mesmo instante em que o quadro vai
 * para o MediaPipe. O valor 1 (padrão) reproduz o cálculo antigo — usado
 * pelos testes e pelo reprocessamento de gravações sem a proporção.
 *
 * Só ângulos usam este fator. Checagens de enquadramento continuam nas
 * coordenadas normalizadas, com os limites com que foram ajustadas.
 */
let frameAspect = 1;

export function setFrameAspect(aspect: number): void {
  frameAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

export function getFrameAspect(): number {
  return frameAspect;
}

/** Diferença horizontal na mesma escala da vertical. */
export function scaledDx(dx: number): number {
  return dx * frameAspect;
}

/** Ângulo (graus, 0-180) formado no vértice `b` pelos pontos a-b-c. */
export function angleBetweenPoints(a: Point2D, b: Point2D, c: Point2D): number {
  const v1 = { x: scaledDx(a.x - b.x), y: a.y - b.y };
  const v2 = { x: scaledDx(c.x - b.x), y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Ângulo do segmento a->b em relação à vertical (0 = para baixo, 180 = para cima), em graus. */
export function angleFromVertical(a: Point2D, b: Point2D): number {
  const dx = scaledDx(b.x - a.x);
  const dy = b.y - a.y;
  // vetor "para baixo" de referência é (0, 1) em coordenadas de imagem (y cresce para baixo)
  const angleRad = Math.atan2(dx, dy);
  let deg = (angleRad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
