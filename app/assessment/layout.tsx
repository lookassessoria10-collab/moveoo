import type { Metadata, Viewport } from "next";
import { APP_CONFIG } from "@/config/app";

// Avaliação livre (rotas originais preservadas): mantém a identidade da UORT.
export const metadata: Metadata = {
  title: { absolute: `${APP_CONFIG.name} — Análise de Movimento` },
  description: APP_CONFIG.tagline,
  icons: { icon: "/brand/uort-mark.jpg" },
};

// As telas de câmera dependem de a página não ser ampliada durante o teste.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function AssessmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
