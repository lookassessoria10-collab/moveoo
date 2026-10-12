/**
 * Simula o Supabase: os papéis da API pública (anon, authenticated) recebem
 * acesso às tabelas de `public`, como o Supabase faz por padrão. Depois da
 * proteção, esses papéis não leem nada; o dono das tabelas (o servidor)
 * continua lendo normalmente.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb, type Db } from "../client";
import { seedScenario } from "../seed-data";
import { hardenHostedDatabase } from "../harden";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedScenario(db, "senha-de-teste-123");
  for (const stmt of [
    "CREATE ROLE anon NOLOGIN",
    "CREATE ROLE authenticated NOLOGIN",
    "CREATE ROLE leitor_qualquer NOLOGIN",
    "GRANT USAGE ON SCHEMA public TO anon, authenticated, leitor_qualquer",
    "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, leitor_qualquer",
  ]) {
    await db.execute(sql.raw(stmt));
  }
  await hardenHostedDatabase(db);
});

afterAll(async () => {
  await close();
});

async function asRole<T>(role: string, query: string): Promise<{ rows?: T[]; error?: string }> {
  try {
    await db.execute(sql.raw(`SET ROLE ${role}`));
    const r = (await db.execute(sql.raw(query))) as unknown as { rows: T[] };
    return { rows: r.rows };
  } catch (e) {
    // O Drizzle embrulha o erro do Postgres em "Failed query"; a mensagem real fica em `cause`.
    const cause = (e as { cause?: { message?: string } }).cause?.message;
    return { error: cause ?? (e instanceof Error ? e.message : String(e)) };
  } finally {
    await db.execute(sql.raw("RESET ROLE"));
  }
}

describe("proteção do banco hospedado", () => {
  it("liga RLS em todas as tabelas do esquema public", async () => {
    const r = (await db.execute(
      sql.raw(`SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relkind = 'r'`)
    )) as unknown as { rows: { relname: string; relrowsecurity: boolean }[] };
    expect(r.rows.length).toBeGreaterThan(15);
    expect(r.rows.filter((t) => !t.relrowsecurity)).toEqual([]);
  });

  it("papéis da API pública (anon, authenticated) perdem o acesso às tabelas", async () => {
    for (const role of ["anon", "authenticated"]) {
      const r = await asRole(role, "SELECT id FROM users");
      expect(r.error).toMatch(/permission denied/i);
    }
  });

  it("mesmo com permissão de leitura, RLS sem política não devolve nenhuma linha", async () => {
    const r = await asRole<{ id: string }>("leitor_qualquer", "SELECT id FROM users");
    expect(r.error).toBeUndefined();
    expect(r.rows).toEqual([]);
  });

  it("o servidor (dono das tabelas) continua lendo normalmente", async () => {
    const r = (await db.execute(sql.raw("SELECT count(*)::int AS n FROM users"))) as unknown as { rows: { n: number }[] };
    expect(r.rows[0].n).toBe(5);
  });

  it("pode rodar de novo a cada deploy sem erro", async () => {
    await expect(hardenHostedDatabase(db)).resolves.toBeUndefined();
  });
});
