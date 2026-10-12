import { getDb } from "@/db/client";
import { PageHeader, Panel } from "@/components/platform/ui";
import { listAuditEvents } from "@/lib/server/services/admin";
import { requireAdmin } from "@/lib/server/session";
import { formatDate } from "@/lib/care/labels";

export const metadata = { title: "Auditoria" };

export default async function AuditPage() {
  const admin = await requireAdmin();
  const events = await listAuditEvents(await getDb(), admin.id);
  return (
    <>
      <PageHeader title="Trilha de auditoria" subtitle="Últimos 200 eventos. Os registros guardam identificadores, estados e versões — nunca conteúdo clínico." />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="uppercase tracking-wide text-moveo-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">Quando</th>
                <th className="py-2 pr-3 font-medium">Ação</th>
                <th className="py-2 pr-3 font-medium">Autor</th>
                <th className="py-2 pr-3 font-medium">Objeto</th>
                <th className="py-2 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-moveo-border font-mono">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="py-1.5 pr-3 font-sans">{formatDate(e.at)}</td>
                  <td className="py-1.5 pr-3">{e.action}</td>
                  <td className="py-1.5 pr-3">
                    {e.actorType}:{e.actorId?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3">
                    {e.objectType ?? "—"}:{e.objectId?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="py-1.5">{e.metadata ? JSON.stringify(e.metadata) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
