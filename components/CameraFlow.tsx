"use client";

import { CameraFallback } from "@/components/shared/FlowShell";
import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { usePoseLandmarker } from "@/lib/pose/usePoseLandmarker";
import { useAssessmentStore } from "@/stores/assessmentStore";
import { FrameLandmarks, Movement, MovementAttempt, MovementFrame, Side } from "@/lib/types";
import { checkPositioning, PositioningCheck } from "@/lib/positioning";
import { calculateShoulderFlexionAngle, calculateAbductionAngle, calculateTrunkAngle } from "@/lib/angles";
import { getFrameAspect, midpoint } from "@/lib/geometry";
import { MovementStateMachine } from "@/lib/movementDetection";
import { MovingAverage, LandmarksSmoother } from "@/lib/smoothing";
import {
  calculateAngularVelocity,
  calculateMovementDuration,
} from "@/lib/movementMetrics";
import {
  calculateAngleBeforeCompensation,
  calculateMaxTrunkCompensation,
} from "@/lib/trunkCompensation";
import { drawPoseOverlay } from "./PoseOverlay";
import { BodyPositionGuide } from "./BodyPositionGuide";
import { Button } from "./ui/Button";
import { APP_CONFIG } from "@/config/app";
import { PainQuestionScreen } from "./screens/PainQuestionScreen";
import { useSpeech } from "@/lib/useSpeech";
import { SoundToggle } from "./shared/SoundToggle";
import { CameraTopBar } from "./shared/CameraTopBar";
import { useValidationMode } from "@/lib/validation/useValidationMode";
import { useValidationSession } from "@/lib/validation/sessionStore";
import { useValidationRecordsStore } from "@/lib/validation/recordsStore";
import { ValidationRecord, RawFrameRecord, RawFrameSample } from "@/lib/validation/types";
import { addRawFrameRecord } from "@/lib/validation/rawFrameDb";
import { ReferenceValueEntry } from "./shared/ReferenceValueEntry";
import { ALGORITHM_VERSION, PRECISION_CONFIG } from "@/config/precision";

const RAW_FRAME_INTERVAL_MS = PRECISION_CONFIG.validation.rawFrameSampleIntervalMs;

const MOVEMENT_TITLE: Record<Movement, string> = {
  flexion: "Flexão",
  abduction: "Elevação lateral",
};
const MOVEMENT_INSTRUCTION: Record<Movement, (side: string) => string> = {
  flexion: (side) => `Levante lentamente o braço ${side} para frente até onde conseguir confortavelmente. Não force.`,
  abduction: (side) => `Levante o braço ${side} lateralmente até onde conseguir confortavelmente.`,
};
const SIDE_LABEL: Record<Side, string> = { right: "direito", left: "esquerdo" };

const REPS = APP_CONFIG.protocol.repetitionsPerMovement;
const CALIBRATION_MS = APP_CONFIG.protocol.calibrationDurationMs;
const PEAK_HOLD_MS = APP_CONFIG.protocol.peakHoldMs;

