import { Point2D } from "./types";
import { midpoint, scaledDx } from "./geometry";

/**
 * Ângulo de elevação do braço: vértice no ombro, entre o vetor
 * ombro->quadril (eixo do tronco) e o vetor ombro->cotovelo (braço).
 *
 * Uma câmera frontal 2D não separa com precisão o plano sagital (flexão)
 * do plano frontal (abdução) — ambos aparecem como elevação do braço na
 * imagem. Por isso as duas funções abaixo compartilham o mesmo cálculo
 * geométrico de base; a diferenciação real depende do plano do movimento
 * orientado ao usuário, não da geometria isolada. Isto é uma limitação
 * conhecida e documentada (ver README).
 */
function armElevationAngle(shoulder: Point2D, elbow: Point2D, hip: Point2D): number {
  // x e y na mesma escala (proporção do quadro — ver lib/geometry.ts).
  const trunkVec = { x: scaledDx(hip.x - shoulder.x), y: hip.y - shoulder.y };
  const armVec = { x: scaledDx(elbow.x - shoulder.x), y: elbow.y - shoulder.y };
  const dot = trunkVec.x * armVec.x + trunkVec.y * armVec.y;
  const magTrunk = Math.hypot(trunkVec.x, trunkVec.y);
  const magArm = Math.hypot(armVec.x, armVec.y);
  if (magTrunk === 0 || magArm === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot / (magTrunk * magArm)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Estimativa do ângulo de flexão do ombro (0° braço ao lado do corpo, 180° acima da cabeça). */
export function calculateShoulderFlexionAngle(
  shoulder: Point2D,
  elbow: Point2D,
  hip: Point2D
): number {
  return armElevationAngle(shoulder, elbow, hip);
}

/** Estimativa do ângulo de abdução do ombro (0° braço ao lado do corpo, 180° acima da cabeça). */
export function calculateAbductionAngle(
  shoulder: Point2D,
  elbow: Point2D,
  hip: Point2D
): number {
  return armElevationAngle(shoulder, elbow, hip);
}

/**
 * Inclinação do tronco em relação à vertical, em graus.
 * 0° = tronco perfeitamente ereto (ombros acima do quadril).
 * Valor assinado: positivo = inclinação para a direita da imagem.
 */
export function calculateTrunkAngle(
  leftShoulder: Point2D,
  rightShoulder: Point2D,
  leftHip: Point2D,
  rightHip: Point2D
): number {
  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const dx = scaledDx(shoulderMid.x - hipMid.x);
  const dy = shoulderMid.y - hipMid.y; // negativo: ombro acima do quadril (esperado)
  const angleRad = Math.atan2(dx, -dy);
  return (angleRad * 180) / Math.PI;
}

/** Largura dos ombros em pixels (usada para orientar distância/posicionamento). */
export function shoulderWidth(leftShoulder: Point2D, rightShoulder: Point2D): number {
  return Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
}
