"use client";

import { create } from "zustand";
import { average, calculateConsistency } from "@/lib/movementMetrics";
import {
  SpineAssessmentResult,
  SpineAttempt,
  SpineCalibrationBaseline,
  SpineIntakeInfo,
  SpineSafetyAnswers,
  SpineTest,
  SpineTestResult,
  StaticPosture,
} from "./types";
import { generateSpineSummary } from "./resultRules";
import { buildDemoSpineResult } from "./demoData";
import type { PainDuringMovement } from "@/lib/types";

export type SpineScreen =
  | "intakeArea"
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

export interface SpineQueueItem {
  test: SpineTest;
  orientation: "lateral" | "frontal";
  title: string;
  repositionInstruction: string;
  calibrationInstruction: string;
  movementInstruction: string;
}

export const SPINE_QUEUE: SpineQueueItem[] = [
  {
    test: "flexion",
    orientation: "lateral",
    title: "Flexão anterior do tronco",
    repositionInstruction:
      "Coloque o celular de lado em relação ao seu corpo, de forma que consiga ver seu tronco inteiro.",
    calibrationInstruction: "Fique em pé, parado, com os braços relaxados.",
    movementInstruction:
      "Incline lentamente o tronco para frente até onde for confortável. Não force. Depois retorne à posição inicial.",
  },
  {
    test: "lateralRight",
    orientation: "frontal",
    title: "Inclinação lateral direita",
    repositionInstruction:
      "Coloque o celular de frente para você, com pés confortavelmente afastados e braços relaxados.",
    calibrationInstruction: "Fique em pé, parado, de frente para a câmera.",
    movementInstruction: "Incline lentamente o tronco para a direita, sem girar o corpo. Depois retorne.",
  },
  {
    test: "lateralLeft",
    orientation: "frontal",
    title: "Inclinação lateral esquerda",
    repositionInstruction: "Continue de frente para a câmera.",
    calibrationInstruction: "Fique em pé, parado, de frente para a câmera.",
    movementInstruction: "Incline lentamente o tronco para a esquerda, sem girar o corpo. Depois retorne.",
  },
  {
    test: "extension",
    orientation: "lateral",
    title: "Extensão confortável do tronco",
    repositionInstruction: "Coloque o celular de lado novamente em relação ao seu corpo.",
    calibrationInstruction: "Fique em pé, parado, com os braços relaxados.",
    movementInstruction:
      "Incline suavemente o tronco para trás até onde for confortável. Não force — é um movimento confortável, sem buscar amplitude máxima.",
  },
];

interface SpineState {
  screen: SpineScreen;
  demoMode: boolean;
  debugMode: boolean;

  intake: SpineIntakeInfo;
  safety: SpineSafetyAnswers;
  calibration: SpineCalibrationBaseline | null;
  staticPosture: StaticPosture | null;

  queueIndex: number;
  /** Fila desta avaliação. Padrão: todos os testes; o acompanhamento pode pedir só alguns. */
  queue: SpineQueueItem[];
  setQueue: (queue: SpineQueueItem[]) => void;
  pendingAttempts: SpineAttempt[];
  results: SpineTestResult[];

  result: SpineAssessmentResult | null;

  setScreen: (s: SpineScreen) => void;
  setDemoMode: (v: boolean) => void;
  toggleDebugMode: () => void;
  setIntake: (patch: Partial<SpineIntakeInfo>) => void;
  setSafety: (patch: Partial<SpineSafetyAnswers>) => void;
  setCalibration: (c: SpineCalibrationBaseline) => void;
  setStaticPosture: (p: StaticPosture) => void;

  currentQueueItem: () => SpineQueueItem | null;
  addAttempt: (attempt: SpineAttempt) => void;
  finalizeBlockPain: (pain: PainDuringMovement) => void;
  advanceQueue: () => void;

  buildResult: () => void;
  loadDemoResult: () => void;
  reset: () => void;
}

const initialIntake: SpineIntakeInfo = {
  painArea: "no_pain",
  initialPain: 0,
  problemDuration: "no_pain",
};

const initialSafety: SpineSafetyAnswers = {
  recentTrauma: false,
  severePain: false,
  suddenWeaknessLoss: false,
  difficultyStanding: false,
};

export const useSpineStore = create<SpineState>((set, get) => ({
  screen: "intakeArea",
  demoMode: false,
  debugMode: false,

  intake: initialIntake,
  safety: initialSafety,
  calibration: null,
  staticPosture: null,

  queueIndex: 0,
  queue: SPINE_QUEUE,
  setQueue: (queue) => set({ queue, queueIndex: 0 }),
  pendingAttempts: [],
  results: [],

  result: null,

  setScreen: (screen) => set({ screen }),
  setDemoMode: (v) => set({ demoMode: v }),
  toggleDebugMode: () => set((s) => ({ debugMode: !s.debugMode })),
  setIntake: (patch) => set((s) => ({ intake: { ...s.intake, ...patch } })),
  setSafety: (patch) => set((s) => ({ safety: { ...s.safety, ...patch } })),
  setCalibration: (calibration) => set({ calibration }),
  setStaticPosture: (staticPosture) => set({ staticPosture }),

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
    const testResult: SpineTestResult = {
      test: item.test,
      attempts: pendingAttempts,
      averageMaxAngle: average(maxAngles),
      bestMaxAngle: Math.max(...maxAngles),
      consistency: calculateConsistency(maxAngles),
      pain,
    };
    set((s) => ({ results: [...s.results, testResult], pendingAttempts: [] }));
  },

  advanceQueue: () => set((s) => ({ queueIndex: s.queueIndex + 1 })),

  buildResult: () => {
    const { results, intake, demoMode, staticPosture } = get();
    const right = results.find((r) => r.test === "lateralRight");
    const left = results.find((r) => r.test === "lateralLeft");
    const lateralDifference =
      right && left ? Math.abs(right.averageMaxAngle - left.averageMaxAngle) : null;

    const summary = generateSpineSummary(results, lateralDifference, staticPosture);

    const result: SpineAssessmentResult = {
      completedAt: Date.now(),
      intake,
      results,
      lateralDifference,
      staticPosture,
      summary,
      isDemo: demoMode,
    };

    set({ result, screen: "results" });
  },

  loadDemoResult: () => {
    set({ demoMode: true, result: buildDemoSpineResult(), screen: "results" });
  },

  reset: () =>
    set({
      screen: "intakeArea",
      intake: initialIntake,
      safety: initialSafety,
      calibration: null,
      staticPosture: null,
      queueIndex: 0,
      queue: SPINE_QUEUE,
      pendingAttempts: [],
      results: [],
      result: null,
      demoMode: false,
    }),
}));
