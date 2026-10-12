"use client";

import { useEffect, useState } from "react";
import { ScreenShell } from "../ui/Card";
import { Button } from "../ui/Button";
import { APP_CONFIG } from "@/config/app";
import { useAssessmentStore } from "@/stores/assessmentStore";
import { BrandMark, useFlowShell } from "@/components/shared/FlowShell";

export function WelcomeScreen() {
  const setScreen = useAssessmentStore((s) => s.setScreen);
  const loadDemoResult = useAssessmentStore((s) => s.loadDemoResult);
  const { allowDemo } = useFlowShell();

  // calculado só após montar no cliente, para evitar divergência entre
  // a renderização no servidor (sem `navigator`) e no navegador
  const [noCameraOnDesktop, setNoCameraOnDesktop] = useState(false);
  useEffect(() => {
    setNoCameraOnDesktop(!navigator.mediaDevices?.getUserMedia);
  }, []);

  return (
    <ScreenShell className="justify-between">
      <div>
        <div className="mb-8 flex items-center">
          <BrandMark />
        </div>

        <h1 className="text-3xl font-bold leading-tight text-moveo-ink">
          Como está o movimento do seu ombro?
        </h1>
        <p className="mt-3 text-base text-moveo-muted">
          Faça uma avaliação funcional em poucos minutos usando apenas a câmera do seu celular.
        </p>

        <ul className="mt-6 space-y-2 text-sm text-moveo-muted">
          <li>• Sem aplicativo para instalar</li>
          <li>• Usa apenas a câmera</li>
          <li>• Leva poucos minutos</li>
        </ul>
      </div>

      <div className="mt-10 space-y-3">
        <Button onClick={() => setScreen("symptomSide")}>INICIAR AVALIAÇÃO</Button>
        {noCameraOnDesktop && allowDemo && (
          <Button variant="secondary" onClick={loadDemoResult}>
            Ver modo demonstração
          </Button>
        )}
        <p className="pt-2 text-center text-xs leading-relaxed text-moveo-muted">
          {APP_CONFIG.copy.disclaimerHome}
        </p>
      </div>
    </ScreenShell>
  );
}
