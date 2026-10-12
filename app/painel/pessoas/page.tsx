import Link from "next/link";
import { getDb } from "@/db/client";
import { Badge, EmptyState, LinkButton, PageHeader, Panel } from "@/components/platform/ui";
import { listPeople } from "@/lib/server/services/people";
import { getWorkspaceContext } from "@/lib/server/session";
import { vocabularyFor } from "@/lib/care/vocabulary";
import { formatDate } from "@/lib/care/labels";

export const metadata = { title: "Pessoas atendidas" };

export default async function PeoplePage() {
  const ctx = await getWorkspaceContext();
  const v = vocabularyFor(ctx.profile?.profession);
  const people = await listPeople(await getDb(), ctx);
  const title = v.persons.charAt(0).toUpperCase() + v.persons.slice(1);

  return (
    <>
      <PageHeader
        title={title}
        subtitle={
          ctx.role === "profissional"
            ? `Somente ${v.persons} com quem você tem vínculo de atendimento.`
            : "Todas as pessoas cadastradas neste espaço. O conteúdo clínico depende de vínculo."
        }
        actions={<LinkButton href="/painel/pessoas/nova">Cadastrar {v.person}</LinkButton>}
      />
      <Panel>
        {people.length === 0 ? (
          <EmptyState title="Ninguém cadastrado ainda.">
            <Link href="/painel/pessoas/nova" className="font-medium text-moveo-primary">
              Cadastrar {v.person}
            </Link>
          </EmptyState>
        ) : (
          <ul className="divide-y divide-moveo-border">
            {people.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-moveo-ink">
                    {p.hasMyRelationship ? (
                      <Link href={`/painel/pessoas/${p.id}`} className="hover:text-moveo-primary">
                        {p.fullName}
                      </Link>
                    ) : (
                      p.fullName
                    )}{" "}
                    {p.isFictitious && <Badge tone="demo">fictício</Badge>}
                  </p>
                  <p className="text-sm text-moveo-muted">
                    {p.professionals.length ? `Acompanhado por ${p.professionals.join(", ")}` : "Sem profissional vinculado"} · cadastro em{" "}
                    {formatDate(p.createdAt, false)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {p.hasMyRelationship ? (
                    <LinkButton href={`/painel/pessoas/${p.id}`} variant="ghost">
                      Abrir
                    </LinkButton>
                  ) : ctx.role === "gestor" ? (
                    <LinkButton href={`/painel/pessoas/${p.id}/vinculos`} variant="ghost">
                      Vínculos
                    </LinkButton>
                  ) : (
                    <Badge>sem vínculo com você</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
