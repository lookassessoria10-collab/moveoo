/**
 * Conexão com o banco.
 *
 * - Com DATABASE_URL (Vercel + Neon, ou qualquer PostgreSQL): driver
 *   node-postgres. As migrações rodam no build (`npm run db:migrate`,
 *   chamado pelo `vercel-build`), não a cada requisição.
 * - Sem DATABASE_URL (computador local): PGlite — PostgreSQL completo em
 *   WebAssembly, dentro do processo do Node, com os dados em `.data/pglite`.
 *   As migrações rodam ao abrir.
 *
 * O schema e as migrações SQL são os mesmos nos dois casos; os serviços
 * não sabem qual driver está por trás.
 *
 * Testes usam `createTestDb()` — PGlite em memória, isolado por arquivo.
 */
import fs from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

type Opened = { db: Db; close: () => Promise<void> };

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "db", "migrations");

async function openPglite(dataDir?: string): Promise<Opened> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  if (dataDir) fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db: db as unknown as Db, close: () => client.close() };
}

export async function openPostgres(url: string): Promise<Opened> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  // Poucas conexões por instância: na Vercel cada função tem a sua (use a URL "pooled" do Neon).
  const pool = new Pool({ connectionString: url, max: 3 });
  const db = drizzle(pool, { schema });
  return { db: db as unknown as Db, close: () => pool.end() };
}

// Uma única conexão por processo: o `next dev` recompila módulos e poderia
// abrir o mesmo diretório do PGlite duas vezes (o que corromperia os dados).
const globalForDb = globalThis as unknown as { __moveoDb?: Promise<Opened> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__moveoDb) {
    const url = process.env.DATABASE_URL;
    if (url) {
      globalForDb.__moveoDb = openPostgres(url);
    } else if (process.env.VERCEL) {
      // Na Vercel o disco é só de leitura: sem banco hospedado não há como funcionar.
      throw new Error("DATABASE_URL não configurada. Crie o banco em Vercel → Storage (Neon) e conecte ao projeto.");
    } else {
      const dir = process.env.MOVEO_DB_DIR ?? path.join(process.cwd(), ".data", "pglite");
      globalForDb.__moveoDb = openPglite(dir);
    }
  }
  return globalForDb.__moveoDb.then((x) => x.db);
}

export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  return openPglite();
}
