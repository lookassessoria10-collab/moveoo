"use client";

import { HomeLink as Link } from "@/components/shared/FlowShell";
import { ScreenShell } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { warmUpSpeech } from "@/lib/useSpeech";
import { usePostureStore } from "../../store";

const TIPS = [
  "Apoie o celular de lado em relação ao seu corpo, sem segurar",
  "Sente-se como você costuma sentar para trabalhar — não corrija a postura",
  "Use um ambiente bem iluminado, com o tronco e a cabeça visíveis",
  "Ideal para uso no próprio posto de trabalho",
];

export function IntroScreen() {
  const setScreen = usePostureStore((s) => s.setScreen);

  return (
    <ScreenShell className="justify-between">
      <div>
        <Link className="text-sm text-moveo-muted">
          ← Voltar
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-moveo-ink">Postura sentada</h1>
        <p className="mt-2 text-sm leading-relaxed text-moveo-muted">
          Uma observação rápida da sua postura sentada, pensada para ambientes de trabalho. A câmera
          registra por alguns segundos como você normalmente se senta e descreve o que foi observado —
          não é um diagnóstico médico ou ergonômico.
        </p>
        <ul className="mt-5 space-y-3">
          {TIPS.map((tip) => (
            <li key={tip} className="flex items-start gap-3 text-sm text-moveo-ink">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-moveo-primarySoft text-xs text-moveo-primary">
                ✓
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
      <Button
        className="mt-8"
        onClick={() => {
          warmUpSpeech();
          setScreen("camera");
        }}
      >
        ABRIR CÂMERA
      </Button>
    </ScreenShell>
  );
}
