import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Minhas atividades", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function PersonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
