import { getDb } from "@/db/client";
import { Badge, PageHeader, Panel } from "@/components/platform/ui";
import { AddMemberForm } from "@/components/platform/CareForms";
import { listTeam } from "@/lib/server/services/people";
import { getWorkspaceContext } from "@/lib/server/session";
import { ROLE_LABEL, VERIFICATION_LABEL } from "@/lib/care/labels";
import { PROFESSION_LABEL } from "@/lib/care/vocabulary";

export const metadata = { title: "Equipe" };

export default async function TeamPage() {
  const ctx = await getWorkspaceContext();
  const team = await listTeam(await getDb(), ctx);
  return (
    <>
      <PageHeader title="Equipe" subtitle="Papéis definem o que cada pessoa pode fazer; o acesso clínico depende sempre do vínculo com quem é atendido." />
      <div className="space-y-4">
        <Panel>
          <ul className="divide-y divide-moveo-border">
            {team.map((m) => (
              <li key={m.membershipId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-sm text-moveo-muted">
                    {m.email}
                    {m.profession && ` · ${PROFESSION_LABEL[m.profession]}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{ROLE_LABEL[m.role]}</Badge>
                  {m.verificationStatus && <Badge tone={VERIFICATION_LABEL[m.verificationStatus].tone}>{VERIFICATION_LABEL[m.verificationStatus].label}</Badge>}
                  {m.status !== "ativo" && <Badge tone="neutral">removido</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        {ctx.role === "gestor" && (
          <Panel title="Adicionar membro" description="A pessoa precisa ter criado a própria conta no Moveo.">
            <AddMemberForm />
          </Panel>
        )}
        <Panel title="O que cada papel pode fazer">
          <ul className="space-y-2 text-sm text-moveo-muted">
            <li><strong className="text-moveo-ink">Gestor</strong> — equipe, vínculos e configurações do espaço. Acesso clínico apenas às pessoas com quem tem vínculo.</li>
            <li><strong className="text-moveo-ink">Profissional</strong> — avaliações, revisões e devolutivas das pessoas com quem tem vínculo.</li>
            <li><strong className="text-moveo-ink">Assistente</strong> — cadastro de pessoas. Sem acesso a avaliações, medidas ou devolutivas.</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
