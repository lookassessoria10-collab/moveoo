"use client";

import { CameraFallback } from "@/components/shared/FlowShell";
import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { usePoseLandmarker } from "@/lib/pose/usePoseLandmarker";
import { FrameLandmarks, Point2D } from "@/lib/types";
import { calculateTrunkAngle } from "@/lib/angles";
import { distance, midpoint } from "@/lib/geometry";
import { MovementStateMachine } from "@/lib/movementDetection";
import { MovingAverage, LandmarksSmoother } from "@/lib/smoothing";
import { calculateAngularVelocity, calculateMovementDuration } from "@/lib/movementMetrics";
import { checkOrientation, checkVerticalFraming } from "@/lib/framing";
import { SPINE_CONFIG } from "@/config/modules/spine";
import { PRECISION_CONFIG } from "@/config/precision";
import { tiltFromHorizontal } from "../angles";
import { useSpineStore, SpineQueueItem } from "../store";
import { SpineAttempt, SpineMovementFrame } from "../types";
import { drawPoseOverlay } from "@/components/PoseOverlay";
import { PainQuestionScreen } from "./screens/PainQuestionScreen";
import { Button } from "@/components/ui/Button";
import { useSpeech } from "@/lib/useSpeech";
import { SoundToggle } from "@/components/shared/SoundToggle";
import { CameraTopBar } from "@/components/shared/CameraTopBar";

const REPS = SPINE_CONFIG.protocol.repetitionsPerMovement;
const CALIBRATION_MS = SPINE_CONFIG.protocol.calibrationDurationMs;
const VISIBILITY_MIN = SPINE_CONFIG.thresholds.landmarkVisibilityMin;

function visible(p: Point2D | undefined): boolean {
  return !!p && (p.visibility === undefined || p.visibility >= VISIBILITY_MIN);
}

