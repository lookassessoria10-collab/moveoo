"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { OptionList } from "../ui/OptionList";
import { PainScale } from "../PainScale";
import { useAssessmentStore } from "@/stores/assessmentStore";
import { PainDuringMovement } from "@/lib/types";

const MOMENT_OPTIONS: { value: NonNullable<PainDuringMovement["moment"]>; label: string }[] = [
  { value: "start", label: "Logo no início" },
  { value: "middle", label: "No meio do movimento" },
  { value: "near_limit", label: "Próximo do limite" },
  { value: "throughout", label: "Durante quase todo o movimento" },
  { value: "unknown", label: "Não sei dizer" },
];

const MOVEMENT_LABEL = { flexion: "flexão", abduction: "elevação lateral" } as const;
const SIDE_LABEL = { right: "direito", left: "esquerdo" } as const;

export function PainQuestionScreen() {
  const queueIndex = useAssessmentStore((s) => s.queueIndex);
  const queue = useAssessmentStore((s) => s.queue);
  const finalizeBlockPain = useAssessmentStore((s) => s.finalizeBlockPain);
  const advanceQueue = useAssessmentStore((s) => s.advanceQueue);
  const setScreen = useAssessmentStore((s) => s.setScreen);
  const buildResult = useAssessmentStore((s) => s.buildResult);

  const item = queue[queueIndex];
  const [step, setStep] = useState<"had" | "intensity" | "moment">("had");
  const [hadPain, setHadPain] = useState<boolean | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [moment, setMoment] = useState<PainDuringMovement["moment"]>("unknown");

  const finishBlock = (pain: PainDuringMovement) => {
    finalizeBlockPain(pain);
    const isLast = queueIndex >= queue.length - 1;
    advanceQueue();
    if (isLast) {
      setScreen("processing");
      setTimeout(() => buildResult(), 1800);
    } else {
      setScreen("test");
    }
  };

  if (!item) return null;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      {step === "had" && (
        <>
          <h2 className="text-xl font-bold text-moveo-ink">
            Você sentiu dor durante esse movimento?
          </h2>
          <p className="mt-1 text-sm text-moveo-muted">
            {MOVEMENT_LABEL[item.movement]} — lado {SIDE_LABEL[item.side]}
          </p>
          <div className="mt-6 flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setHadPain(false);
                finishBlock({ hadPain: false });
              }}
            >
              Não
            </Button>
            <Button
              onClick={() => {
                setHadPain(true);
                setStep("intensity");
              }}
            >
              Sim
            </Button>
          </div>
        </>
      )}

      {step === "intensity" && (
        <>
          <h2 className="text-xl font-bold text-moveo-ink">Quanto?</h2>
          <div className="mt-8">
            <PainScale value={intensity} onChange={setIntensity} />
          </div>
          <Button className="mt-8" onClick={() => setStep("moment")}>
            CONTINUAR
          </Button>
        </>
      )}

      {step === "moment" && (
        <>
          <h2 className="text-xl font-bold text-moveo-ink">
            Em que momento incomodou mais?
          </h2>
          <div className="mt-6">
            <OptionList options={MOMENT_OPTIONS} selected={moment} onSelect={setMoment} />
          </div>
          <Button
            className="mt-8"
            onClick={() => finishBlock({ hadPain: true, intensity, moment })}
          >
            CONTINUAR
          </Button>
        </>
      )}
    </div>
  );
}
