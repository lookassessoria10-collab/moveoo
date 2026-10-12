"use client";

import { useState } from "react";
import { HomeLink as Link } from "@/components/shared/FlowShell";
import { ScreenShell } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OptionList } from "@/components/ui/OptionList";
import { useSpineStore } from "../../store";
import { SpineIntakeInfo } from "../../types";

const OPTIONS: { value: SpineIntakeInfo["painArea"]; label: string }[] = [
  { value: "neck", label: "Pescoço" },
  { value: "upperBack", label: "Parte superior das costas" },
  { value: "lowerBack", label: "Região lombar" },
  { value: "multiple", label: "Mais de uma região" },
  { value: "no_pain", label: "Não tenho dor" },
];

export function IntakeAreaScreen() {
  const intake = useSpineStore((s) => s.intake);
  const setIntake = useSpineStore((s) => s.setIntake);
  const setScreen = useSpineStore((s) => s.setScreen);
  const [value, setValue] = useState(intake.painArea);

  return (
    <ScreenShell className="justify-between">
      <div>
        <Link className="text-sm text-moveo-muted">
          ← Voltar
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-moveo-ink">Onde está o incômodo principal?</h1>
        <div className="mt-6">
          <OptionList options={OPTIONS} selected={value} onSelect={setValue} />
        </div>
      </div>
      <Button
        className="mt-8"
        onClick={() => {
          setIntake({ painArea: value });
          setScreen("initialPain");
        }}
      >
        CONTINUAR
      </Button>
    </ScreenShell>
  );
}
