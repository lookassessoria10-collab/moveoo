/**
 * Conexão com o banco.
 *
 * - Com banco hospedado (Supabase ou Neon pela Vercel, ou qualquer
 *   PostgreSQL — ver hostedDatabaseUrl): driver node-postgres. As migrações
 *   rodam no build (`npm run db:migrate`, chamado pelo `vercel-build`), não
 *   a cada requisição.
 * - Sem banco hospedado (computador local): PGlite — PostgreSQL completo em
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

/**
 * Endereço do banco hospedado. Aceita os nomes criados pelas integrações
 * da Vercel: Neon (DATABASE_URL) e Supabase (POSTGRES_URL = pooler).
 * `direct`: migrações preferem a conexão direta, sem pooler.
 */
export function hostedDatabaseUrl(direct = false): string | null {
  const env = process.env;
  const pooled = env.DATABASE_URL || env.POSTGRES_URL || null;
  if (!direct) return pooled;
  return env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || pooled;
}

/**
 * Conexão segura. O certificado do Supabase é assinado pela CA do próprio
 * Supabase (fora da cadeia pública do Node): com DATABASE_SSL_CA (o .crt
 * baixado em Supabase → Database → SSL) a cadeia é verificada; sem ele, a
 * conexão continua criptografada, mas sem verificar a cadeia — aceitável só
 * com dados fictícios. Neon usa certificado público e segue o sslmode da URL.
 */
export function postgresConnection(url: string): { connectionString: string; ssl?: { ca?: string; rejectUnauthorized: boolean } } {
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
  const parsed = new URL(url);
  const isSupabase = /\.supabase\.(co|com)$/.test(parsed.hostname);
  if (!ca && !isSupabase) return { connectionString: url };
  // O sslmode da URL sobrescreveria a configuração abaixo (o pg dá prioridade à URL).
  parsed.searchParams.delete("sslmode");
  return {
    connectionString: parsed.toString(),
    ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
  };
}

export async function openPostgres(url: string): Promise<Opened> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  // Poucas conexões por instância: na Vercel cada função tem a sua (use a URL do pooler).
  const pool = new Pool({ ...postgresConnection(url), max: 3 });
  const db = drizzle(pool, { schema });
  return { db: db as unknown as Db, close: () => pool.end() };
}

// Uma única conexão por processo: o `next dev` recompila módulos e poderia
// abrir o mesmo diretório do PGlite duas vezes (o que corromperia os dados).
const globalForDb = globalThis as unknown as { __moveoDb?: Promise<Opened> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__moveoDb) {
    const url = hostedDatabaseUrl();
    if (url) {
      globalForDb.__moveoDb = openPostgres(url);
    } else if (process.env.VERCEL) {
      // Na Vercel o disco é só de leitura: sem banco hospedado não há como funcionar.
      throw new Error("Banco não configurado. Conecte o Supabase (ou Neon) ao projeto em Vercel → Storage.");
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
