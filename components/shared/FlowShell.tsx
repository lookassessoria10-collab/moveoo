"use client";

import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";
import { APP_CONFIG } from "@/config/app";
import { Button } from "@/components/ui/Button";

/**
 * Contexto de apresentação dos módulos de avaliação (ombro, joelho,
 * coluna, postura). Os módulos são os mesmos nas duas situações:
 * - avaliação livre (/assessment/*): marca da UORT, botão de demonstração,
 *   "voltar" para a seleção de região;
 * - acompanhamento (convite do profissional): marca do espaço que convidou,
 *   "voltar" para a área da pessoa e demonstração só em espaço fictício.
 */
export interface FlowShell {
  brandName: string;
  logo: string | null;
  homeHref: string;
  allowDemo: boolean;
  /** Modo de validação (?modo=validacao). Nunca dentro do acompanhamento: dados de validação não se misturam com atendimento. */
  allowValidation: boolean;
  /** No acompanhamento: avisa o profissional quando a câmera não pode ser usada. */
  onCameraUnavailable?: () => void;
}

const DEFAULT_SHELL: FlowShell = {
  brandName: APP_CONFIG.name,
  logo: APP_CONFIG.logo,
  homeHref: "/assessment",
  allowDemo: true,
  allowValidation: true,
};

const Ctx = createContext<FlowShell>(DEFAULT_SHELL);

export function FlowShellProvider({ value, children }: { value: Partial<FlowShell>; children: ReactNode }) {
  return <Ctx.Provider value={{ ...DEFAULT_SHELL, ...value }}>{children}</Ctx.Provider>;
}

export function useFlowShell(): FlowShell {
  return useContext(Ctx);
}

/** Link de "voltar ao início" dos módulos: seleção de região ou área da pessoa atendida. */
export function HomeLink({ className, children }: { className?: string; children: ReactNode }) {
  const { homeHref } = useFlowShell();
  return (
    <Link href={homeHref} className={className}>
      {children}
    </Link>
  );
}

/** Alternativas quando a câmera é recusada ou não existe. */
export function CameraFallback({ onDemo }: { onDemo: () => void }) {
  const { allowDemo, onCameraUnavailable } = useFlowShell();
  return (
    <div className="space-y-3 bg-moveo-bg p-5">
      {onCameraUnavailable && (
        <>
          <p className="text-sm text-moveo-ink">
            Não foi possível usar a câmera. Você pode avisar o profissional, que vai indicar outra forma de fazer esta
            avaliação.
          </p>
          <Button onClick={onCameraUnavailable}>Avisar o profissional</Button>
        </>
      )}
      {allowDemo && (
        <Button onClick={onDemo} variant="secondary">
          Continuar em modo demonstração
        </Button>
      )}
    </div>
  );
}

export function BrandMark({ size = "lg" }: { size?: "sm" | "lg" }) {
  const { brandName, logo } = useFlowShell();
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt={brandName} className={size === "lg" ? "h-11 w-auto" : "h-7 w-auto"} />;
  }
  if (size === "sm") return <span className="text-sm font-bold tracking-tight text-moveo-ink">{brandName}</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-moveo-primary text-lg font-bold text-white">
        {brandName.slice(0, 1)}
      </div>
      <span className="text-lg font-bold tracking-tight">{brandName}</span>
    </div>
  );
}
