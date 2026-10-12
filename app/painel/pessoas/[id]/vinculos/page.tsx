import { getDb } from "@/db/client";
import { Badge, PageHeader, Panel } from "@/components/platform/ui";
import { SubmitButton } from "@/components/platform/forms";
import { setRelationshipAction } from "@/app/actions/care";
import { getPersonInWorkspace, requireRole } from "@/lib/server/services/authz";
import { getPersonRelationships, listTeam } from "@/lib/server/services/people";
import { getWorkspaceContext, orNotFound } from "@/lib/server/session";

export const metadata = { title: "Vínculos" };

export default async function RelationshipsPage({ params }: { params: { id: string } }) {
  const ctx = await getWorkspaceContext();
  const db = await getDb();
  await orNotFound(Promise.resolve().then(() => requireRole(ctx, "gestor")));
  const person = await orNotFound(getPersonInWorkspace(db, ctx, params.id));
  const [rels, team] = await Promise.all([getPersonRelationships(db, ctx, person.id), listTeam(db, ctx)]);
  const clinical = team.filter((m) => m.status === "ativo" && m.role !== "assistente" && m.profession);
  return (
    <>
      <PageHeader
        back={{ href: "/painel/pessoas", label: "Pessoas" }}
        title={`Vínculos — ${person.fullName}`}
        subtitle="Só profissionais vinculados acessam avaliações e devolutivas desta pessoa. Gestores sem vínculo veem apenas o cadastro."
      />
      <Panel>
        <ul className="divide-y divide-moveo-border">
          {clinical.map((m) => {
            const active = rels.some((r) => r.userId === m.userId);
            return (
              <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-sm text-moveo-muted">{m.email}</p>
                </div>
                <form action={setRelationshipAction} className="flex items-center gap-2">
                  {active && <Badge tone="success">vinculado</Badge>}
                  <input type="hidden" name="personId" value={person.id} />
                  <input type="hidden" name="professionalUserId" value={m.userId} />
                  <input type="hidden" name="active" value={active ? "0" : "1"} />
                  <SubmitButton variant={active ? "ghost" : "secondary"}>{active ? "Encerrar vínculo" : "Vincular"}</SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
