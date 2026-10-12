/**
 * Proteção do banco hospedado, aplicada a cada deploy (db/migrate.ts).
 *
 * No Supabase, tabelas do esquema `public` ficam expostas pela API REST
 * do próprio Supabase (PostgREST) para quem tiver a chave pública
 * ("publishable"/anon) — a menos que a segurança por linha (RLS) esteja
 * ligada. A plataforma NÃO usa essa API: o servidor conecta direto no
 * Postgres como dono das tabelas (o dono não é afetado pelo RLS).
 *
 * Então, para toda tabela de `public` (inclusive as criadas no futuro):
 * - liga RLS sem nenhuma política → os papéis da API (anon, authenticated)
 *   não leem nem gravam nenhuma linha;
 * - revoga os privilégios desses papéis, quando existem (só no Supabase).
 *
 * Em outros Postgres (Neon, PGlite) os papéis não existem e o RLS ligado
 * não muda nada para o dono das tabelas.
 */
import { sql } from "drizzle-orm";
import type { Db } from "./client";

export const HARDEN_SQL = sql.raw(`
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
  END IF;
END $$;
`);

export async function hardenHostedDatabase(db: Db): Promise<void> {
  await db.execute(HARDEN_SQL);
}
