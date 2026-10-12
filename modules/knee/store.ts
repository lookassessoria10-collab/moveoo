"use client";

import { create } from "zustand";
import { average, calculateConsistency, calculateSideDifference } from "@/lib/movementMetrics";
import {
  KneeAssessmentResult,
  KneeAttempt,
  KneeCalibrationBaseline,
  KneeIntakeInfo,
  KneeSafetyAnswers,
  KneeTest,
  KneeTestResult,
  Side,
} from "./types";
import { generateKneeSummary } from "./resultRules";
import { buildDemoKneeResult } from "./demoData";
import type { PainDuringMovement } from "@/lib/types";

export type KneeScreen =
  | "validationSetup"
  | "symptomSide"
  | "initialPain"
  | "problemDuration"
  | "safetyCheck"
  | "safetyBlocked"
  | "preparation"
  | "camera"
  | "reposition"
  | "positioning"
  | "calibration"
  | "test"
  | "painQuestion"
  | "processing"
  | "results"
  | "technicalReport";

export interface KneeQueueItem {
  test: KneeTest;
  side: Side | "both";
  orientation: "lateral" | "frontal";
  title: string;
  repositionInstruction: string;
  calibrationInstruction: string;
  movementInstruction: string;
}

export const KNEE_QUEUE: KneeQueueItem[] = [
  {
    test: "flexion",
    side: "right",
    orientation: "lateral",
    title: "Flexão do joelho direito",
    repositionInstruction:
      "Coloque o celular de lado em relação ao seu corpo. Afaste-se até que quadril, joelho e tornozelo direitos estejam visíveis.",
    calibrationInstruction: "Fique em pé, parado, com as pernas relaxadas.",
    movementInstruction:
      "Dobre lentamente o joelho direito, levando o pé para trás até onde conseguir confortavelmente. Não force.",
  },
  {
    test: "flexion",
    side: "left",
    orientation: "lateral",
    title: "Flexão do joelho esquerdo",
    repositionInstruction:
      "Vire-se para o outro lado, de forma que quadril, joelho e tornozelo esquerdos fiquem visíveis.",
    calibrationInstruction: "Fique em pé, parado, com as pernas relaxadas.",
    movementInstruction:
      "Dobre lentamente o joelho esquerdo, levando o pé para trás até onde conseguir confortavelmente. Não force.",
  },
  {
    test: "squat",
    side: "both",
    orientation: "frontal",
    title: "Agachamento",
    repositionInstruction:
      "Coloque o celular de frente para você. Afaste-se até que todo o seu corpo, dos ombros aos pés, esteja visível.",
    calibrationInstruction: "Fique em pé, parado, com os pés confortavelmente afastados.",
    movementInstruction:
      "Faça um agachamento confortável e volte à posição inicial. Não precisa descer além do que for confortável.",
  },
  {
    test: "sitToStand",
    side: "both",
    orientation: "lateral",
    title: "Sentar e levantar",
    repositionInstruction:
      "Posicione uma cadeira estável atrás de você e o celular de lado, de forma que consiga ver quadril, joelho e tornozelo sentado e em pé.",
    calibrationInstruction: "Sente-se normalmente na cadeira e fique parado por um instante.",
    movementInstruction: "Quando começar, levante-se e depois sente-se novamente.",
  },
];

interface KneeState {
  screen: KneeScreen;
  demoMode: boolean;
  debugMode: boolean;

  intake: KneeIntakeInfo;
  safety: KneeSafetyAnswers;
  calibration: KneeCalibrationBaseline | null;

  queueIndex: number;
  /** Fila desta avaliação. Padrão: todos os testes; o acompanhamento pode pedir só alguns. */
  queue: KneeQueueItem[];
  setQueue: (queue: KneeQueueItem[]) => void;
  pendingAttempts: KneeAttempt[];
  flexionResults: KneeTestResult[];
  squatResult: KneeTestResult | null;
  sitToStandResult: KneeTestResult | null;

  result: KneeAssessmentResult | null;

  setScreen: (s: KneeScreen) => void;
  setDemoMode: (v: boolean) => void;
  toggleDebugMode: () => void;
  setIntake: (patch: Partial<KneeIntakeInfo>) => void;
  setSafety: (patch: Partial<KneeSafetyAnswers>) => void;
  setCalibration: (c: KneeCalibrationBaseline) => void;

  currentQueueItem: () => KneeQueueItem | null;
  addAttempt: (attempt: KneeAttempt) => void;
  finalizeBlockPain: (pain: PainDuringMovement) => void;
  advanceQueue: () => void;