export function SpineCameraFlow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useCamera(videoRef);
  const speech = useSpeech();

  const screen = useSpineStore((s) => s.screen);
  const debugMode = useSpineStore((s) => s.debugMode);
  const toggleDebugMode = useSpineStore((s) => s.toggleDebugMode);
  const queueIndex = useSpineStore((s) => s.queueIndex);
  const queue = useSpineStore((s) => s.queue);
  const calibration = useSpineStore((s) => s.calibration);
  const item: SpineQueueItem | null = queue[queueIndex] ?? null;

  const [positioningOk, setPositioningOk] = useState(false);
  const [positioningMsg, setPositioningMsg] = useState("Procurando você...");
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [testUi, setTestUi] = useState<{
    angle: number | null;
    message: string;
    countdown: number | null;
    lost: boolean;
  }>({ angle: null, message: "", countdown: null, lost: false });

  const holdStartRef = useRef<number | null>(null);
  const calibrationStartRef = useRef<number | null>(null);
  const calibrationSamplesRef = useRef<
    { trunkAngle: number; hipMidX: number; shoulderTilt: number; hipTilt: number; headTilt: number }[]
  >([]);

  const machineRef = useRef(new MovementStateMachine(SPINE_CONFIG.thresholds.movementDetection));
  const angleMaRef = useRef(new MovingAverage(5));
  // Passo 3 da iniciativa de precisão: suaviza os pontos do corpo antes de
  // qualquer cálculo de ângulo — ver comentário em components/CameraFlow.tsx.
  const smootherRef = useRef(new LandmarksSmoother(PRECISION_CONFIG.smoothing.emaAlpha));
  const repIndexRef = useRef(0);
  const capturingRef = useRef(false);
  const framesBufferRef = useRef<SpineMovementFrame[]>([]);
  const startTsRef = useRef(0);
  const peakTsRef = useRef(0);
  const lostCountRef = useRef(0);
  const armedRef = useRef(false);
  const reArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calibrationSpokenRef = useRef(false);

  useEffect(() => {
    if (screen === "camera") camera.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (screen === "camera" && camera.status === "ready") {
      useSpineStore.getState().setScreen("reposition");
    }
  }, [screen, camera.status]);

  useEffect(() => {
    if (screen === "reposition" && item) {
      speech.speak(item.repositionInstruction, { force: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, queueIndex]);

  useEffect(() => {
    if (screen !== "test" || !item) return;
    machineRef.current.reset();
    angleMaRef.current.reset();
    repIndexRef.current = 0;
    capturingRef.current = false;
    framesBufferRef.current = [];
    armedRef.current = false;

    let cancelled = false;
    let count = SPINE_CONFIG.protocol.countdownSeconds;
    setTestUi({ angle: null, message: "", countdown: count, lost: false });

    const tick = () => {
      if (cancelled) return;
      count -= 1;
      if (count > 0) {
        setTestUi((u) => ({ ...u, countdown: count }));
        setTimeout(tick, 1000);
      } else {
        setTestUi((u) => ({ ...u, countdown: null }));
        machineRef.current.arm(0); // sinal = desvio absoluto do neutro, sempre começa em 0
        armedRef.current = true;
        speech.speak(`Vamos começar. ${item.movementInstruction}`, { force: true });
      }
    };
    const initialTimer = setTimeout(tick, 1000);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      if (reArmTimerRef.current) clearTimeout(reArmTimerRef.current);
    };
  }, [screen, queueIndex]);

  const checkQuality = (landmarks: FrameLandmarks | null): { ok: boolean; message: string } => {
    if (!landmarks) return { ok: false, message: "Não conseguimos ver você." };
    const required = [landmarks.leftShoulder, landmarks.rightShoulder, landmarks.leftHip, landmarks.rightHip];
    if (!required.every(visible)) {
      return { ok: false, message: "Precisamos enxergar seus ombros e quadril." };
    }
    return { ok: true, message: "Perfeito! Posição ideal." };
  };

  /**
   * Checagem mais rigorosa usada só na tela de posicionamento: além da
   * visibilidade, verifica orientação (de lado/de frente) e enquadramento
   * vertical do tronco (nariz até quadril) — evita começar o teste com o
   * corpo mal enquadrado, principal causa de estimativas instáveis.
   */
  const checkPositioningQuality = (landmarks: FrameLandmarks | null): { ok: boolean; message: string } => {
    const base = checkQuality(landmarks);
    if (!base.ok || !landmarks || !item) return base;

    const shoulderMid = midpoint(landmarks.leftShoulder, landmarks.rightShoulder);
    const hipMid = midpoint(landmarks.leftHip, landmarks.rightHip);
    const orientation = checkOrientation(
      landmarks.leftShoulder,
      landmarks.rightShoulder,
      shoulderMid,
      hipMid,
      landmarks.nose,
      item.orientation,
      {
        frontalMinRatio: SPINE_CONFIG.thresholds.framing.orientationFrontalMinRatio,
        lateralMinNoseOffsetRatio: SPINE_CONFIG.thresholds.framing.lateralMinNoseOffsetRatio,
      }
    );
    if (!orientation.ok) return orientation;

    return checkVerticalFraming(landmarks.nose, hipMid, {
      minSpanRatio: SPINE_CONFIG.thresholds.framing.minSpanRatio,
      maxSpanRatio: SPINE_CONFIG.thresholds.framing.maxSpanRatio,
    });
  };

  const handleFrame = (rawLandmarks: FrameLandmarks | null) => {
    // Passo 3: suaviza antes de qualquer outra coisa — ver comentário em
    // components/CameraFlow.tsx.
    const landmarks = rawLandmarks ? smootherRef.current.smooth(rawLandmarks) : null;
    const timestamp = performance.now();
    const currentScreen = useSpineStore.getState().screen;
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
          useSpineStore.getState().setScreen("calibration");
        }
      } else {
        holdStartRef.current = null;
      }
      return;
    }

    if (currentScreen === "calibration") {
      if (!landmarks) {
        calibrationStartRef.current = null;
        calibrationSamplesRef.current = [];
        setCalibrationProgress(0);
        return;
      }
      if (calibrationStartRef.current === null) {
        calibrationStartRef.current = timestamp;
        smootherRef.current.reset();
      }
      if (!calibrationSpokenRef.current) {
        calibrationSpokenRef.current = true;
        speech.speak(item.calibrationInstruction, { force: true });
      }

      const trunkAngle = calculateTrunkAngle(
        landmarks.leftShoulder,
        landmarks.rightShoulder,
        landmarks.leftHip,
        landmarks.rightHip
      );
      const hipMidX = midpoint(landmarks.leftHip, landmarks.rightHip).x;
      const shoulderTilt = tiltFromHorizontal(landmarks.leftShoulder, landmarks.rightShoulder);
      const hipTilt = tiltFromHorizontal(landmarks.leftHip, landmarks.rightHip);
      const headTilt = tiltFromHorizontal(landmarks.leftEar, landmarks.rightEar);
      calibrationSamplesRef.current.push({ trunkAngle, hipMidX, shoulderTilt, hipTilt, headTilt });

      const elapsed = timestamp - calibrationStartRef.current;
      const progress = Math.min(1, elapsed / CALIBRATION_MS);
      setCalibrationProgress(progress);

      if (progress >= 1) {
        const samples = calibrationSamplesRef.current;
        const avg = (key: keyof (typeof samples)[number]) =>
          samples.reduce((sum, s) => sum + s[key], 0) / samples.length;

        useSpineStore.getState().setCalibration({
          neutralTrunkAngle: avg("trunkAngle"),
          neutralHipMidX: avg("hipMidX"),
          capturedAt: Date.now(),
        });

        if (queueIndex === 0) {
          useSpineStore.getState().setStaticPosture({
            shoulderTiltDeg: avg("shoulderTilt"),
            hipTiltDeg: avg("hipTilt"),
            headTiltDeg: avg("headTilt"),
          });
        }

        calibrationStartRef.current = null;
        calibrationSamplesRef.current = [];
        calibrationSpokenRef.current = false;
        useSpineStore.getState().setScreen("test");
      }
      return;
    }

    if (currentScreen === "test") {
      handleTestFrame(landmarks, timestamp);
    }
  };

  const handleTestFrame = (landmarks: FrameLandmarks | null, timestamp: number) => {
    if (!armedRef.current || !item || !calibration) return;

    const check = checkQuality(landmarks);
    if (!check.ok || !landmarks) {
      lostCountRef.current += 1;
      if (lostCountRef.current > 8 && !testUi.lost) {
        const lostMessage = "Perdi a referência do seu movimento. Volte à posição indicada.";
        setTestUi((u) => ({ ...u, lost: true, message: lostMessage }));
        speech.speak(lostMessage, { force: true });
        machineRef.current.reset();
        framesBufferRef.current = [];
        capturingRef.current = false;
      }
      return;
    }
    if (testUi.lost) setTestUi((u) => ({ ...u, lost: false, message: "" }));
    lostCountRef.current = 0;

    const trunkAngleRaw = calculateTrunkAngle(
      landmarks.leftShoulder,
      landmarks.rightShoulder,
      landmarks.leftHip,
      landmarks.rightHip
    );
    const rawSignal = Math.abs(trunkAngleRaw - calibration.neutralTrunkAngle);
    const signal = angleMaRef.current.push(rawSignal);
    const detection = machineRef.current.update(signal);

    const shoulderMid = midpoint(landmarks.leftShoulder, landmarks.rightShoulder);
    const hipMid = midpoint(landmarks.leftHip, landmarks.rightHip);
    const hipWidth = distance(landmarks.leftHip, landmarks.rightHip) || 1;
    const hipCompensation = (Math.abs(hipMid.x - calibration.neutralHipMidX) / hipWidth) * 100;

    if (detection.justStarted) {
      startTsRef.current = timestamp;
      capturingRef.current = true;
      framesBufferRef.current = [];
    }

    if (capturingRef.current) {
      framesBufferRef.current.push({
        timestamp,
        shoulderMid,
        hipMid,
        trunkAngle: trunkAngleRaw,
      });
    }

    if (detection.justReachedPeak) {
      peakTsRef.current = timestamp;
      speech.speak("Pode voltar.", { force: true, interrupt: false });
    }

    if (detection.justCompleted) {
      capturingRef.current = false;
      const maxAngle = machineRef.current.getPeakAngle();
      const duration = calculateMovementDuration(startTsRef.current, peakTsRef.current || timestamp);
      const attempt: SpineAttempt = {
        test: item.test,
        repetitionIndex: repIndexRef.current + 1,
        frames: framesBufferRef.current,
        maxAngle,
        startTimestamp: startTsRef.current,
        peakTimestamp: peakTsRef.current || timestamp,
        endTimestamp: timestamp,
        duration,
        averageAngularVelocity: calculateAngularVelocity(maxAngle, duration),
        hipCompensation: Math.max(hipCompensation, 0),
      };
      useSpineStore.getState().addAttempt(attempt);
      repIndexRef.current += 1;
      framesBufferRef.current = [];

      if (repIndexRef.current >= REPS) {
        armedRef.current = false;
        useSpineStore.getState().setScreen("painQuestion");
        setTestUi((u) => ({ ...u, message: "" }));
      } else {
        armedRef.current = false;
        setTestUi((u) => ({ ...u, message: "Muito bem." }));
        speech.speak("Muito bem.", { force: true, interrupt: false });
        reArmTimerRef.current = setTimeout(() => {
          machineRef.current.arm(0);
          armedRef.current = true;
          setTestUi((u) => ({ ...u, message: "" }));
          speech.speak("Pode começar.", { force: true, interrupt: false });
        }, 1600);
      }
    } else {
      setTestUi((u) => (u.angle === Math.round(signal) ? u : { ...u, angle: Math.round(signal) }));
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
    drawPoseOverlay(ctx, landmarks, canvas.width, canvas.height, {});
  };

  usePoseLandmarker(videoRef, (lm) => handleFrame(lm), camera.status === "ready");

  if (!item) return null;

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
              {item.orientation === "lateral" ? "Celular DE LADO" : "Celular DE FRENTE"}
            </p>
            <h2 className="text-xl font-bold text-moveo-ink">{item.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-moveo-muted">{item.repositionInstruction}</p>
            <Button className="mt-8" onClick={() => useSpineStore.getState().setScreen("positioning")}>
              JÁ POSICIONEI
            </Button>
          </div>
        )}

        {screen === "positioning" && (
          <div className="absolute inset-x-0 bottom-0 bg-moveo-primary px-6 pb-8 pt-4 text-center">
            <p className="text-lg font-semibold text-white">{positioningMsg}</p>
          </div>
        )}

        {screen === "calibration" && (
          <div className="absolute inset-x-0 bottom-0 bg-moveo-primary px-6 pb-8 pt-4 text-center">
            <p className="text-lg font-semibold text-white">{item.calibrationInstruction}</p>
            <p className="mt-1 text-sm text-white/80">Estamos ajustando a medição ao seu corpo.</p>
            <div className="mx-auto mt-4 h-2 w-48 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${calibrationProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {screen === "test" && (
          <>
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-5 pt-8 text-center">
              <p className="text-sm font-medium text-white/70">{item.title}</p>
              <p className="mt-1 text-xs text-white/60">
                Rep {Math.min(repIndexRef.current + 1, REPS)} de {REPS}
              </p>
            </div>

            {testUi.countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="text-7xl font-bold text-white">{testUi.countdown}</span>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-moveo-primary px-6 pb-8 pt-4 text-center">
              {testUi.angle !== null && testUi.countdown === null && !testUi.lost && (
                <p className="mb-2 text-4xl font-bold text-white">{testUi.angle}°</p>
              )}
              <p className="text-base font-medium text-white">{testUi.message || item.movementInstruction}</p>
            </div>
          </>
        )}

        {screen === "painQuestion" && (
          <div className="absolute inset-0 flex items-center bg-moveo-bg">
            <PainQuestionScreen />
          </div>
        )}

        {debugMode && (
          <div className="absolute left-2 top-2 rounded bg-black/60 p-2 font-mono text-[10px] text-lime-300">
            <div>screen: {screen}</div>
            <div>test: {item.test}</div>
            <div>phase: {machineRef.current.getPhase()}</div>
            <div>signal: {testUi.angle}</div>
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
        <CameraFallback onDemo={() => useSpineStore.getState().loadDemoResult()} />
      )}
    </div>
  );
}
