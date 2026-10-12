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
import { calculateMaxTrunkCompensation } from "@/lib/trunkCompensation";
import { checkOrientation, checkVerticalFraming } from "@/lib/framing";
import { KNEE_CONFIG } from "@/config/modules/knee";
import { calculateKneeAngle, kneeFlexionFromRawAngle } from "../angles";
import { useKneeStore, KneeQueueItem } from "../store";
import { KneeAttempt, KneeMovementFrame, Side } from "../types";
import { drawLegOverlay } from "@/components/PoseOverlay";
import { PainQuestionScreen } from "./screens/PainQuestionScreen";
import { Button } from "@/components/ui/Button";
import { useSpeech } from "@/lib/useSpeech";
import { SoundToggle } from "@/components/shared/SoundToggle";
import { CameraTopBar } from "@/components/shared/CameraTopBar";
import { useValidationMode } from "@/lib/validation/useValidationMode";
import { useValidationSession } from "@/lib/validation/sessionStore";
import { useValidationRecordsStore } from "@/lib/validation/recordsStore";
import { ValidationRecord, RawFrameRecord, RawFrameSample } from "@/lib/validation/types";
import { addRawFrameRecord } from "@/lib/validation/rawFrameDb";
import { ReferenceValueEntry } from "@/components/shared/ReferenceValueEntry";
import { ALGORITHM_VERSION, PRECISION_CONFIG } from "@/config/precision";

const RAW_FRAME_INTERVAL_MS = PRECISION_CONFIG.validation.rawFrameSampleIntervalMs;

const REPS = KNEE_CONFIG.protocol.repetitionsPerMovement;
const CALIBRATION_MS = KNEE_CONFIG.protocol.calibrationDurationMs;
const VISIBILITY_MIN = KNEE_CONFIG.thresholds.landmarkVisibilityMin;

function visible(p: Point2D | undefined): boolean {
  return !!p && (p.visibility === undefined || p.visibility >= VISIBILITY_MIN);
}

/** Escolhe automaticamente o lado com melhor visibilidade do joelho — usado em testes de perfil sem lado fixo (sentar e levantar). */
function pickVisibleSide(landmarks: FrameLandmarks): Side {
  const rightVis = landmarks.rightKnee.visibility ?? 1;
  const leftVis = landmarks.leftKnee.visibility ?? 1;
  return rightVis >= leftVis ? "right" : "left";
}

