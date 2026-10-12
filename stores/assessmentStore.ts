"use client";

import { create } from "zustand";
import {
  AssessmentResult,
  CalibrationBaseline,
  IntakeInfo,
  Movement,
  MovementAttempt,
  MovementBlockResult,
  PainDuringMovement,
  SafetyAnswers,
  Side,
} from "@/lib/types";
import { calculateSideDifference, calculateMovementIndex, summarizeAttempts } from "@/lib/movementMetrics";
import { generateSummary } from "@/lib/resultRules";
import { buildDemoResult } from "@/lib/demoData";

export type Screen =
  | "validationSetup"
  | "welcome"
  | "symptomSide"
  | "initialPain"
  | "problemDuration"
  | "safetyCheck"
  | "safetyBlocked"
  | "preparation"
  | "camera"
  | "positioning"
  | "calibration"
  | "test"
  | "painQuestion"
  | "processing"
  | "results"
  | "technicalReport"
  | "doctorReport";

export interface TestQueueItem {
  side: Side;
  movement: Movement;
}

export const TEST_QUEUE: TestQueueItem[] = [
  { side: "right", movement: "flexion" },
  { side: "left", movement: "flexion" },
  { side: "right", movement: "abduction" },
  { side: "left", movement: "abduction" },
];

interface AssessmentState {
  screen: Screen;
  demoMode: boolean;
  debugMode: boolean;

  intake: IntakeInfo;
  safety: SafetyAnswers;
  calibration: CalibrationBaseline | null;

  queueIndex: number;
  /** Fila desta avaliação. Padrão: todos os testes; o acompanhamento pode pedir só alguns. */
  queue: TestQueueItem[];
  setQueue: (queue: TestQueueItem[]) => void;
  pendingAttempts: MovementAttempt[];
  blocks: MovementBlockResult[];

  result: AssessmentResult | null;

  setScreen: (s: Screen) => void;
  setDemoMode: (v: boolean) => void;
  toggleDebugMode: () => void;
  setIntake: (patch: Partial<IntakeInfo>) => void;
  setSafety: (patch: Partial<SafetyAnswers>) => void;
  setCalibration: (c: CalibrationBaseline) => void;

  currentQueueItem: () => TestQueueItem | null;
  addAttempt: (attempt: MovementAttempt) => void;
  finalizeBlockPain: (pain: PainDuringMovement) => void;
  advanceQueue: () => void;

  buildResult: () => void;
  loadDemoResult: () => void;
  reset: () => void;
}

const initialIntake: IntakeInfo = {
  symptomSide: "testing",
  initialPain: 0,
  problemDuration: "no_pain",
};

const initialSafety: SafetyAnswers = {
  recentTrauma: false,
  severePain: false,
  suddenWeakness: false,
  cannotMoveArm: false,
};

export const useAssessmentStore = create<AssessmentState>((set, get) => ({
  screen: "welcome",
  demoMode: false,
  debugMode: false,

  intake: initialIntake,
  safety: initialSafety,
  calibration: null,

  queueIndex: 0,
  queue: TEST_QUEUE,
  setQueue: (queue) => set({ queue, queueIndex: 0 }),
  pendingAttempts: [],
  blocks: [],

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

  addAttempt: (attempt) =>
    set((s) => ({ pendingAttempts: [...s.pendingAttempts, attempt] })),

  finalizeBlockPain: (pain) => {
    const { pendingAttempts, queueIndex } = get();
    const item = get().queue[queueIndex];
    if (!item) return;
    const summary = summarizeAttempts(pendingAttempts);
    const block: MovementBlockResult = {
      side: item.side,
      movement: item.movement,
      pain,
      ...summary,
    };
    set((s) => ({ blocks: [...s.blocks, block], pendingAttempts: [] }));
  },

  advanceQueue: () => set((s) => ({ queueIndex: s.queueIndex + 1 })),

  buildResult: () => {
    const { blocks, intake, demoMode } = get();
    const bySideMovement = (side: Side, movement: Movement) =>
      blocks.find((b) => b.side === side && b.movement === movement)?.averageMaxAngle ?? null;
    const angleBeforeCompByBlock = (side: Side, movement: Movement) => {
      const block = blocks.find((b) => b.side === side && b.movement === movement);
      if (!block) return null;
      const values = block.attempts
        .map((a) => a.angleBeforeCompensation)
        .filter((v): v is number => v !== null);
      if (values.length === 0) return null;
      return values.reduce((a, b) => a + b, 0) / values.length;
    };

    const comparison = {
      flexionMaxAngle: calculateSideDifference(
        bySideMovement("right", "flexion"),
        bySideMovement("left", "flexion")
      ),
      abductionMaxAngle: calculateSideDifference(
        bySideMovement("right", "abduction"),
        bySideMovement("left", "abduction")
      ),
      angleBeforeCompensationFlexion: calculateSideDifference(
        angleBeforeCompByBlock("right", "flexion"),
        angleBeforeCompByBlock("left", "flexion")
      ),
      angleBeforeCompensationAbduction: calculateSideDifference(
        angleBeforeCompByBlock("right", "abduction"),
        angleBeforeCompByBlock("left", "abduction")
      ),
    };

    const result: AssessmentResult = {
      completedAt: Date.now(),
      intake,
      blocks,
      comparison,
      movementIndex: calculateMovementIndex(blocks),
      summary: generateSummary(blocks, comparison),
      isDemo: demoMode,
    };

    set({ result, screen: "results" });
  },

  loadDemoResult: () => {
    set({
      demoMode: true,
      result: buildDemoResult(),
      screen: "results",
    });
  },

  reset: () =>
    set({
      screen: "welcome",
      intake: initialIntake,
      safety: initialSafety,
      calibration: null,
      queueIndex: 0,
      queue: TEST_QUEUE,
      pendingAttempts: [],
      blocks: [],
      result: null,
      demoMode: false,
    }),
}));
