import { getDb } from "@/db/client";
import { Badge, PageHeader, Panel } from "@/components/platform/ui";
import { listWorkspacesForAdmin } from "@/lib/server/services/admin";
import { requireAdmin } from "@/lib/server/session";
import { WORKSPACE_KIND_LABEL, formatDate } from "@/lib/care/labels";

export const metadata = { title: "Espaços" };

export default async function AdminWorkspacesPage() {
  const admin = await requireAdmin();
  const rows = await listWorkspacesForAdmin(await getDb(), admin.id);
  return (
    <>
      <PageHeader title="Espaços" subtitle="Visão operacional. A administração não acessa conteúdo clínico por esta tela." />
      <Panel>
        <ul className="divide-y divide-moveo-border">
          {rows.map(({ workspace, members }) => (
            <li key={workspace.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span>
                <strong>{workspace.name}</strong>
                <span className="block text-xs text-moveo-muted">
                  {WORKSPACE_KIND_LABEL[workspace.kind]} · {members} membro(s) · criado em {formatDate(workspace.createdAt, false)}
                </span>
              </span>
              <Badge tone={workspace.environment === "real" ? "success" : "demo"}>
                {workspace.environment === "real" ? "Atendimento real" : "Demonstração"}
              </Badge>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
