"use client";

import { CameraFallback } from "@/components/shared/FlowShell";
import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { usePoseLandmarker } from "@/lib/pose/usePoseLandmarker";
import { FrameLandmarks, Point2D } from "@/lib/types";
import { midpoint } from "@/lib/geometry";
import { average, standardDeviation } from "@/lib/movementMetrics";
import { LandmarksSmoother } from "@/lib/smoothing";
import { checkOrientation, checkVerticalFraming } from "@/lib/framing";
import { POSTURE_CONFIG } from "@/config/modules/posture";
import { PRECISION_CONFIG } from "@/config/precision";
import { tiltFromVerticalDeg } from "../angles";
import { usePostureStore } from "../store";
import { PostureReading, PostureSample, Side } from "../types";
import { drawPostureOverlay } from "@/components/PoseOverlay";
import { Button } from "@/components/ui/Button";
import { useSpeech } from "@/lib/useSpeech";
import { SoundToggle } from "@/components/shared/SoundToggle";
import { CameraTopBar } from "@/components/shared/CameraTopBar";

const CAPTURE_MS = POSTURE_CONFIG.protocol.captureDurationMs;
const VISIBILITY_MIN = POSTURE_CONFIG.thresholds.landmarkVisibilityMin;

function visible(p: Point2D | undefined): boolean {
  return !!p && (p.visibility === undefined || p.visibility >= VISIBILITY_MIN);
}

/** Escolhe o lado (direito/esquerdo) com melhor visibilidade — em vista lateral só um lado do corpo fica de fato exposto à câmera. */
function pickVisibleSide(landmarks: FrameLandmarks): Side {
  const rightVis = (landmarks.rightEar.visibility ?? 1) + (landmarks.rightHip.visibility ?? 1);
  const leftVis = (landmarks.leftEar.visibility ?? 1) + (landmarks.leftHip.visibility ?? 1);
  return rightVis >= leftVis ? "right" : "left";
}

