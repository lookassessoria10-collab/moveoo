"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PainScale } from "@/components/PainScale";
import { useSpineStore } from "../../store";
import { PainDuringMovement } from "@/lib/types";

export function PainQuestionScreen() {
  const queueIndex = useSpineStore((s) => s.queueIndex);
  const queue = useSpineStore((s) => s.queue);
  const finalizeBlockPain = useSpineStore((s) => s.finalizeBlockPain);
  const advanceQueue = useSpineStore((s) => s.advanceQueue);
  const setScreen = useSpineStore((s) => s.setScreen);
  const buildResult = useSpineStore((s) => s.buildResult);

  const item = queue[queueIndex];
  const [step, setStep] = useState<"had" | "intensity">("had");
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
          <h2 className="text-xl font-bold text-moveo-ink">Você sentiu dor durante esse movimento?</h2>
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
          <Button className="mt-8" onClick={() => finishBlock({ hadPain: true, intensity })}>
            CONTINUAR
          </Button>
        </>
      )}
    </div>
  );
}
