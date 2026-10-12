/**
 * Prepara o banco hospedado (roda no build da Vercel via `vercel-build`).
 *
 * - Sem banco hospedado: não faz nada (o banco local migra sozinho ao abrir).
 * - Com banco hospedado (DATABASE_URL do Neon ou POSTGRES_URL do Supabase):
 *   aplica as migrações SQL de db/migrations pela conexão direta.
 * - Com MOVEO_SEED_DEMO=1: cria o cenário FICTÍCIO (db/seed-data.ts) se
 *   ainda não existir, com a senha definida em MOVEO_DEMO_PASSWORD. A
 *   senha local do repositório nunca é usada num banco acessível pela
 *   internet.
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { hostedDatabaseUrl, MIGRATIONS_FOLDER, openPostgres } from "./client";
import { hardenHostedDatabase } from "./harden";
import { isSeeded, seedScenario } from "./seed-data";

async function main() {
  // Conexão direta (sem pooler) quando a integração fornece uma.
  const url = hostedDatabaseUrl(true);
  if (!url) {
    console.log("[db:migrate] Sem banco hospedado — nada a fazer (o banco local migra ao abrir).");
    return;
  }
  const { db, close } = await openPostgres(url);
  try {
    await migrate(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("[db:migrate] Migrações aplicadas.");
    await hardenHostedDatabase(db);
    console.log("[db:migrate] Proteção das tabelas aplicada (RLS ligado; API pública sem acesso).");

    if (process.env.MOVEO_SEED_DEMO === "1") {
      if (await isSeeded(db)) {
        console.log("[db:migrate] Cenário fictício já existe.");
      } else {
        const password = process.env.MOVEO_DEMO_PASSWORD ?? "";
        if (password.length < 10) {
          throw new Error("Defina MOVEO_DEMO_PASSWORD (mínimo de 10 caracteres) para criar as contas fictícias no banco hospedado.");
        }
        await seedScenario(db, password);
        console.log("[db:migrate] Cenário fictício criado.");
      }
    }
  } finally {
    await close();
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("[db:migrate] Falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
