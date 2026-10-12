import { Point2D } from "@/lib/types";
import { scaledDx } from "@/lib/geometry";

/**
 * Inclinação, em graus, do segmento lowerPoint->upperPoint em relação à
 * vertical. 0° quando upperPoint está exatamente acima de lowerPoint
 * (postura ereta); cresce em direção a 90° conforme o segmento se inclina
 * para qualquer lado. Sempre positivo (não distingue frente/trás) — usado
 * como medida descritiva de inclinação, não de direção.
 */
export function tiltFromVerticalDeg(lowerPoint: Point2D, upperPoint: Point2D): number {
  const dx = scaledDx(upperPoint.x - lowerPoint.x); // mesma escala da vertical (lib/geometry.ts)
  const dy = lowerPoint.y - upperPoint.y; // positivo quando upperPoint está acima
  return (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI;
}
