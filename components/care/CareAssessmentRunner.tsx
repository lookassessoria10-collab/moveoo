"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FlowShellProvider } from "@/components/shared/FlowShell";
import { Button } from "@/components/ui/Button";
import { ScreenShell } from "@/components/ui/Card";
import { AssessmentFlow } from "@/components/AssessmentFlow";
import { KneeFlow } from "@/modules/knee/KneeFlow";
import { SpineFlow } from "@/modules/spine/SpineFlow";
import { PostureFlow } from "@/modules/posture/PostureFlow";
import { useAssessmentStore } from "@/stores/assessmentStore";
import { useKneeStore } from "@/modules/knee/store";
import { useSpineStore } from "@/modules/spine/store";
import { usePostureStore } from "@/modules/posture/store";
import type { Region } from "@/lib/care/protocols";

/**
 * Executa um módulo de avaliação existente dentro do acompanhamento.
 *
 * Os módulos continuam iguais; este componente só:
 * - reinicia a store do módulo (nada de estado de uma avaliação anterior);
 * - registra o início no servidor;
 * - troca a tela de resultado do módulo por "enviar ao profissional"
 *   (a pessoa não recebe números provisórios — quem publica é o profissional);
 * - registra interrupções (saída da página, câmera indisponível,
 *   perguntas de segurança, interrupção voluntária).
 */

type AnyStore = {
  getState: () => { screen: string; result: unknown; reset: () => void };
  subscribe: (fn: (s: { screen: string; result: unknown }) => void) => () => void;
};

const MODULES: Record<Region, { Flow: () => JSX.Element; store: AnyStore }> = {
  shoulder: { Flow: AssessmentFlow, store: useAssessmentStore as unknown as AnyStore },
  knee: { Flow: KneeFlow, store: useKneeStore as unknown as AnyStore },
  spine: { Flow: SpineFlow, store: useSpineStore as unknown as AnyStore },
  posture: { Flow: PostureFlow, store: usePostureStore as unknown as AnyStore },
};

const RESULT_SCREENS = new Set(["results", "technicalReport", "doctorReport"]);

/** Remove quadros e pontos do corpo antes de enviar (o servidor também descarta). */
function stripFrames(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripFrames);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => k !== "frames")
        .map(([k, v]) => [k, stripFrames(v)])
    );
  }
  return value;
}

type Phase =
  | { kind: "running" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string }
  | { kind: "stopped"; reason: "camera_indisponivel" | "perguntas_de_seguranca" | "pessoa_interrompeu" };

