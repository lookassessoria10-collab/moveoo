/**
 * Popula o banco LOCAL com o cenário fictício (db/seed-data.ts).
 *   npm run db:seed    → cria se ainda não existir
 *   npm run db:reset   → apaga .data/pglite e recria do zero
 * Pare o `npm run dev` antes de rodar (o PGlite não aceita dois processos no mesmo diretório).
 */
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./client";
import { DEMO_PASSWORD, isSeeded, seedScenario } from "./seed-data";

async function main() {
  const dir = process.env.MOVEO_DB_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (process.argv.includes("--reset") && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Banco local apagado: ${dir}`);
  }
  const db = await getDb();
  if (await isSeeded(db)) {
    console.log("Cenário fictício já existe. Use `npm run db:reset` para recriar.");
    return;
  }
  await seedScenario(db);
  console.log("Cenário fictício criado. Contas (senha de todas: ver DEMO_PASSWORD em db/seed-data.ts):");
  for (const e of ["admin@moveo.test", "ana.fisio@moveo.test", "bruno.fisio@moveo.test", "carla.recepcao@moveo.test", "diego.ef@moveo.test"]) {
    console.log(`  - ${e}`);
  }
  void DEMO_PASSWORD;
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
