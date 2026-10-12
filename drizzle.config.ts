import { defineConfig } from "drizzle-kit";

// Gera migrações SQL a partir de db/schema.ts (npm run db:generate).
// As migrações são aplicadas automaticamente na primeira conexão (db/client.ts).
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
});