export function CameraFlow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useCamera(videoRef);
  const speech = useSpeech();

  const screen = useAssessmentStore((s) => s.screen);
  const debugMode = useAssessmentStore((s) => s.debugMode);
  const toggleDebugMode = useAssessmentStore((s) => s.toggleDebugMode);
  const queueIndex = useAssessmentStore((s) => s.queueIndex);
  const queue = useAssessmentStore((s) => s.queue);
  const calibration = useAssessmentStore((s) => s.calibration);

  const validationMode = useValidationMode();
  const validationSession = useValidationSession();
  const addValidationRecord = useValidationRecordsStore((s) => s.addRecord);

  const [positioning, setPositioning] = useState<PositioningCheck>({
    ok: false,
    key: "no_body",
    message: "Procurando você...",
  });
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [testUi, setTestUi] = useState<{
    repIndex: number;
    angle: number | null;
    message: string;
    countdown: number | null;
    lost: boolean;
    awaitingReference: boolean;
  }>({ repIndex: 0, angle: null, message: "", countdown: null, lost: false, awaitingReference: false });

  // refs imperativos — não geram re-render a cada frame
  const holdStartRef = useRef<number | null>(null);
  const calibrationStartRef = useRef<number | null>(null);
  const calibrationSamplesRef = useRef<
    { trunkAngle: number; armRight: number; armLeft: number; shoulderWidth: number }[]
  >([]);

  const machineRef = useRef(new MovementStateMachine());
  const angleMaRef = useRef(new MovingAverage(5));
  // Passo 3 da iniciativa de precisão: suaviza os pontos do corpo (x/y de
  // cada landmark) antes de qualquer cálculo de ângulo — reduz o tremor
  // quadro a quadro do MediaPipe. Reiniciado a cada nova calibração (ver
  // handleFrame), para não "arrastar" a posição de um teste anterior.
  const smootherRef = useRef(new LandmarksSmoother(PRECISION_CONFIG.smoothing.emaAlpha));
  const repIndexRef = useRef(0);
  const capturingRef = useRef(false);
  const framesBufferRef = useRef<MovementFrame[]>([]);
  const startTsRef = useRef(0);
  const peakTsRef = useRef(0);
  const lostCountRef = useRef(0);
  const armedRef = useRef(false);
  const reArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLandmarksRef = useRef<FrameLandmarks | null>(null);
  const calibrationSpokenRef = useRef(false);

  // Modo de validação (passo 2 da iniciativa de precisão) — só usados
  // quando validationMode é true; não afetam o paciente comum.
  const poseCountRef = useRef(1);
  const awaitingReferenceRef = useRef(false);
  const lockedAtMsRef = useRef<number | null>(null);
  const rawAngleBufferRef = useRef<number[]>([]);
  const visibilitySamplesRef = useRef<number[]>([]);
  // Gravação bruta (passo intermediário): pontos ANTES da suavização,
  // para reprocessar depois com qualquer versão do algoritmo — ver
  // lib/validation/rawFrameDb.ts. Só populado no modo de validação.
  const lastRawLandmarksRef = useRef<FrameLandmarks | null>(null);
  const worldLandmarksRef = useRef<FrameLandmarks | null>(null);
  const rawFrameSamplesRef = useRef<RawFrameSample[]>([]);
  const lastRawFrameSampleTsRef = useRef(-Infinity);
  const currentRecordIdRef = useRef<string>("");

  // inicia câmera assim que a tela "camera" é exibida
  useEffect(() => {
    if (screen === "camera") camera.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (screen === "camera" && camera.status === "ready") {
      useAssessmentStore.getState().setScreen("positioning");
    }
  }, [screen, camera.status]);

  // (re)inicia bloco de teste (countdown + arma a máquina de estado) quando entramos em "test"
  useEffect(() => {
    if (screen !== "test") return;
    const item = queue[queueIndex];
    const baseline = useAssessmentStore.getState().calibration;
    if (!item || !baseline) return;

    machineRef.current.reset();
    angleMaRef.current.reset();
    repIndexRef.current = 0;
    capturingRef.current = false;
    framesBufferRef.current = [];
    armedRef.current = false;

    let cancelled = false;
    let count = APP_CONFIG.protocol.countdownSeconds;
    setTestUi({ repIndex: 0, angle: null, message: "", countdown: count, lost: false, awaitingReference: false });
    awaitingReferenceRef.current = false;

    const tick = () => {
      if (cancelled) return;
      count -= 1;
      if (count > 0) {
        setTestUi((u) => ({ ...u, countdown: count }));
        setTimeout(tick, 1000);
      } else {
        setTestUi((u) => ({ ...u, countdown: null }));
        const neutral = item.side === "right" ? baseline.neutralArmAngleRight : baseline.neutralArmAngleLeft;
        machineRef.current.arm(neutral);
        armedRef.current = true;
        speech.speak(
          `Vamos começar. ${MOVEMENT_INSTRUCTION[item.movement](SIDE_LABEL[item.side])}`,
          { force: true }
        );
      }
    };
    const initialTimer = setTimeout(tick, 1000);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      if (reArmTimerRef.current) clearTimeout(reArmTimerRef.current);
    };
  }, [screen, queueIndex]);

  const handleFrame = (rawLandmarks: FrameLandmarks | null) => {
    // Guardado ANTES da suavização — usado só pela gravação bruta do
    // modo de validação (ver handleTestFrame).
    lastRawLandmarksRef.current = rawLandmarks;
    // Passo 3: suaviza antes de qualquer outra coisa — tudo daqui pra
    // baixo (checagens, calibração, teste, overlay) usa o valor já
    // suavizado, nunca o bruto.
    const landmarks = rawLandmarks ? smootherRef.current.smooth(rawLandmarks) : null;
    lastLandmarksRef.current = landmarks;
    const timestamp = performance.now();
    const currentScreen = useAssessmentStore.getState().screen;

    drawFrame(landmarks, currentScreen);

    if (currentScreen === "positioning") {
      const check = checkPositioning(landmarks, 1);
      setPositioning(check);
      speech.speak(check.message);
      if (check.ok) {
        if (holdStartRef.current === null) holdStartRef.current = timestamp;
        if (timestamp - holdStartRef.current >= 1000) {
          holdStartRef.current = null;
          useAssessmentStore.getState().setScreen("calibration");
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
        speech.speak("Fique parado por um instante.", { force: true });
      }

      const trunkAngle = calculateTrunkAngle(
        landmarks.leftShoulder,
        landmarks.rightShoulder,
        landmarks.leftHip,
        landmarks.rightHip
      );
      const armRight = calculateShoulderFlexionAngle(landmarks.rightShoulder, landmarks.rightElbow, landmarks.rightHip);
      const armLeft = calculateShoulderFlexionAngle(landmarks.leftShoulder, landmarks.leftElbow, landmarks.leftHip);
      const shoulderW = Math.hypot(
        landmarks.leftShoulder.x - landmarks.rightShoulder.x,
        landmarks.leftShoulder.y - landmarks.rightShoulder.y
      );
      calibrationSamplesRef.current.push({ trunkAngle, armRight, armLeft, shoulderWidth: shoulderW });

      const elapsed = timestamp - calibrationStartRef.current;
      const progress = Math.min(1, elapsed / CALIBRATION_MS);
      setCalibrationProgress(progress);

      if (progress >= 1) {
        const samples = calibrationSamplesRef.current;
        const avg = (key: keyof (typeof samples)[number]) =>
          samples.reduce((sum, s) => sum + s[key], 0) / samples.length;

        useAssessmentStore.getState().setCalibration({
          shoulderWidthPx: avg("shoulderWidth"),
          hipMidpoint: midpoint(landmarks.leftHip, landmarks.rightHip),
          shoulderMidpoint: midpoint(landmarks.leftShoulder, landmarks.rightShoulder),
          neutralTrunkAngle: avg("trunkAngle"),
          neutralArmAngleRight: avg("armRight"),
          neutralArmAngleLeft: avg("armLeft"),
          capturedAt: Date.now(),
        });
        calibrationStartRef.current = null;
        calibrationSamplesRef.current = [];
        calibrationSpokenRef.current = false;
        useAssessmentStore.getState().setScreen("test");
      }
      return;
    }

    if (currentScreen === "test") {
      handleTestFrame(landmarks, timestamp);
      return;
    }
  };

  /**
   * Termina a repetição (soma na store, decide se acabou o bloco ou re-arma
   * para a próxima) — compartilhado pelo fluxo normal (detecção automática
   * de retorno ao neutro) e pelo modo de validação (confirmação manual do
   * examinador, ver finalizeValidatedRepetition).
   */
  const completeRepetition = (maxAngle: number, endTimestamp: number) => {
    const item = queue[queueIndex];
    const baseline = calibration;
    if (!item || !baseline) return;

    capturingRef.current = false;
    const neutral = item.side === "right" ? baseline.neutralArmAngleRight : baseline.neutralArmAngleLeft;
    const duration = calculateMovementDuration(startTsRef.current, peakTsRef.current || endTimestamp);
    const attempt: MovementAttempt = {
      side: item.side,
      movement: item.movement,
      repetitionIndex: repIndexRef.current + 1,
      frames: framesBufferRef.current,
      maxAngle,
      startTimestamp: startTsRef.current,
      peakTimestamp: peakTsRef.current || endTimestamp,
      endTimestamp,
      duration,
      averageAngularVelocity: calculateAngularVelocity(Math.max(0, maxAngle - neutral), duration),
      maxTrunkCompensation: calculateMaxTrunkCompensation(framesBufferRef.current, baseline.neutralTrunkAngle),
      angleBeforeCompensation: calculateAngleBeforeCompensation(framesBufferRef.current, baseline.neutralTrunkAngle),
    };
    useAssessmentStore.getState().addAttempt(attempt);
    repIndexRef.current += 1;
    framesBufferRef.current = [];

    if (repIndexRef.current >= REPS) {
      armedRef.current = false;
      useAssessmentStore.getState().setScreen("painQuestion");
      setTestUi((u) => ({ ...u, repIndex: repIndexRef.current, message: "Bloco concluído." }));
    } else {
      armedRef.current = false;
      setTestUi((u) => ({ ...u, repIndex: repIndexRef.current, message: "Muito bem." }));
      speech.speak("Muito bem.", { force: true, interrupt: false });
      reArmTimerRef.current = setTimeout(() => {
        machineRef.current.arm(neutral);
        armedRef.current = true;
        setTestUi((u) => ({ ...u, message: "" }));
        speech.speak("Pode começar.", { force: true, interrupt: false });
      }, 1600);
    }
  };

  /**
   * Monta o registro bruto (pontos quadro a quadro, ANTES da suavização)
   * de uma repetição — só usado no modo de validação, para reprocessar
   * depois com qualquer versão do algoritmo sem precisar de nova coleta.
   */
  const buildRawFrameRecord = (
    status: "valida" | "cancelada",
    referenceValueDeg: number | null
  ): RawFrameRecord | null => {
    const item = queue[queueIndex];
    const baseline = calibration;
    if (!item || !baseline) return null;
    return {
      recordId: currentRecordIdRef.current,
      algorithmVersion: ALGORITHM_VERSION,
      volunteerCode: validationSession.volunteerCode,
      examinerCode: validationSession.examinerCode,
      region: "ombro",
      test: item.movement,
      side: item.side,
      repetitionIndex: repIndexRef.current + 1,
      status,
      referenceValueDeg,
      instrument: validationSession.instrument,
      calibration: { ...baseline },
      samples: rawFrameSamplesRef.current,
    };
  };

  /**
   * Chamado quando o examinador confirma o valor de referência (goniômetro
   * / inclinômetro) no modo de validação. Usa os quadros já congelados no
   * instante do "segure a posição" — nada foi atualizado desde então.
   */
  const handleReferenceConfirm = (referenceValue: number) => {
    const item = queue[queueIndex];
    const baseline = calibration;
    if (!item || !baseline) return;

    const stablePeak = machineRef.current.getPeakAngle();
    const smoothedVals = framesBufferRef.current.map((f) => f.armAngle);
    const meanDeg = smoothedVals.length ? smoothedVals.reduce((a, b) => a + b, 0) / smoothedVals.length : null;
    const rawMaxDeg = rawAngleBufferRef.current.length ? Math.max(...rawAngleBufferRef.current) : null;
    const avgConfidence = visibilitySamplesRef.current.length
      ? visibilitySamplesRef.current.reduce((a, b) => a + b, 0) / visibilitySamplesRef.current.length
      : null;
    const trunkComp = calculateMaxTrunkCompensation(framesBufferRef.current, baseline.neutralTrunkAngle);
    const secondsToConfirm = lockedAtMsRef.current !== null ? (Date.now() - lockedAtMsRef.current) / 1000 : null;

    const record: ValidationRecord = {
      recordId: currentRecordIdRef.current,
      algorithmVersion: ALGORITHM_VERSION,
      volunteerCode: validationSession.volunteerCode,
      examinerCode: validationSession.examinerCode,
      region: "ombro",
      test: item.movement,
      side: item.side,
      repetitionIndex: repIndexRef.current + 1,
      status: "valida",
      cancelReason: null,
      stablePeakDeg: stablePeak,
      meanDeg,
      rawMaxDeg,
      avgLandmarkConfidence: avgConfidence,
      trunkCompensationDeg: trunkComp,
      view: "frente", // todo teste de ombro hoje é de frente (ver passo 7 do plano)
      instrument: validationSession.instrument,
      referenceValueDeg: referenceValue,
      secondsToConfirm,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      timestampIso: new Date().toISOString(),
    };
    addValidationRecord(record);
    const rawRecord = buildRawFrameRecord("valida", referenceValue);
    if (rawRecord) addRawFrameRecord(rawRecord).catch(() => {});

    awaitingReferenceRef.current = false;
    lockedAtMsRef.current = null;
    rawAngleBufferRef.current = [];
    visibilitySamplesRef.current = [];
    rawFrameSamplesRef.current = [];

    speech.speak("Valor registrado, pode relaxar.", { force: true, interrupt: false });
    setTestUi((u) => ({ ...u, awaitingReference: false }));
    completeRepetition(stablePeak, performance.now());
  };

  const handleTestFrame = (landmarks: FrameLandmarks | null, timestamp: number) => {
    if (!armedRef.current) return;
    const item = queue[queueIndex];
    const baseline = calibration;
    if (!item || !baseline) return;

    // Modo de validação: depois de travar o valor ("segure a posição"), a
    // repetição não depende mais da câmera — o examinador pode se
    // aproximar, e a pessoa pode até sair do quadro. Só o botão de
    // confirmar (handleReferenceConfirm) decide o que acontece daqui.
    if (validationMode && awaitingReferenceRef.current) return;

    // Modo de validação: com o examinador por perto, é preciso garantir
    // que só o voluntário está sendo medido — mas isso só importa durante
    // o movimento, antes do valor travar (depois, o examinador já pode
    // entrar no quadro para medir).
    if (validationMode && poseCountRef.current > 1) {
      const twoPeopleMessage = "Mais de uma pessoa no quadro — o examinador deve ficar fora do enquadramento até o valor travar.";
      setTestUi((u) => (u.message === twoPeopleMessage ? u : { ...u, message: twoPeopleMessage }));
      speech.speak(twoPeopleMessage);
      return;
    }

    const requiredOk =
      !!landmarks &&
      landmarks.rightShoulder.visibility !== 0 &&
      landmarks.leftShoulder.visibility !== 0;

    if (!requiredOk) {
      lostCountRef.current += 1;
      if (lostCountRef.current > 8 && !testUi.lost) {
        const lostMessage = "Perdi a referência do seu braço. Volte à posição indicada.";
        setTestUi((u) => ({ ...u, lost: true, message: lostMessage }));
        speech.speak(lostMessage, { force: true });
        if (validationMode) {
          addValidationRecord({
            recordId: currentRecordIdRef.current,
            algorithmVersion: ALGORITHM_VERSION,
            volunteerCode: validationSession.volunteerCode,
            examinerCode: validationSession.examinerCode,
            region: "ombro",
            test: item.movement,
            side: item.side,
            repetitionIndex: repIndexRef.current + 1,
            status: "cancelada",
            cancelReason: "perdeu_referencia_durante_movimento",
            stablePeakDeg: null,
            meanDeg: null,
            rawMaxDeg: null,
            avgLandmarkConfidence: null,
            trunkCompensationDeg: null,
            view: "frente",
            instrument: validationSession.instrument,
            referenceValueDeg: null,
            secondsToConfirm: null,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
            timestampIso: new Date().toISOString(),
          });
          const rawRecord = buildRawFrameRecord("cancelada", null);
          if (rawRecord) addRawFrameRecord(rawRecord).catch(() => {});
        }
        // reinicia a repetição atual para não misturar dados incompletos
        machineRef.current.reset();
        framesBufferRef.current = [];
        rawAngleBufferRef.current = [];
        visibilitySamplesRef.current = [];
        rawFrameSamplesRef.current = [];
        capturingRef.current = false;
      }
      return;
    }

    if (testUi.lost) {
      setTestUi((u) => ({ ...u, lost: false, message: "" }));
      const neutral = item.side === "right" ? baseline.neutralArmAngleRight : baseline.neutralArmAngleLeft;
      machineRef.current.arm(neutral);
    }
    lostCountRef.current = 0;

    const shoulder = item.side === "right" ? landmarks!.rightShoulder : landmarks!.leftShoulder;
    const elbow = item.side === "right" ? landmarks!.rightElbow : landmarks!.leftElbow;
    const hip = item.side === "right" ? landmarks!.rightHip : landmarks!.leftHip;

    const rawAngle =
      item.movement === "flexion"
        ? calculateShoulderFlexionAngle(shoulder, elbow, hip)
        : calculateAbductionAngle(shoulder, elbow, hip);
    const angle = angleMaRef.current.push(rawAngle);
    const trunkAngle = calculateTrunkAngle(
      landmarks!.leftShoulder,
      landmarks!.rightShoulder,
      landmarks!.leftHip,
      landmarks!.rightHip
    );

    const detection = machineRef.current.update(angle);

    if (detection.justStarted) {
      startTsRef.current = timestamp;
      capturingRef.current = true;
      framesBufferRef.current = [];
      rawAngleBufferRef.current = [];
      visibilitySamplesRef.current = [];
      rawFrameSamplesRef.current = [];
      lastRawFrameSampleTsRef.current = -Infinity;
      currentRecordIdRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    if (capturingRef.current) {
      framesBufferRef.current.push({
        timestamp,
        shoulder,
        elbow,
        wrist: item.side === "right" ? landmarks!.rightWrist : landmarks!.leftWrist,
        hip,
        trunkAngle,
        armAngle: angle,
      });
      if (validationMode) {
        rawAngleBufferRef.current.push(rawAngle);
        const visSamples = [shoulder.visibility, elbow.visibility, hip.visibility].filter(
          (v): v is number => v !== undefined
        );
        if (visSamples.length) {
          visibilitySamplesRef.current.push(visSamples.reduce((a, b) => a + b, 0) / visSamples.length);
        }
        if (
          lastRawLandmarksRef.current &&
          timestamp - lastRawFrameSampleTsRef.current >= RAW_FRAME_INTERVAL_MS
        ) {
          lastRawFrameSampleTsRef.current = timestamp;
          rawFrameSamplesRef.current.push({
            t: timestamp,
            landmarks: lastRawLandmarksRef.current,
            worldLandmarks: worldLandmarksRef.current,
            aspect: getFrameAspect(),
          });
        }
      }
    }

    if (detection.justReachedPeak) {
      peakTsRef.current = timestamp;
      if (validationMode) {
        awaitingReferenceRef.current = true;
        lockedAtMsRef.current = Date.now();
        setTestUi((u) => ({ ...u, awaitingReference: true, message: "" }));
        speech.speak("Segure a posição.", { force: true, interrupt: false });
      } else {
        speech.speak("Pode voltar.", { force: true, interrupt: false });
      }
    }

    if (detection.justCompleted && !validationMode) {
      completeRepetition(machineRef.current.getPeakAngle(), timestamp);
    } else if (!detection.justCompleted) {
      setTestUi((u) => (u.angle === Math.round(angle) ? u : { ...u, angle: Math.round(angle) }));
    }
  };

  const drawFrame = (landmarks: FrameLandmarks | null, currentScreen: string) => {
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

    const item = queue[queueIndex];
    const highlightSide = currentScreen === "test" ? item?.side ?? null : null;

    drawPoseOverlay(ctx, landmarks, canvas.width, canvas.height, {
      highlightSide,
      angle: highlightSide ? testUi.angle : null,
    });
  };

  usePoseLandmarker(
    videoRef,
    (lm, _ts, poseCount, worldLm) => {
      poseCountRef.current = poseCount;
      worldLandmarksRef.current = worldLm;
      handleFrame(lm);
    },
    camera.status === "ready",
    { numPoses: validationMode ? 2 : 1 }
  );

  const item = queue[queueIndex];

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-moveo-ink">
      <CameraTopBar />
      {/*
        Proporção fixa em retrato (9:16), não calculada a partir de
        video.videoWidth/videoHeight: no iPhone (e em alguns Android), essas
        propriedades relatam a resolução do sensor ANTES da rotação para
        retrato, mesmo com o vídeo já aparecendo em pé na tela. Usar esses
        valores deixava a caixa "deitada" com tarjas pretas. object-fit:
        contain já resolve o corte/zoom original de forma robusta com
        qualquer proporção real de vídeo, sem precisar desses metadados —
        o que sobra dos dois lados (quando a proporção real da câmera não
        bate 9:16) fica na cor da marca (bg-moveo-ink) em vez de preto, e a
        barra de instrução inferior é opaca (bg-moveo-primary) por cima
        dessa área, então nunca aparece como uma "tarja preta".
      */}
      <div
        className="relative mx-auto w-full flex-1 overflow-hidden bg-moveo-ink"
        style={{
          aspectRatio: "9 / 16",
          maxHeight: "100dvh",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-contain"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" />

        {(screen === "camera" || screen === "positioning") && (
          <>
            <BodyPositionGuide ok={positioning.ok} />
            <div className="absolute inset-x-0 bottom-0 bg-moveo-primary px-6 pb-8 pt-4 text-center">
              <p className="text-lg font-semibold text-white">
                {camera.status === "requesting" && "Solicitando acesso à câmera..."}
                {camera.status === "denied" && "Permita o acesso à câmera para continuar."}
                {camera.status === "unavailable" && "Nenhuma câmera encontrada neste dispositivo."}
                {camera.status === "ready" && positioning.message}
              </p>
            </div>
          </>
        )}

        {screen === "calibration" && (
          <div className="absolute inset-x-0 bottom-0 bg-moveo-primary px-6 pb-8 pt-4 text-center">
            <p className="text-lg font-semibold text-white">Fique parado por um instante.</p>
            <p className="mt-1 text-sm text-white/80">Estamos ajustando a medição ao seu corpo.</p>
            <div className="mx-auto mt-4 h-2 w-48 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${calibrationProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {screen === "test" && item && (
          <>
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-5 pt-8 text-center">
              <p className="text-sm font-medium text-white/70">
                {MOVEMENT_TITLE[item.movement]} do ombro {SIDE_LABEL[item.side]}
              </p>
              <p className="mt-1 text-xs text-white/60">
                Rep {Math.min(repIndexRef.current + 1, REPS)} de {REPS}
              </p>
            </div>

            {testUi.countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="text-7xl font-bold text-white">{testUi.countdown}</span>
              </div>
            )}

            {testUi.awaitingReference ? (
              <ReferenceValueEntry instrument={validationSession.instrument} onConfirm={handleReferenceConfirm} />
            ) : (
              <div className="absolute inset-x-0 bottom-0 bg-moveo-primary px-6 pb-8 pt-4 text-center">
                {testUi.angle !== null && testUi.countdown === null && !testUi.lost && !validationMode && (
                  <p className="mb-2 text-4xl font-bold text-white">{testUi.angle}°</p>
                )}
                <p className="text-base font-medium text-white">
                  {testUi.lost
                    ? testUi.message
                    : testUi.message || MOVEMENT_INSTRUCTION[item.movement](SIDE_LABEL[item.side])}
                </p>
              </div>
            )}
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
            <div>phase: {machineRef.current.getPhase()}</div>
            <div>rep: {repIndexRef.current}</div>
            <div>angle: {testUi.angle}</div>
            <div>landmarks: {lastLandmarksRef.current ? "sim" : "não"}</div>
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
        <CameraFallback onDemo={() => useAssessmentStore.getState().loadDemoResult()} />
      )}
    </div>
  );
}
