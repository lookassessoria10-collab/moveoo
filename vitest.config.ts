import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // "server-only" lança erro fora do React Server; nos testes vira um módulo vazio.
      "server-only": path.resolve(__dirname, "test/empty.ts"),
    },
  },
  test: {
    environment: "node",
    // Testes de plataforma sobem um PostgreSQL (PGlite) em memória por arquivo.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
