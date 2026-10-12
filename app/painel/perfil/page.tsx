import { Badge, DefinitionList, Notice, PageHeader, Panel } from "@/components/platform/ui";
import { getWorkspaceContext } from "@/lib/server/session";
import { VERIFICATION_LABEL, formatDate } from "@/lib/care/labels";
import { PROFESSION_LABEL } from "@/lib/care/vocabulary";

export const metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const ctx = await getWorkspaceContext();
  const p = ctx.profile;
  return (
    <>
      <PageHeader title="Meu perfil" subtitle={ctx.userName} />
      <div className="space-y-4">
        {p ? (
          <Panel title="Registro profissional" actions={<Badge tone={VERIFICATION_LABEL[p.verificationStatus].tone}>{VERIFICATION_LABEL[p.verificationStatus].label}</Badge>}>
            <DefinitionList
              items={[
                { term: "Profissão", value: PROFESSION_LABEL[p.profession] },
                { term: "Conselho", value: `${p.council}-${p.councilRegion}` },
                { term: "Número", value: p.registrationNumber },
                { term: "UF de atuação", value: p.jurisdictionUf },
                { term: "Conferido em", value: formatDate(p.verifiedAt) },
                { term: "Fonte da conferência", value: p.verificationSource ?? "—" },
              ]}
            />
            <div className="mt-4">
              {p.verificationStatus === "pendente" && (
                <Notice tone="warn">
                  A conferência é manual: a administração consulta a fonte oficial do conselho e registra fonte, data e
                  responsável. Não existe selo automático. Enquanto isso, use o espaço de demonstração.
                </Notice>
              )}
              {p.verificationStatus === "recusado" && (
                <Notice tone="danger">A verificação foi recusada{p.verificationNote ? `: ${p.verificationNote}` : "."} Fale com o suporte.</Notice>
              )}
            </div>
          </Panel>
        ) : (
          <Panel title="Sem perfil profissional">
            <p className="text-sm text-moveo-muted">Sua conta não tem registro profissional — você atua como assistente ou gestor administrativo.</p>
          </Panel>
        )}
        <Panel title="Segurança da conta">
          <ul className="space-y-1 text-sm text-moveo-muted">
            <li>E-mail: {ctx.emailVerified ? "confirmado" : "não confirmado"}</li>
            <li>Verificação em duas etapas: ainda não disponível (planejada antes do atendimento real).</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
