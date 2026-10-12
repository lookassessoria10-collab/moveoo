"use client";

import { BrandMark } from "./FlowShell";

/**
 * Barra fixa no topo da tela de câmera, com a marca de quem conduz a
 * avaliação (UORT na avaliação livre; o espaço do profissional no
 * acompanhamento — ver FlowShell). Existe como elemento próprio (fora da
 * caixa de vídeo) para não depender do tamanho real da área "vazia"
 * (letterbox) que aparece quando a proporção do vídeo da câmera do
 * celular não bate exatamente com a caixa 9:16 — ver comentário sobre
 * video.videoWidth/videoHeight em CameraFlow.tsx.
 */
export function CameraTopBar() {
  return (
    <div className="flex flex-none items-center justify-center bg-white py-2.5">
      <BrandMark size="sm" />
    </div>
  );
}
