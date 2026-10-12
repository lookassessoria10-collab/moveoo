import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PLATFORM } from "@/config/platform";

export const metadata: Metadata = {
  title: { default: `${PLATFORM.name} — ${PLATFORM.tagline}`, template: `%s · ${PLATFORM.name}` },
  description: PLATFORM.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#128C90",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-moveo-bg text-moveo-ink antialiased">{children}</body>
    </html>
  );
}