export function KneeCameraFlow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camera = useCamera(videoRef);
  const speech = useSpeech();

  const screen = useKneeStore((s) => s.screen);
  const debugMode = useKneeStore((s) => s.debugMode);
  const toggleDebugMode = useKneeStore((s) => s.toggleDebugMode);
  const queueIndex = useKneeStore((s) => s.queueIndex);
  const queue = useKneeStore((s) => s.queue);
  const calibration = useKneeStore((s) => s.calibration);
  const item: KneeQueueItem | null = queue[queueIndex] ?? null;

  const validationMode = useValidationMode();
  const validationSession = useValidationSession();
  const addValidationRecord = useValidationRecordsStore((s) => s.addRecord);

  const [positioningOk, setPositioningOk] = useState(false);
  const [positioningMsg, setPositioningMsg] = useState("Procurando você...");
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [testUi, setTestUi] = useState<{
    repIndex: number;
    angle: number | null;
    message: string;
    countdown: number | null;
    lost: boolean;
    awaitingReference: boolean;
  }>({ repIndex: 0, angle: null, message: "", countdown: null, lost: false, awaitingReference: false });

  const holdStartRef = useRef<number | null>(null);
  const calibrationStartRef = useRef<number | null>(null);
  const calibrationSamplesRef = useRef<
    { trunkAngle: number; rightKneeAngle: number; leftKneeAngle: number; hipMidX: number }[]
  >([]);
  const trackedSideRef = useRef<Side>("right");
  const neutralSignalRef = useRef(0);

  const machineRef = useRef(new MovementStateMachine(KNEE_CONFIG.thresholds.movementDetection));
  const angleMaRef = useRef(new MovingAverage(5));
  // Passo 3 da iniciativa de precisão: suaviza os pontos do corpo antes de
  // qualquer cálculo de ângulo — ver comentário em components/CameraFlow.tsx.
  const smootherRef = useRef(new LandmarksSmoother(PRECISION_CONFIG.smoothing.emaAlpha));
  const repIndexRef = useRef(0);
  const capturingRef = useRef(false);
  const framesBufferRef = useRef<KneeMovementFrame[]>([]);
  const startTsRef = useRef(0);
  const peakTsRef = useRef(0);
  const lostCountRef = useRef(0);
  const armedRef = useRef(false);
  const reArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handsNearHipRef = useRef(false);
  const calibrationSpokenRef = useRef(false);

  // Modo de validação (passo 2 da iniciativa de precisão) — só usados
  // quando validationMode é true; não afetam o paciente comum.
  const poseCountRef = useRef(1);
  const awaitingReferenceRef = useRef(false);
  const lockedAtMsRef = useRef<number | null>(null);
  const rawAngleBufferRef = useRef<number[]>([]);
  const smoothedAngleBufferRef = useRef<number[]>([]);
  const visibilitySamplesRef = useRef<number[]>([]);
  // Gravação bruta (passo intermediário) — ver comentário em components/CameraFlow.tsx.
  const lastRawLandmarksRef = useRef<FrameLandmarks | null>(null);
  const worldLandmarksRef = useRef<FrameLandmarks | null>(null);
  const rawFrameSamplesRef = useRef<RawFrameSample[]>([]);
  const lastRawFrameSampleTsRef = useRef(-Infinity);
  const currentRecordIdRef = useRef<string>("");

  useEffect(() => {
    if (screen === "camera") camera.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (screen === "camera" && camera.status === "ready") {
      useKneeStore.getState().setScreen("reposition");
    }
  }, [screen, camera.status]);

  useEffect(() => {
    if (screen === "reposition" && item) {
      speech.speak(item.repositionInstruction, { force: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, queueIndex]);

  // (re)inicia bloco de teste ao entrar em "test"
  useEffect(() => {
    if (screen !== "test" || !item) return;
    const baseline = useKneeStore.getState().calibration;
    if (!baseline) return;

    machineRef.current.reset();
    angleMaRef.current.reset();
    repIndexRef.current = 0;
    capturingRef.current = false;
    framesBufferRef.current = [];
    armedRef.current = false;

    let cancelled = false;
    let count = KNEE_CONFIG.protocol.countdownSeconds;
    setTestUi({ repIndex: 0, angle: null, message: "", countdown: count, lost: false, awaitingReference: false });
    awaitingReferenceRef.current = false;

    const neutralSignal = () => {
      if (item.test === "flexion") {
        const raw =
          item.side === "right" ? baseline.neutralKneeAngleRight : baseline.neutralKneeAngleLeft;
        return kneeFlexionFromRawAngle(raw);
      }
      if (item.test === "squat") {
        return (
          (kneeFlexionFromRawAngle(baseline.neutralKneeAngleRight) +
            kneeFlexionFromRawAngle(baseline.neutralKneeAngleLeft)) /
          2
        );
      }
      return 0; // sitToStand: sinal é definido como progresso a partir do neutro sentado
    };

    const tick = () => {
      if (cancelled) return;
      count -= 1;
      if (count > 0) {
        setTestUi((u) => ({ ...u, countdown: count }));
        setTimeout(tick, 1000);
      } else {
        setTestUi((u) => ({ ...u, countdown: null }));
        neutralSignalRef.current = neutralSignal();
        machineRef.current.arm(neutralSignalRef.current);
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
    if (!item) return { ok: false, message: "" };

    if (item.test === "squat") {
      const required = [
        landmarks.leftHip,
        landmarks.rightHip,
        landmarks.leftKnee,
        landmarks.rightKnee,
        landmarks.leftAnkle,
        landmarks.rightAnkle,
      ];
      if (!required.every(visible)) {
        return { ok: false, message: "Precisamos enxergar os dois joelhos e tornozelos." };
      }
      return { ok: true, message: "Perfeito! Posição ideal." };
    }

    if (item.test === "flexion") {
      const side = item.side as Side;
      const hip = side === "right" ? landmarks.rightHip : landmarks.leftHip;
      const knee = side === "right" ? landmarks.rightKnee : landmarks.leftKnee;
      const ankle = side === "right" ? landmarks.rightAnkle : landmarks.leftAnkle;
      if (![hip, knee, ankle].every(visible)) {
        return { ok: false, message: "Precisamos enxergar seu quadril, joelho e tornozelo." };
      }
      return { ok: true, message: "Perfeito! Posição ideal." };
    }

    // sitToStand
    const side = trackedSideRef.current;
    const hip = side === "right" ? landmarks.rightHip : landmarks.leftHip;
    const knee = side === "right" ? landmarks.rightKnee : landmarks.leftKnee;
    const ankle = side === "right" ? landmarks.rightAnkle : landmarks.leftAnkle;
    if (![hip, knee, ankle].every(visible)) {
      return { ok: false, message: "Precisamos enxergar seu quadril, joelho e tornozelo." };
    }
    return { ok: true, message: "Perfeito! Posição ideal." };
  };

  /**
   * Checagem mais rigorosa usada só na tela de posicionamento (antes de
   * calibrar): além da visibilidade dos landmarks, verifica orientação
   * (de lado/de frente) e distância aproximada da câmera. Evita que o
   * teste comece com o corpo mal enquadrado, que é a causa mais comum de
   * o MediaPipe "alucinar" a posição de joelho/tornozelo fora do quadro.
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
        frontalMinRatio: KNEE_CONFIG.thresholds.framing.orientationFrontalMinRatio,
        lateralMinNoseOffsetRatio: KNEE_CONFIG.thresholds.framing.lateralMinNoseOffsetRatio,
      }
    );
    if (!orientation.ok) return orientation;

    if (item.test === "squat") {
      const lowestAnkleY = Math.max(landmarks.leftAnkle.y, landmarks.rightAnkle.y);
      const framing = checkVerticalFraming(
        landmarks.nose,
        { x: 0, y: lowestAnkleY },
        {
          minSpanRatio: KNEE_CONFIG.thresholds.framing.frontalMinSpanRatio,
          maxSpanRatio: KNEE_CONFIG.thresholds.framing.frontalMaxSpanRatio,
        }
      );
      return framing;
    }

    const side = item.test === "flexion" ? (item.side as Side) : trackedSideRef.current;
    const topPoint = side === "right" ? landmarks.rightShoulder : landmarks.leftShoulder;
    const ankle = side === "right" ? landmarks.rightAnkle : landmarks.leftAnkle;
    const framing = checkVerticalFraming(topPoint, ankle, {
      minSpanRatio: KNEE_CONFIG.thresholds.framing.lateralMinSpanRatio,
      maxSpanRatio: KNEE_CONFIG.thresholds.framing.lateralMaxSpanRatio,
    });
    return framing;
  };

  const handleFrame = (rawLandmarks: FrameLandmarks | null) => {
    lastRawLandmarksRef.current = rawLandmarks;
    // Passo 3: suaviza antes de qualquer outra coisa — ver comentário em
    // components/CameraFlow.tsx.
    const landmarks = rawLandmarks ? smootherRef.current.smooth(rawLandmarks) : null;
    const timestamp = performance.now();
    const currentScreen = useKneeStore.getState().screen;
    drawFrame(landmarks);

    if (currentScreen === "positioning") {
      if (landmarks) trackedSideRef.current = pickVisibleSide(landmarks);
      const check = checkPositioningQuality(landmarks);
      setPositioningOk(check.ok);
      setPositioningMsg(check.message);
      speech.speak(check.message);
      if (check.ok) {
        if (holdStartRef.current === null) holdStartRef.current = timestamp;
        if (timestamp - holdStartRef.current >= 1000) {
          holdStartRef.current = null;
          useKneeStore.getState().setScreen("calibration");
        }
      } else {
        holdStartRef.current = null;
      }
      return;
    }

    if (currentScreen === "calibration") {
      if (!landmarks || !item) {
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
      const rightKneeAngle = calculateKneeAngle(landmarks.rightHip, landmarks.rightKnee, landmarks.rightAnkle);
      const leftKneeAngle = calculateKneeAngle(landmarks.leftHip, landmarks.leftKnee, landmarks.leftAnkle);
      const hipMidX = midpoint(landmarks.leftHip, landmarks.rightHip).x;
      calibrationSamplesRef.current.push({ trunkAngle, rightKneeAngle, leftKneeAngle, hipMidX });

      const elapsed = timestamp - calibrationStartRef.current;
      const progress = Math.min(1, elapsed / CALIBRATION_MS);
      setCalibrationProgress(progress);

      if (progress >= 1) {
        const samples = calibrationSamplesRef.current;
        const avg = (key: keyof (typeof samples)[number]) =>
          samples.reduce((sum, s) => sum + s[key], 0) / samples.length;

        useKneeStore.getState().setCalibration({
          neutralTrunkAngle: avg("trunkAngle"),
          neutralKneeAngleRight: avg("rightKneeAngle"),
          neutralKneeAngleLeft: avg("leftKneeAngle"),
          neutralHipMidX: avg("hipMidX"),
          capturedAt: Date.now(),
        });
        calibrationStartRef.current = null;
        calibrationSamplesRef.current = [];
        calibrationSpokenRef.current = false;
        useKneeStore.getState().setScreen("test");
      }
      return;
    }

    if (currentScreen === "test") {
      handleTestFrame(landmarks, timestamp);
    }
  };

  /**
   * Termina a repetição (soma na store, decide se acabou o bloco ou re-arma
   * para a próxima) — compartilhado pelo fluxo normal (detecção automática
   * de retorno ao neutro) e pelo modo de validação (confirmação manual do
   * examinador, ver finalizeValidatedRepetition).
   */
  const completeRepetition = (maxAngle: number, endTimestamp: number) => {
    if (!item || !calibration) return;
    capturingRef.current = false;
    const duration = calculateMovementDuration(startTsRef.current, peakTsRef.current || endTimestamp);
    const attempt: KneeAttempt = {
      test: item.test,
      side: item.side,
      repetitionIndex: repIndexRef.current + 1,
      frames: framesBufferRef.current,
      maxAngle,
      startTimestamp: startTsRef.current,
      peakTimestamp: peakTsRef.current || endTimestamp,
      endTimestamp,
      duration,
      averageAngularVelocity: calculateAngularVelocity(maxAngle, duration),
      maxTrunkCompensation: calculateMaxTrunkCompensation(framesBufferRef.current, calibration.neutralTrunkAngle),
      handsUsed: item.test === "sitToStand" ? handsNearHipRef.current : undefined,
    };
    useKneeStore.getState().addAttempt(attempt);
    repIndexRef.current += 1;
    framesBufferRef.current = [];

    if (repIndexRef.current >= REPS) {
      armedRef.current = false;
      useKneeStore.getState().setScreen("painQuestion");
      setTestUi((u) => ({ ...u, repIndex: repIndexRef.current, message: "" }));
    } else {
      armedRef.current = false;
      setTestUi((u) => ({ ...u, repIndex: repIndexRef.current, message: "Muito bem." }));
      speech.speak("Muito bem.", { force: true, interrupt: false });
      reArmTimerRef.current = setTimeout(() => {
        machineRef.current.arm(neutralSignalRef.current);
        armedRef.current = true;
        setTestUi((u) => ({ ...u, message: "" }));
        speech.speak("Pode começar.", { force: true, interrupt: false });
      }, 1600);
    }
  };

  /**
   * Monta o registro bruto (pontos quadro a quadro, ANTES da suavização)
   * de uma repetição — ver comentário em components/CameraFlow.tsx.
   */
  const buildRawFrameRecord = (
    status: "valida" | "cancelada",
    referenceValueDeg: number | null
  ): RawFrameRecord | null => {
    if (!item || !calibration) return null;
    return {
      recordId: currentRecordIdRef.current,
      algorithmVersion: ALGORITHM_VERSION,
      volunteerCode: validationSession.volunteerCode,
      examinerCode: validationSession.examinerCode,
      region: "joelho",
      test: item.test,
      side: item.side,
      repetitionIndex: repIndexRef.current + 1,
      status,
      referenceValueDeg,
      instrument: validationSession.instrument,
      calibration: { ...calibration },
      samples: rawFrameSamplesRef.current,
    };
  };

  /**
   * Chamado quando o examinador confirma o valor de referência (goniômetro
   * / inclinômetro) no modo de validação. Usa os quadros já congelados no
   * instante do "segure a posição" — nada foi atualizado desde então.
   */
  const handleReferenceConfirm = (referenceValue: number) => {
    if (!item || !calibration) return;

    const stablePeak = machineRef.current.getPeakAngle();
    const smoothedVals = smoothedAngleBufferRef.current;
    const meanDeg = smoothedVals.length ? smoothedVals.reduce((a, b) => a + b, 0) / smoothedVals.length : null;
    const rawMaxDeg = rawAngleBufferRef.current.length ? Math.max(...rawAngleBufferRef.current) : null;
    const avgConfidence = visibilitySamplesRef.current.length
      ? visibilitySamplesRef.current.reduce((a, b) => a + b, 0) / visibilitySamplesRef.current.length
      : null;
    const trunkComp = calculateMaxTrunkCompensation(framesBufferRef.current, calibration.neutralTrunkAngle);
    const secondsToConfirm = lockedAtMsRef.current !== null ? (Date.now() - lockedAtMsRef.current) / 1000 : null;

    const record: ValidationRecord = {
      recordId: currentRecordIdRef.current,
      algorithmVersion: ALGORITHM_VERSION,
      volunteerCode: validationSession.volunteerCode,
      examinerCode: validationSession.examinerCode,
      region: "joelho",
      test: item.test,
      side: item.side,
      repetitionIndex: repIndexRef.current + 1,
      status: "valida",
      cancelReason: null,
      stablePeakDeg: stablePeak,
      meanDeg,
      rawMaxDeg,
      avgLandmarkConfidence: avgConfidence,
      trunkCompensationDeg: trunkComp,
      view: item.orientation === "lateral" ? "perfil" : "frente",
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
    smoothedAngleBufferRef.current = [];
    visibilitySamplesRef.current = [];
    rawFrameSamplesRef.current = [];

    speech.speak("Valor registrado, pode relaxar.", { force: true, interrupt: false });
    setTestUi((u) => ({ ...u, awaitingReference: false }));
    completeRepetition(stablePeak, performance.now());
  };

  const handleTestFrame = (landmarks: FrameLandmarks | null, timestamp: number) => {
    if (!armedRef.current || !item || !calibration) return;

    // Modo de validação: depois de travar o valor ("segure a posição"), a
    // repetição não depende mais da câmera — o examinador pode se
    // aproximar, e a pessoa pode até sair do quadro.
    if (validationMode && awaitingReferenceRef.current) return;

    // Modo de validação: só importa detectar o examinador no quadro
    // durante o movimento, antes do valor travar.
    if (validationMode && poseCountRef.current > 1) {
      const twoPeopleMessage = "Mais de uma pessoa no quadro — o examinador deve ficar fora do enquadramento até o valor travar.";
      setTestUi((u) => (u.message === twoPeopleMessage ? u : { ...u, message: twoPeopleMessage }));
      speech.speak(twoPeopleMessage);
      return;
    }

    const check = checkQuality(landmarks);
    if (!check.ok || !landmarks) {
      lostCountRef.current += 1;
      if (lostCountRef.current > 8 && !testUi.lost) {
        const lostMessage = "Perdi a referência do seu movimento. Volte à posição indicada.";
        setTestUi((u) => ({ ...u, lost: true, message: lostMessage }));
        speech.speak(lostMessage, { force: true });
        if (validationMode) {
          addValidationRecord({
            recordId: currentRecordIdRef.current,
            algorithmVersion: ALGORITHM_VERSION,
            volunteerCode: validationSession.volunteerCode,
            examinerCode: validationSession.examinerCode,
            region: "joelho",
            test: item.test,
            side: item.side,
            repetitionIndex: repIndexRef.current + 1,
            status: "cancelada",
            cancelReason: "perdeu_referencia_durante_movimento",
            stablePeakDeg: null,
            meanDeg: null,
            rawMaxDeg: null,
            avgLandmarkConfidence: null,
            trunkCompensationDeg: null,
            view: item.orientation === "lateral" ? "perfil" : "frente",
            instrument: validationSession.instrument,
            referenceValueDeg: null,
            secondsToConfirm: null,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
            timestampIso: new Date().toISOString(),
          });
          const rawRecord = buildRawFrameRecord("cancelada", null);
          if (rawRecord) addRawFrameRecord(rawRecord).catch(() => {});
        }
        machineRef.current.reset();
        framesBufferRef.current = [];
        rawAngleBufferRef.current = [];
        smoothedAngleBufferRef.current = [];
        visibilitySamplesRef.current = [];
        rawFrameSamplesRef.current = [];
        capturingRef.current = false;
      }
      return;
    }
    if (testUi.lost) {
      setTestUi((u) => ({ ...u, lost: false, message: "" }));
    }
    lostCountRef.current = 0;

    const trunkAngle = calculateTrunkAngle(
      landmarks.leftShoulder,
      landmarks.rightShoulder,
      landmarks.leftHip,
      landmarks.rightHip
    );
    const rightRaw = calculateKneeAngle(landmarks.rightHip, landmarks.rightKnee, landmarks.rightAnkle);
    const leftRaw = calculateKneeAngle(landmarks.leftHip, landmarks.leftKnee, landmarks.leftAnkle);

    const side: Side = item.side === "both" ? trackedSideRef.current : (item.side as Side);
    let rawSignal: number;
    const extra: Partial<KneeMovementFrame> = {};

    if (item.test === "flexion") {
      rawSignal = kneeFlexionFromRawAngle(side === "right" ? rightRaw : leftRaw);
    } else if (item.test === "squat") {
      rawSignal = (kneeFlexionFromRawAngle(rightRaw) + kneeFlexionFromRawAngle(leftRaw)) / 2;
      const hipMid = midpoint(landmarks.leftHip, landmarks.rightHip);
      const hipWidth = distance(landmarks.leftHip, landmarks.rightHip) || 1;
      extra.otherKneeAngle = side === "right" ? leftRaw : rightRaw;
      extra.hipLateralShift = (hipMid.x - calibration.neutralHipMidX) / hipWidth;
    } else {
      const neutralSeated = kneeFlexionFromRawAngle(
        side === "right" ? calibration.neutralKneeAngleRight : calibration.neutralKneeAngleLeft
      );
      const currentFlexion = kneeFlexionFromRawAngle(side === "right" ? rightRaw : leftRaw);
      rawSignal = Math.max(0, neutralSeated - currentFlexion);
      const wrist = side === "right" ? landmarks.rightWrist : landmarks.leftWrist;
      const hip = side === "right" ? landmarks.rightHip : landmarks.leftHip;
      const near = distance(wrist, hip) < 0.15;
      extra.handsNearHip = near;
      if (near) handsNearHipRef.current = true;
    }

    const signal = angleMaRef.current.push(rawSignal);
    const detection = machineRef.current.update(signal);

    if (detection.justStarted) {
      startTsRef.current = timestamp;
      capturingRef.current = true;
      framesBufferRef.current = [];
      rawAngleBufferRef.current = [];
      smoothedAngleBufferRef.current = [];
      visibilitySamplesRef.current = [];
      rawFrameSamplesRef.current = [];
      lastRawFrameSampleTsRef.current = -Infinity;
      currentRecordIdRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      handsNearHipRef.current = false;
    }

    if (capturingRef.current) {
      const hip = side === "right" ? landmarks.rightHip : landmarks.leftHip;
      const knee = side === "right" ? landmarks.rightKnee : landmarks.leftKnee;
      const ankle = side === "right" ? landmarks.rightAnkle : landmarks.leftAnkle;
      framesBufferRef.current.push({
        timestamp,
        hip,
        knee,
        ankle,
        trunkAngle,
        kneeAngle: side === "right" ? rightRaw : leftRaw,
        ...extra,
      });
      if (validationMode) {
        rawAngleBufferRef.current.push(rawSignal);
        smoothedAngleBufferRef.current.push(signal);
        const visSamples = [hip.visibility, knee.visibility, ankle.visibility].filter(
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
    if (!landmarks || !item) return;
    const highlightSide =
      item.test === "squat" ? "both" : item.test === "flexion" ? (item.side as Side) : trackedSideRef.current;
    drawLegOverlay(ctx, landmarks, canvas.width, canvas.height, { highlightSide });
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

        {(screen === "camera") && (
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
            <p className="mt-3 text-sm leading-relaxed text-moveo-muted">
              {item.repositionInstruction}
            </p>
            <Button
              className="mt-8"
              onClick={() => useKneeStore.getState().setScreen("positioning")}
            >
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

            {testUi.awaitingReference ? (
              <ReferenceValueEntry instrument={validationSession.instrument} onConfirm={handleReferenceConfirm} />
            ) : (
              <div className="absolute inset-x-0 bottom-0 bg-moveo-primary px-6 pb-8 pt-4 text-center">
                {testUi.angle !== null && testUi.countdown === null && !testUi.lost && !validationMode && (
                  <p className="mb-2 text-4xl font-bold text-white">{testUi.angle}°</p>
                )}
                <p className="text-base font-medium text-white">
                  {testUi.message || item.movementInstruction}
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
            <div>test: {item.test}</div>
            <div>phase: {machineRef.current.getPhase()}</div>
            <div>rep: {repIndexRef.current}</div>
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
        <CameraFallback onDemo={() => useKneeStore.getState().loadDemoResult()} />
      )}
    </div>
  );
}