export function PostureCameraFlow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useCamera(videoRef);
  const speech = useSpeech();

  const screen = usePostureStore((s) => s.screen);
  const debugMode = usePostureStore((s) => s.debugMode);
  const toggleDebugMode = usePostureStore((s) => s.toggleDebugMode);

  const [positioningOk, setPositioningOk] = useState(false);
  const [positioningMsg, setPositioningMsg] = useState("Procurando você...");
  const [captureProgress, setCaptureProgress] = useState(0);

  const holdStartRef = useRef<number | null>(null);
  const captureStartRef = useRef<number | null>(null);
  const captureSpokenRef = useRef(false);
  const samplesRef = useRef<PostureSample[]>([]);
  // Passo 3 da iniciativa de precisão: suaviza os pontos do corpo antes de
  // qualquer cálculo de ângulo — ver comentário em components/CameraFlow.tsx.
  const smootherRef = useRef(new LandmarksSmoother(PRECISION_CONFIG.smoothing.emaAlpha));

  useEffect(() => {
    if (screen === "camera") camera.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (screen === "camera" && camera.status === "ready") {
      usePostureStore.getState().setScreen("reposition");
    }
  }, [screen, camera.status]);

  useEffect(() => {
    if (screen === "reposition") {
      speech.speak(
        "Coloque o celular de lado em relação ao seu corpo, apoiado na altura do peito. Sente-se como você costuma sentar para trabalhar.",
        { force: true }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const checkQuality = (landmarks: FrameLandmarks | null): { ok: boolean; message: string } => {
    if (!landmarks) return { ok: false, message: "Não conseguimos ver você." };
    const rightOk = [landmarks.rightEar, landmarks.rightShoulder, landmarks.rightHip].every(visible);
    const leftOk = [landmarks.leftEar, landmarks.leftShoulder, landmarks.leftHip].every(visible);
    if (!rightOk && !leftOk) {
      return { ok: false, message: "Precisamos enxergar sua orelha, ombro e quadril de um dos lados." };
    }
    return { ok: true, message: "Perfeito! Posição ideal." };
  };

  /**
   * Checagem mais rigorosa usada só na tela de posicionamento: além da
   * visibilidade, verifica orientação (a postura sentada só é observável de
   * lado) e enquadramento vertical (nariz até quadril).
   */
  const checkPositioningQuality = (landmarks: FrameLandmarks | null): { ok: boolean; message: string } => {
    const base = checkQuality(landmarks);
    if (!base.ok || !landmarks) return base;

    const shoulderMid = midpoint(landmarks.leftShoulder, landmarks.rightShoulder);
    const hipMid = midpoint(landmarks.leftHip, landmarks.rightHip);
    const orientation = checkOrientation(
      landmarks.leftShoulder,
      landmarks.rightShoulder,
      shoulderMid,
      hipMid,
      landmarks.nose,
      "lateral",
      {
        frontalMinRatio: 0.3,
        lateralMinNoseOffsetRatio: POSTURE_CONFIG.thresholds.framing.lateralMinNoseOffsetRatio,
      }
    );
    if (!orientation.ok) return orientation;

    return checkVerticalFraming(landmarks.nose, hipMid, {
      minSpanRatio: POSTURE_CONFIG.thresholds.framing.minSpanRatio,
      maxSpanRatio: POSTURE_CONFIG.thresholds.framing.maxSpanRatio,
    });
  };

  const handleFrame = (rawLandmarks: FrameLandmarks | null) => {
    // Passo 3: suaviza antes de qualquer outra coisa — ver comentário em
    // components/CameraFlow.tsx.
    const landmarks = rawLandmarks ? smootherRef.current.smooth(rawLandmarks) : null;
    const timestamp = performance.now();
    const currentScreen = usePostureStore.getState().screen;
    drawFrame(landmarks);

    if (currentScreen === "positioning") {
      const check = checkPositioningQuality(landmarks);
      setPositioningOk(check.ok);
      setPositioningMsg(check.message);
      speech.speak(check.message);
      if (check.ok) {
        if (holdStartRef.current === null) holdStartRef.current = timestamp;
        if (timestamp - holdStartRef.current >= 1000) {
          holdStartRef.current = null;
          usePostureStore.getState().setScreen("capture");
        }
      } else {
        holdStartRef.current = null;
      }
      return;
    }

    if (currentScreen === "capture") {
      handleCaptureFrame(landmarks, timestamp);
    }
  };

  const handleCaptureFrame = (landmarks: FrameLandmarks | null, timestamp: number) => {
    if (!landmarks) {
      captureStartRef.current = null;
      samplesRef.current = [];
      setCaptureProgress(0);
      return;
    }

    const side = pickVisibleSide(landmarks);
    const ear = side === "right" ? landmarks.rightEar : landmarks.leftEar;
    const shoulder = side === "right" ? landmarks.rightShoulder : landmarks.leftShoulder;
    const hip = side === "right" ? landmarks.rightHip : landmarks.leftHip;
    if (![ear, shoulder, hip].every(visible)) return;

    if (captureStartRef.current === null) {
      captureStartRef.current = timestamp;
      smootherRef.current.reset();
    }
    if (!captureSpokenRef.current) {
      captureSpokenRef.current = true;
      speech.speak("Fique parado, na posição em que você costuma trabalhar.", { force: true });
    }

    samplesRef.current.push({
      timestamp,
      trunkTiltDeg: tiltFromVerticalDeg(hip, shoulder),
      neckTiltDeg: tiltFromVerticalDeg(shoulder, ear),
    });

    const elapsed = timestamp - captureStartRef.current;
    const progress = Math.min(1, elapsed / CAPTURE_MS);
    setCaptureProgress(progress);

    if (progress >= 1) {
      const samples = samplesRef.current;
      const trunkVals = samples.map((s) => s.trunkTiltDeg);
      const neckVals = samples.map((s) => s.neckTiltDeg);
      const reading: PostureReading = {
        trunkTiltDeg: average(trunkVals),
        neckTiltDeg: average(neckVals),
        trunkTiltStdDev: standardDeviation(trunkVals),
        neckTiltStdDev: standardDeviation(neckVals),
        capturedAt: Date.now(),
      };

      captureStartRef.current = null;
      samplesRef.current = [];
      captureSpokenRef.current = false;
      usePostureStore.getState().setScreen("processing");
      setTimeout(() => usePostureStore.getState().buildResult(reading), 1200);
    }
  };

  const drawFrame = (landmarks: FrameLandmarks | null) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;
    drawPostureOverlay(ctx, landmarks, canvas.width, canvas.height, {
      side: pickVisibleSide(landmarks),
    });
  };

  usePoseLandmarker(videoRef, (lm) => handleFrame(lm), camera.status === "ready");

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-moveo-ink">
      <CameraTopBar />
      {/* Proporção fixa em retrato — ver comentário em components/CameraFlow.tsx
          sobre por que não usamos video.videoWidth/videoHeight aqui. */}
      <div
        className="relative mx-auto w-full flex-1 overflow-hidden bg-moveo-ink"
        style={{ aspectRatio: "9 / 16", maxHeight: "100dvh" }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-contain"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" />

        {screen === "camera" && (
          <div className="absolute inset-x-0 bottom-0 bg-moveo-primary px-6 pb-8 pt-4 text-center">
            <p className="text-lg font-semibold text-white">
              {camera.status === "requesting" && "Solicitando acesso à câmera..."}
              {camera.status === "denied" && "Permita o acesso à câmera para continuar."}
              {camera.status === "unavailable" && "Nenhuma câmera encontrada neste dispositivo."}
            </p>
          </div>
        )}

        {screen === "reposition" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-moveo-bg p-8 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-moveo-primary">
              Celular DE LADO
            </p>
            <h2 className="text-xl font-bold text-moveo-ink">Postura sentada</h2>
            <p className="mt-3 text-sm leading-relaxed text-moveo-muted">
              Apoie o celular de lado em relação ao seu corpo, na altura do peito, a cerca de 1,5 m de
              distância. Sente-se como você costuma sentar para trabalhar — não corrija a postura.
            </p>
            <Button className="mt-8" onClick={() => usePostureStore.getState().setScreen("positioning")}>
              JÁ POSICIONEI
            </Button>
          </div>
        )}

        {screen === "positioning" && (
          <div className="absolute inset-x-0 bottom-0 bg-moveo-primary px-6 pb-8 pt-4 text-center">
            <p className="text-lg font-semibold text-white">{positioningMsg}</p>
          </div>
        )}

        {screen === "capture" && (
          <div className="absolute inset-x-0 bottom-0 bg-moveo-primary px-6 pb-8 pt-4 text-center">
            <p className="text-lg font-semibold text-white">Fique parado, na sua posição habitual.</p>
            <p className="mt-1 text-sm text-white/80">Não corrija a postura — queremos observar como ela é.</p>
            <div className="mx-auto mt-4 h-2 w-48 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${captureProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {debugMode && (
          <div className="absolute left-2 top-2 rounded bg-black/60 p-2 font-mono text-[10px] text-lime-300">
            <div>screen: {screen}</div>
            <div>positioningOk: {String(positioningOk)}</div>
          </div>
        )}

        <button
          onClick={toggleDebugMode}
          className="absolute right-2 top-2 rounded bg-black/40 px-2 py-1 text-[10px] text-white/70"
        >
          debug
        </button>
        {speech.supported && <SoundToggle enabled={speech.enabled} onToggle={speech.toggle} />}
      </div>

      {(camera.status === "denied" || camera.status === "unavailable") && (
        <CameraFallback onDemo={() => usePostureStore.getState().loadDemoResult()} />
      )}
    </div>
  );
}
