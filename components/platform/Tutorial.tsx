"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { markTutorialSeenAction } from "@/app/actions/auth";
import { buildTutorialSteps, type TutorialInfo, type TutorialStep } from "./tutorialSteps";
import { buttonClass } from "./ui";

/**
 * Tutorial de boas-vindas do painel: sequência de pop-ups (diálogo modal)
 * que explica o ciclo principal e destaca no menu onde fica cada coisa.
 *
 * - Abre sozinho em "Hoje" enquanto `users.tutorial_seen_at` for nulo
 *   (contas novas). Concluir, pular ou fechar grava a data.
 * - Reabre a qualquer momento pelo botão "Como funciona" (TutorialButton).
 * - O destaque é um recorte no escurecimento em volta do elemento marcado
 *   com `data-tour`; em telas largas o pop-up fica ao lado dele, em telas
 *   estreitas vira uma folha presa à parte de baixo da tela.
 */

const OpenTutorialContext = createContext<(() => void) | null>(null);

export function TutorialProvider({ info, autoOpen, children }: { info: TutorialInfo; autoOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(autoOpen);
  const pathname = usePathname();
  const router = useRouter();
  const steps = useMemo(() => buildTutorialSteps(info), [info]);

  // Só abre sozinho em "Hoje", para não interromper quem chega por um link direto.
  useEffect(() => {
    if (unseen && pathname === "/painel") setOpen(true);
  }, [unseen, pathname]);

  const openTutorial = useCallback(() => setOpen(true), []);

  const close = useCallback(
    async (href?: string) => {
      setOpen(false);
      if (unseen) {
        setUnseen(false);
        try {
          await markTutorialSeenAction();
        } catch {
          // Sem conexão: o tutorial volta a abrir na próxima visita, sem prejuízo.
        }
      }
      if (href) router.push(href);
    },
    [unseen, router]
  );

  return (
    <OpenTutorialContext.Provider value={openTutorial}>
      {children}
      {open && <TutorialDialog steps={steps} onClose={close} />}
    </OpenTutorialContext.Provider>
  );
}

export function TutorialButton({ className = "" }: { className?: string }) {
  const open = useContext(OpenTutorialContext);
  return (
    <button
      type="button"
      data-tour="tutorial"
      onClick={() => open?.()}
      className={`inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-moveo-primary hover:text-moveo-primaryDark ${className}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" />
        <path d="M12 17.2h.01" />
      </svg>
      Como funciona
    </button>
  );
}

// ---------------------------------------------------------------------------

type Box = { top: number; left: number; width: number; height: number };

const GAP = 16; // distância entre o pop-up, o destaque e as bordas da tela
const PAD = 6; // folga do destaque em volta do elemento
const WIDE = 1024; // a partir daqui o menu é a barra lateral (lg do Tailwind)
const DIM = "rgba(16, 34, 43, 0.62)";

/** Primeiro elemento visível com o `data-tour` pedido (o menu muda entre celular e computador). */
function findTarget(id?: string): HTMLElement | null {
  if (!id) return null;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function TutorialDialog({ steps, onClose }: { steps: TutorialStep[]; onClose: (href?: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const finished = useRef(false);
  const titleId = useId();
  const bodyId = useId();
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [beside, setBeside] = useState<{ top: number; left: number; arrow: number } | null>(null);

  const step = steps[index];
  const last = index === steps.length - 1;

  const finish = useCallback(
    (href?: string) => {
      if (finished.current) return;
      finished.current = true;
      onClose(href);
    },
    [onClose]
  );

  // Modal de verdade: o resto da página fica inerte e a rolagem do fundo, travada.
  // (Sem dialog.close() na limpeza: no StrictMode o efeito roda duas vezes.)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    primaryRef.current?.focus();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  // Botão trocado (último passo, "Voltar" que some no primeiro): o foco não fica perdido.
  useEffect(() => {
    if (!dialogRef.current?.contains(document.activeElement)) primaryRef.current?.focus();
  }, [index]);

  // Elemento destacado: rolado para a vista e medido de novo quando a tela muda de tamanho.
  useLayoutEffect(() => {
    findTarget(step.target)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    const measure = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      const r = findTarget(step.target)?.getBoundingClientRect();
      setTarget(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step.target]);

  // Telas largas: pop-up ao lado do item destacado na barra lateral, com uma seta apontando para ele.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !target || viewport.w < WIDE) return setBeside(null);
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const left = target.left + target.width + PAD + GAP;
    if (left + w + GAP > viewport.w) return setBeside(null);
    const center = target.top + target.height / 2;
    const top = Math.min(Math.max(center - h / 2, GAP), Math.max(GAP, viewport.h - h - GAP));
    setBeside({ top, left, arrow: Math.min(Math.max(center - top, 28), h - 28) });
  }, [target, viewport, index]);

  const hole: Box = target
    ? { top: target.top - PAD, left: target.left - PAD, width: target.width + PAD * 2, height: target.height + PAD * 2 }
    : { top: viewport.h / 2, left: viewport.w / 2, width: 0, height: 0 };

  // Telas estreitas com destaque: a folha não sobe por cima do item destacado (se sobrar espaço razoável).
  const roomBelow = target ? viewport.h - (hole.top + hole.height) - GAP : 0;
  const sheetMaxHeight = target && !beside && roomBelow >= 300 ? roomBelow : undefined;

  const go = (n: number) => setIndex(Math.min(Math.max(n, 0), steps.length - 1));

  const cardPosition = beside
    ? "w-[26rem] rounded-3xl"
    : target
      ? "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2 sm:rounded-3xl"
      : "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-3xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-3rem)] sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(e) => {
        e.preventDefault();
        finish();
      }}
      onClose={() => finish()}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-moveo-ink backdrop:bg-transparent"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed rounded-xl motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out"
        style={{
          ...hole,
          boxShadow: target
            ? `0 0 0 3px #fff, 0 0 0 6px #128C90, 0 0 0 200vmax ${DIM}`
            : `0 0 0 0 transparent, 0 0 0 0 transparent, 0 0 0 200vmax ${DIM}`,
        }}
      />

      <div
        ref={cardRef}
        className={`absolute flex flex-col bg-white shadow-2xl ring-1 ring-black/5 ${cardPosition}`}
        style={beside ? { top: beside.top, left: beside.left, maxHeight: viewport.h - GAP * 2 } : { maxHeight: sheetMaxHeight }}
      >
        {beside && (
          <span aria-hidden className="absolute -left-2 h-4 w-4 rotate-45 rounded-sm bg-white" style={{ top: beside.arrow - 8 }} />
        )}

        <div className="flex items-center gap-3 px-5 pt-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-moveo-muted">
              Passo {index + 1} de {steps.length}
            </p>
            <div className="mt-1.5 flex gap-1" aria-hidden>
              {steps.map((s, n) => (
                <span
                  key={s.id}
                  className={`h-1.5 flex-1 rounded-full motion-safe:transition-colors ${n <= index ? "bg-moveo-primary" : "bg-moveo-border"}`}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => finish()}
            aria-label="Fechar tutorial"
            className="-mr-1.5 flex h-9 w-9 flex-none items-center justify-center rounded-full text-moveo-muted hover:bg-moveo-bg hover:text-moveo-ink"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div key={step.id} className="tutorial-step min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-4">
          <h2 id={titleId} className="text-lg font-bold leading-snug tracking-tight text-moveo-ink">
            {step.title}
          </h2>
          <div id={bodyId} className="mt-2 space-y-2 text-sm leading-relaxed text-moveo-muted [&_strong]:font-semibold [&_strong]:text-moveo-ink">
            {step.body}
          </div>
          {step.visual && <div className="mt-4 rounded-2xl bg-moveo-bg p-3">{step.visual}</div>}
        </div>

        <p className="sr-only" aria-live="polite">
          Passo {index + 1} de {steps.length}: {step.title}
        </p>

        <div className="border-t border-moveo-border px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          {last ? (
            <div key="fim" className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <button type="button" onClick={() => go(index - 1)} className="text-sm font-medium text-moveo-muted hover:text-moveo-ink sm:mr-auto">
                Voltar
              </button>
              <button type="button" onClick={() => finish()} className={buttonClass("ghost")}>
                Explorar sozinho
              </button>
              {step.cta && (
                <button ref={primaryRef} type="button" onClick={() => finish(step.cta!.href)} className={buttonClass("primary")}>
                  {step.cta.label}
                </button>
              )}
            </div>
          ) : (
            <div key="passos" className="flex items-center gap-2">
              {index === 0 ? (
                <button type="button" onClick={() => finish()} className="text-sm font-medium text-moveo-muted hover:text-moveo-ink">
                  Pular tutorial
                </button>
              ) : (
                <button type="button" onClick={() => go(index - 1)} className={buttonClass("ghost")}>
                  Voltar
                </button>
              )}
              <button ref={primaryRef} type="button" onClick={() => go(index + 1)} className={buttonClass("primary", "ml-auto")}>
                {index === 0 ? "Começar" : "Próximo"}
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
