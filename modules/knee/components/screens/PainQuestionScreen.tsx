"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { OptionList } from "@/components/ui/OptionList";
import { PainScale } from "@/components/PainScale";
import { useKneeStore } from "../../store";
import { PainDuringMovement } from "@/lib/types";

const MOMENT_OPTIONS: { value: NonNullable<PainDuringMovement["moment"]>; label: string }[] = [
  { value: "start", label: "No início" },
  { value: "descent", label: "Durante a descida" },
  { value: "bottom", label: "No ponto mais baixo" },
  { value: "ascent", label: "Durante a subida" },
  { value: "return", label: "Ao retornar" },
  { value: "throughout", label: "Durante quase todo o movimento" },
];

export function PainQuestionScreen() {
  const queueIndex = useKneeStore((s) => s.queueIndex);
  const queue = useKneeStore((s) => s.queue);
  const finalizeBlockPain = useKneeStore((s) => s.finalizeBlockPain);
  const advanceQueue = useKneeStore((s) => s.advanceQueue);
  const setScreen = useKneeStore((s) => s.setScreen);
  const buildResult = useKneeStore((s) => s.buildResult);

  const item = queue[queueIndex];
  const [step, setStep] = useState<"had" | "intensity" | "moment">("had");
  const [intensity, setIntensity] = useState(5);

  const finishBlock = (pain: PainDuringMovement) => {
    finalizeBlockPain(pain);
    const isLast = queueIndex >= queue.length - 1;
    advanceQueue();
    if (isLast) {
      setScreen("processing");
      setTimeout(() => buildResult(), 1800);
    } else {
      setScreen("reposition");
    }
  };

  if (!item) return null;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      {step === "had" && (
        <>
          <h2 className="text-xl font-bold text-moveo-ink">Você sentiu dor durante esse teste?</h2>
          <p className="mt-1 text-sm text-moveo-muted">{item.title}</p>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => finishBlock({ hadPain: false })}>
              Não
            </Button>
            <Button onClick={() => setStep("intensity")}>Sim</Button>
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
          <h2 className="text-xl font-bold text-moveo-ink">Quando incomodou mais?</h2>
          <div className="mt-6">
            <OptionList
              options={MOMENT_OPTIONS}
              onSelect={(moment) => finishBlock({ hadPain: true, intensity, moment })}
            />
          </div>
        </>
      )}
    </div>
  );
}
