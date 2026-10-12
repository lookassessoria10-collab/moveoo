"use client";

import { useEffect, useRef, useState } from "react";
import { loadPoseLandmarker } from "./loadPoseLandmarker";
import { convertLandmarks, convertWorldLandmarks } from "./convertLandmarks";
import { FrameLandmarks } from "../types";
import { setFrameAspect } from "../geometry";

export interface PoseLoopStats {
  fps: number;
  detected: boolean;
}

/**
 * Executa o loop de detecção de pose sobre um <video> ativo, usando
 * requestAnimationFrame. Chama `onFrame` a cada frame processado com os
 * landmarks já convertidos (ou null quando nenhum corpo é detectado).
 * Todo o processamento acontece localmente no navegador.
 */
export function usePoseLandmarker(
  videoRef: React.RefObject<HTMLVideoElement>,
  onFrame: (
    landmarks: FrameLandmarks | null,
    timestamp: number,
    poseCount: number,
    worldLandmarks: FrameLandmarks | null
  ) => void,
  active: boolean,
  options: { numPoses?: number } = {}
) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PoseLoopStats>({ fps: 0, detected: false });
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const numPoses = options.numPoses ?? 1;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let rafId = 0;
    let lastFrameCount = 0;
    let fpsWindowStart = performance.now();

    loadPoseLandmarker(numPoses)
      .then((landmarker) => {
        if (cancelled) return;
        setReady(true);

        const loop = () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            rafId = requestAnimationFrame(loop);
            return;
          }

          const nowMs = performance.now();
          try {
            // Proporção do quadro lida no mesmo instante em que ele vai para o
            // MediaPipe (em alguns celulares as dimensões só "giram" para
            // retrato depois que o vídeo começa) — usada em todo cálculo de
            // ângulo deste quadro. Ver lib/geometry.ts.
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              setFrameAspect(video.videoWidth / video.videoHeight);
            }
            const result = landmarker.detectForVideo(video, nowMs);
            const poseCount = result.landmarks?.length ?? 0;
            const landmarks = convertLandmarks(
              result.landmarks?.[0] as { x: number; y: number; z?: number; visibility?: number }[] | undefined
            );
            // worldLandmarks: saída 3D separada (metros), só usada pela
            // gravação bruta do modo de validação — barata de extrair
            // (já vem no mesmo resultado), por isso sempre repassada,
            // mesmo fora do modo de validação (quem não usa, ignora).
            const worldLandmarks = convertWorldLandmarks(
              result.worldLandmarks?.[0] as
                | { x: number; y: number; z?: number; visibility?: number }[]
                | undefined
            );
            onFrameRef.current(landmarks, nowMs, poseCount, worldLandmarks);

            lastFrameCount++;
            if (nowMs - fpsWindowStart >= 1000) {
              setStats({ fps: lastFrameCount, detected: !!landmarks });
              lastFrameCount = 0;
              fpsWindowStart = nowMs;
            }
          } catch (e) {
            // frame ocasional pode falhar (ex: vídeo pausando) — não interrompe o loop
          }

          rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Falha ao carregar detecção corporal.");
      });

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [active, videoRef, numPoses]);

  return { ready, error, stats };
}