  buildResult: () => void;
  loadDemoResult: () => void;
  reset: () => void;
}

const initialIntake: KneeIntakeInfo = {
  symptomSide: "testing",
  initialPain: 0,
  problemDuration: "no_pain",
};

const initialSafety: KneeSafetyAnswers = {
  recentTrauma: false,
  severePain: false,
  cannotBearWeight: false,
  visibleDeformity: false,
  suddenMovementLoss: false,
};

export const useKneeStore = create<KneeState>((set, get) => ({
  screen: "symptomSide",
  demoMode: false,
  debugMode: false,

  intake: initialIntake,
  safety: initialSafety,
  calibration: null,

  queueIndex: 0,
  queue: KNEE_QUEUE,
  setQueue: (queue) => set({ queue, queueIndex: 0 }),
  pendingAttempts: [],
  flexionResults: [],
  squatResult: null,
  sitToStandResult: null,

  result: null,

  setScreen: (screen) => set({ screen }),
  setDemoMode: (v) => set({ demoMode: v }),
  toggleDebugMode: () => set((s) => ({ debugMode: !s.debugMode })),
  setIntake: (patch) => set((s) => ({ intake: { ...s.intake, ...patch } })),
  setSafety: (patch) => set((s) => ({ safety: { ...s.safety, ...patch } })),
  setCalibration: (calibration) => set({ calibration }),

  currentQueueItem: () => {
    const { queueIndex } = get();
    return get().queue[queueIndex] ?? null;
  },

  addAttempt: (attempt) => set((s) => ({ pendingAttempts: [...s.pendingAttempts, attempt] })),

  finalizeBlockPain: (pain) => {
    const { pendingAttempts, queueIndex } = get();
    const item = get().queue[queueIndex];
    if (!item) return;
    const maxAngles = pendingAttempts.map((a) => a.maxAngle);
    const testResult: KneeTestResult = {
      test: item.test,
      side: item.side,
      attempts: pendingAttempts,
      averageMaxAngle: average(maxAngles),
      bestMaxAngle: Math.max(...maxAngles),
      consistency: calculateConsistency(maxAngles),
      pain,
    };

    if (item.test === "flexion") {
      set((s) => ({ flexionResults: [...s.flexionResults, testResult], pendingAttempts: [] }));
    } else if (item.test === "squat") {
      const diffs = pendingAttempts.flatMap((a) =>
        a.frames
          .filter((f) => f.otherKneeAngle !== undefined)
          .map((f) => Math.abs(f.kneeAngle - (f.otherKneeAngle as number)))
      );
      const shifts = pendingAttempts.flatMap((a) =>
        a.frames.map((f) => Math.abs(f.hipLateralShift ?? 0))
      );
      testResult.kneeAsymmetryDeg = diffs.length ? average(diffs) : 0;
      testResult.maxHipLateralShift = shifts.length ? Math.max(...shifts) : 0;
      set({ squatResult: testResult, pendingAttempts: [] });
    } else {
      set({ sitToStandResult: testResult, pendingAttempts: [] });
    }
  },

  advanceQueue: () => set((s) => ({ queueIndex: s.queueIndex + 1 })),

  buildResult: () => {
    const { flexionResults, squatResult, sitToStandResult, intake, demoMode } = get();
    const right = flexionResults.find((r) => r.side === "right")?.averageMaxAngle ?? null;
    const left = flexionResults.find((r) => r.side === "left")?.averageMaxAngle ?? null;
    const flexionComparison = calculateSideDifference(right, left);

    const summary = generateKneeSummary(flexionResults, flexionComparison, squatResult, sitToStandResult);

    const result: KneeAssessmentResult = {
      completedAt: Date.now(),
      intake,
      flexionResults,
      squatResult,
      sitToStandResult,
      flexionComparison,
      summary,
      isDemo: demoMode,
    };

    set({ result, screen: "results" });
  },

  loadDemoResult: () => {
    set({ demoMode: true, result: buildDemoKneeResult(), screen: "results" });
  },

  reset: () =>
    set({
      screen: "symptomSide",
      intake: initialIntake,
      safety: initialSafety,
      calibration: null,
      queueIndex: 0,
      queue: KNEE_QUEUE,
      pendingAttempts: [],
      flexionResults: [],
      squatResult: null,
      sitToStandResult: null,
      result: null,
      demoMode: false,
    }),
}));
