"use client";

import { useState } from "react";
import { HomeLink as Link } from "@/components/shared/FlowShell";
import { ScreenShell } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OptionList } from "@/components/ui/OptionList";
import { useKneeStore } from "../../store";
import { KneeIntakeInfo } from "../../types";

const OPTIONS: { value: KneeIntakeInfo["symptomSide"]; label: string }[] = [
  { value: "right", label: "Direito" },
  { value: "left", label: "Esquerdo" },
  { value: "both", label: "Os dois" },
  { value: "testing", label: "Estou apenas testando" },
];

export function SymptomSideScreen() {
  const intake = useKneeStore((s) => s.intake);
  const setIntake = useKneeStore((s) => s.setIntake);
  const setScreen = useKneeStore((s) => s.setScreen);
  const [value, setValue] = useState(intake.symptomSide);

  return (
    <ScreenShell className="justify-between">
      <div>
        <Link className="text-sm text-moveo-muted">
          ← Voltar
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-moveo-ink">Qual joelho está incomodando?</h1>
        <p className="mt-2 text-sm text-moveo-muted">
          Essa informação é apenas contexto para o relatório.
        </p>
        <div className="mt-6">
          <OptionList options={OPTIONS} selected={value} onSelect={setValue} />
        </div>
      </div>
      <Button
        className="mt-8"
        onClick={() => {
          setIntake({ symptomSide: value });
          setScreen("initialPain");
        }}
      >
        CONTINUAR
      </Button>
    </ScreenShell>
  );
}
