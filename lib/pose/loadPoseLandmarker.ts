import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { POSE_MODEL_URL, POSE_WASM_BASE } from "./modelInfo";

const WASM_BASE = POSE_WASM_BASE;
// "full" em vez de "lite": mais preciso para rastrear pernas e vistas de
// perfil (joelho e coluna), que a variante "lite" tratava com bastante
// ruído/erro de estimativa ("alucinação" de landmarks fora do quadro).
// Continua rodando em tempo real no dispositivo, só um pouco mais pesado
// que "lite".
const MODEL_URL = POSE_MODEL_URL;

let filesetCache: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
const landmarkerCache = new Map<number, Promise<PoseLandmarker>>();

/**
 * Carrega (uma única vez por valor de `numPoses`) o PoseLandmarker do
 * MediaPipe Tasks Vision. O modelo e o runtime wasm são baixados de CDNs
 * públicas na primeira execução e ficam em cache do navegador — nenhum
 * vídeo ou imagem do usuário é enviado para fora do dispositivo (ver
 * README, seção Privacidade).
 *
 * `numPoses` é 1 para todo paciente comum (padrão). O modo de validação
 * (passo 2 da iniciativa de precisão) pede 2, para detectar quando o
 * examinador entra no quadro durante o movimento — por isso o cache é
 * por valor de `numPoses`: o app do paciente comum nunca carrega/paga o
 * custo da detecção de 2 corpos.
 */
export function loadPoseLandmarker(numPoses: number = 1): Promise<PoseLandmarker> {
  const existing = landmarkerCache.get(numPoses);
  if (existing) return existing;

  if (!filesetCache) {
    filesetCache = FilesetResolver.forVisionTasks(WASM_BASE);
  }

  const promise = filesetCache.then((fileset) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
  );
  landmarkerCache.set(numPoses, promise);
  return promise;
}
