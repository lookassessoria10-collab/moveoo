/**
 * Conexão com o banco.
 *
 * Desenvolvimento local: PGlite (PostgreSQL completo compilado para
 * WebAssembly, rodando dentro do processo do Node) com os dados em
 * `.data/pglite` — não exige Docker nem instalação do Postgres. O mesmo
 * schema e as mesmas migrações SQL servem para um PostgreSQL hospedado
 * (Neon, Supabase, RDS…) quando o projeto sair do ambiente local: basta
 * trocar o driver aqui (drizzle-orm/node-postgres), sem mudar os serviços.
 *
 * Testes usam `createTestDb()` — banco em memória, isolado por teste.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteQueryResultHKT } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgliteQueryResultHKT, typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "db", "migrations");

async function open(dataDir?: string): Promise<{ db: Db; client: PGlite }> {
  if (dataDir) fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzle(client, { schema }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, client };
}

// Um único PGlite por processo: o `next dev` recompila módulos e poderia
// abrir o mesmo diretório duas vezes (o que corromperia os dados).
const globalForDb = globalThis as unknown as { __moveoDb?: Promise<{ db: Db; client: PGlite }> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__moveoDb) {
    const dir = process.env.MOVEO_DB_DIR ?? path.join(process.cwd(), ".data", "pglite");
    globalForDb.__moveoDb = open(dir);
  }
  return globalForDb.__moveoDb.then((x) => x.db);
}

export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const { db, client } = await open();
  return { db, close: () => client.close() };
}
