import { afterEach, describe, expect, it } from "vitest";
import { hostedDatabaseUrl, postgresConnection } from "../client";

const KEYS = ["DATABASE_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_SSL_CA"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function clearEnv() {
  for (const k of KEYS) delete process.env[k];
}

describe("endereço do banco hospedado", () => {
  it("sem variáveis: banco local", () => {
    clearEnv();
    expect(hostedDatabaseUrl()).toBeNull();
    expect(hostedDatabaseUrl(true)).toBeNull();
  });

  it("Supabase pela Vercel: pooler no app, conexão direta nas migrações", () => {
    clearEnv();
    process.env.POSTGRES_URL = "postgres://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require";
    process.env.POSTGRES_URL_NON_POOLING = "postgres://u:p@db.abc.supabase.co:5432/postgres?sslmode=require";
    expect(hostedDatabaseUrl()).toContain(":6543/");
    expect(hostedDatabaseUrl(true)).toContain(":5432/");
  });

  it("Supabase com 'Direct connection' (só IPv6): migrações usam o pooler", () => {
    clearEnv();
    process.env.POSTGRES_URL = "postgres://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";
    process.env.POSTGRES_URL_NON_POOLING = "postgres://postgres:p@db.orcbvhkpseukrjwtomtf.supabase.co:5432/postgres";
    expect(hostedDatabaseUrl(true)).toContain("pooler.supabase.com");
  });

  it("Neon: DATABASE_URL tem prioridade e a direta é DATABASE_URL_UNPOOLED", () => {
    clearEnv();
    process.env.DATABASE_URL = "postgres://u:p@ep-x-pooler.neon.tech/db?sslmode=require";
    process.env.DATABASE_URL_UNPOOLED = "postgres://u:p@ep-x.neon.tech/db?sslmode=require";
    expect(hostedDatabaseUrl()).toContain("pooler.neon.tech");
    expect(hostedDatabaseUrl(true)).toContain("ep-x.neon.tech");
  });
});

describe("conexão segura", () => {
  it("Neon: mantém o sslmode da URL (certificado público)", () => {
    clearEnv();
    const url = "postgres://u:p@ep-x.neon.tech/db?sslmode=require";
    expect(postgresConnection(url)).toEqual({ connectionString: url });
  });

  it("Supabase sem CA: criptografa, tira o sslmode da URL e não verifica a cadeia", () => {
    clearEnv();
    const c = postgresConnection("postgres://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x");
    expect(c.connectionString).not.toContain("sslmode");
    expect(c.connectionString).toContain("supa=base-pooler.x");
    expect(c.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("com DATABASE_SSL_CA: verifica a cadeia com o certificado informado", () => {
    clearEnv();
    process.env.DATABASE_SSL_CA = "-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----";
    const c = postgresConnection("postgres://u:p@db.abc.supabase.co:5432/postgres?sslmode=require");
    expect(c.ssl?.rejectUnauthorized).toBe(true);
    expect(c.ssl?.ca).toContain("\nABC\n");
  });
});
