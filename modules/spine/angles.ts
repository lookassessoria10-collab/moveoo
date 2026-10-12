import { Point2D } from "@/lib/types";
import { scaledDx } from "@/lib/geometry";

/**
 * Ângulo de uma linha entre dois pontos em relação à horizontal, em graus.
 * Usado para descrever a postura estática (linha dos ombros, do quadril,
 * inclinação da cabeça) — nunca como diagnóstico, apenas como observação
 * descritiva de um instante (ver seção "Postura observada" no resultado).
 */
export function tiltFromHorizontal(a: Point2D, b: Point2D): number {
  // x na mesma escala de y (proporção do quadro — ver lib/geometry.ts).
  return (Math.atan2(b.y - a.y, scaledDx(b.x - a.x)) * 180) / Math.PI;
}
