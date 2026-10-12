import { getDb } from "@/db/client";
import { exportUsersCsv, parseUserFilters } from "@/lib/server/services/adminUsers";
import { requireAdmin } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Planilha dos usuários com os mesmos filtros da lista. Fica registrada na auditoria. */
export async function GET(request: Request) {
  const admin = await requireAdmin();
  const filters = parseUserFilters(Object.fromEntries(new URL(request.url).searchParams));
  const csv = await exportUsersCsv(await getDb(), admin.id, filters);
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // aaaa-mm-dd
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="moveo-usuarios-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