export function CareAssessmentRunner({
  requestId,
  region,
  brandName,
  logo,
  allowDemo,
  professionalName,
}: {
  requestId: string;
  region: Region;
  brandName: string;
  logo: string | null;
  allowDemo: boolean;
  professionalName: string;
}) {
  const router = useRouter();
  const { Flow, store } = MODULES[region];
  const [phase, setPhase] = useState<Phase>({ kind: "running" });
  const [ready, setReady] = useState(false);
  const keyRef = useRef<string>("");
  const doneRef = useRef(false);
  const videoDimsRef = useRef<{ videoWidth: number | null; videoHeight: number | null }>({ videoWidth: null, videoHeight: null });

  const api = useCallback(
    (path: string, body: unknown) =>
      fetch(`/api/acompanhamento/${requestId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    [requestId]
  );

  const device = () => ({ userAgent: navigator.userAgent.slice(0, 400), ...videoDimsRef.current });

  // Início: store limpa + sessão registrada no servidor (uma vez, mesmo no StrictMode).
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    store.getState().reset();
    keyRef.current = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    api("iniciar", { idempotencyKey: keyRef.current, device: device() })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setPhase({ kind: "error", message: j.error ?? "Não foi possível iniciar a atividade." });
          doneRef.current = true;
        }
        setReady(true);
      })
      .catch(() => {
        setPhase({ kind: "error", message: "Sem conexão. Verifique a internet e tente de novo." });
        setReady(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dimensões reais do vídeo (registradas com o resultado para reprocessamento futuro).
  useEffect(() => {
    const t = setInterval(() => {
      const v = document.querySelector("video");
      if (v && v.videoWidth) videoDimsRef.current = { videoWidth: v.videoWidth, videoHeight: v.videoHeight };
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const interrupt = useCallback(
    async (reason: "camera_indisponivel" | "perguntas_de_seguranca" | "pessoa_interrompeu") => {
      if (doneRef.current) return;
      doneRef.current = true;
      setPhase({ kind: "stopped", reason });
      await api("interromper", { idempotencyKey: keyRef.current, reason }).catch(() => {});
    },
    [api]
  );

  const submit = useCallback(
    async (result: unknown) => {
      setPhase({ kind: "sending" });
      try {
        const r = await api("resultado", { idempotencyKey: keyRef.current, result: stripFrames(result), device: device() });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          setPhase({ kind: "error", message: j.error ?? "Não foi possível enviar." });
          return;
        }
        doneRef.current = true;
        setPhase({ kind: "sent" });
      } catch {
        setPhase({ kind: "error", message: "Sem conexão. Seus dados ainda estão neste aparelho: tente enviar de novo." });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api]
  );

  // Observa o módulo: resultado pronto → envia; bloqueio de segurança → interrompe.
  useEffect(() => {
    const check = (s: { screen: string; result: unknown }) => {
      if (doneRef.current) return;
      if (RESULT_SCREENS.has(s.screen) && s.result) {
        doneRef.current = true; // evita envio duplo; o reenvio manual usa a mesma chave
        void submit(s.result);
      } else if (s.screen === "safetyBlocked") {
        void interrupt("perguntas_de_seguranca");
      }
    };
    return store.subscribe(check);
  }, [store, submit, interrupt]);

  // Saída da página (ou navegação interna) sem concluir. O adiamento evita
  // falso "saiu" na desmontagem/remontagem simulada do StrictMode.
  const aliveRef = useRef(false);
  useEffect(() => {
    aliveRef.current = true;
    const onHide = () => {
      if (doneRef.current || !keyRef.current) return;
      const blob = new Blob([JSON.stringify({ idempotencyKey: keyRef.current, reason: "saiu_da_pagina" })], { type: "application/json" });
      navigator.sendBeacon(`/api/acompanhamento/${requestId}/interromper`, blob);
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      aliveRef.current = false;
      window.removeEventListener("pagehide", onHide);
      setTimeout(() => {
        if (!aliveRef.current) onHide();
      }, 0);
    };
  }, [requestId]);

  if (phase.kind !== "running") {
    const retry = phase.kind === "error" && !!store.getState().result;
    return (
      <ScreenShell className="justify-center text-center">
        {phase.kind === "sending" && (
          <>
            <div className="mx-auto mb-6 h-14 w-14 animate-spin rounded-full border-4 border-moveo-primary border-t-transparent" />
            <h1 className="text-xl font-bold">Enviando para {professionalName}…</h1>
          </>
        )}
        {phase.kind === "sent" && (
          <>
            <h1 className="text-2xl font-bold">Pronto, enviado!</h1>
            <p className="mt-3 text-moveo-muted">
              {professionalName} vai revisar o resultado e publicar um retorno para você. Você verá aqui quando estiver pronto.
            </p>
          </>
        )}
        {phase.kind === "stopped" && (
          <>
            <h1 className="text-2xl font-bold">Atividade interrompida</h1>
            <p className="mt-3 text-moveo-muted">
              {phase.reason === "perguntas_de_seguranca"
                ? `Pelas suas respostas, é melhor não fazer esta atividade agora. ${professionalName} foi avisado(a). Se tiver dor forte ou sintomas novos, procure atendimento.`
                : phase.reason === "camera_indisponivel"
                  ? `${professionalName} foi avisado(a) de que a câmera não pôde ser usada e vai indicar outra forma de avaliação.`
                  : `Tudo bem. ${professionalName} foi avisado(a). Você pode recomeçar depois pelo mesmo link enquanto ele estiver válido.`}
            </p>
          </>
        )}
        {phase.kind === "error" && (
          <>
            <h1 className="text-2xl font-bold">Não foi possível continuar</h1>
            <p className="mt-3 text-moveo-muted">{phase.message}</p>
          </>
        )}
        <div className="mt-8 space-y-3">
          {retry && <Button onClick={() => submit(store.getState().result)}>Tentar enviar de novo</Button>}
          {phase.kind !== "sending" && (
            <Button variant="secondary" onClick={() => router.push("/acompanhamento")}>
              Voltar às minhas atividades
            </Button>
          )}
        </div>
      </ScreenShell>
    );
  }

  if (!ready) {
    return (
      <ScreenShell className="items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-moveo-primary border-t-transparent" />
      </ScreenShell>
    );
  }

  return (
    <FlowShellProvider
      value={{
        brandName,
        logo,
        homeHref: "/acompanhamento",
        allowDemo,
        allowValidation: false,
        onCameraUnavailable: () => void interrupt("camera_indisponivel"),
      }}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => void interrupt("pessoa_interrompeu")}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-moveo-danger shadow-lg ring-1 ring-moveo-border"
        >
          Interromper
        </button>
        <Flow />
      </div>
    </FlowShellProvider>
  );
}
