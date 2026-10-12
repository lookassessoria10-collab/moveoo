import { getDb } from "@/db/client";
import { Badge, Notice, PageHeader, Panel } from "@/components/platform/ui";
import {
  AccountForm,
  AdminActionButton,
  DeactivateForm,
  DeleteUserForm,
  NoteForm,
  ProfileForm,
  TagChip,
  TagForm,
  VerificationForm,
} from "@/components/platform/AdminForms";
import { confirmEmailAction, deleteNoteAction, reactivateUserAction, setAdminAction, unlockUserAction } from "@/app/actions/admin";
import { accountSituation, getUserDetail, listTags } from "@/lib/server/services/adminUsers";
import { orNotFound, requireAdmin } from "@/lib/server/session";
import { ROLE_LABEL, VERIFICATION_LABEL, WORKSPACE_KIND_LABEL, formatDate } from "@/lib/care/labels";

export const metadata = { title: "Usuário" };

/** Rótulos dos eventos de auditoria mais comuns numa ficha; os demais aparecem pelo código. */
const EVENT_LABEL: Record<string, string> = {
  "conta.criada": "Conta criada",
  "acesso.entrada": "Entrou na plataforma",
  "conta.email_confirmado": "Confirmou o e-mail",
  "conta.senha_redefinida": "Redefiniu a senha",
  "verificacao.decidida": "Verificação do registro decidida",
  "espaco.criado": "Criou um espaço",
  "espaco.configuracao_alterada": "Alterou a configuração do espaço",
  "equipe.membro_definido": "Alterou a equipe",
  "pessoa.cadastrada": "Cadastrou uma pessoa atendida",
  "pessoa.prontuario_acessado": "Abriu a ficha de uma pessoa atendida",
  "convite.criado": "Enviou um convite de avaliação",
  "convite.revogado": "Revogou um convite",
  "avaliacao.medidas_revisadas": "Revisou medidas",
  "avaliacao.cancelada": "Cancelou uma avaliação",
  "medicao_presencial.registrada": "Registrou uma medição presencial",
  "usuario.editado": "Conta editada",
  "usuario.registro_editado": "Registro profissional editado",
  "usuario.registro_criado": "Registro profissional criado",
  "usuario.email_confirmado_pela_administracao": "E-mail confirmado",
  "usuario.acesso_destravado": "Acesso destravado",
  "usuario.administracao_concedida": "Recebeu acesso de administração",
  "usuario.administracao_removida": "Perdeu o acesso de administração",
  "usuario.desativado": "Conta desativada",
  "usuario.reativado": "Conta reativada",
};

const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function AdminUserPage({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const db = await getDb();
  const d = await orNotFound(getUserDetail(db, admin.id, params.id));
  const allTags = await listTags(db, admin.id);
  const { user, profile, activity } = d;
  const situation = accountSituation(user);
  const isSelf = user.id === admin.id;
  const userId = user.id;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/usuarios", label: "Usuários" }}
        title={user.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{user.email}</span>
            {user.isPlatformAdmin && <Badge tone="info">administração</Badge>}
            {situation === "desativada" && <Badge tone="danger">desativada</Badge>}
            {situation === "travada" && <Badge tone="warn">travada</Badge>}
            {user.emailVerifiedAt ? <Badge tone="success">e-mail confirmado</Badge> : <Badge>e-mail não confirmado</Badge>}
          </span>
        }
      />

      <div className="mb-4 space-y-2">
        {situation === "desativada" && (
          <Notice tone="danger" title="Conta desativada">
            Desde {formatDate(user.disabledAt)}. Motivo: {user.disabledReason ?? "—"}. Sem acesso à plataforma; o histórico
            continua guardado.
          </Notice>
        )}
        {situation === "travada" && (
          <Notice tone="warn" title="Acesso travado">
            Muitas tentativas com senha errada. Libera sozinho às {formatDate(user.lockedUntil)} — ou destrave abaixo.
          </Notice>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Conta"
            description={`Cadastro em ${formatDate(user.createdAt)} · último acesso ${d.lastLoginAt ? formatDate(d.lastLoginAt) : "nunca"}`}
          >
            <AccountForm userId={userId} name={user.name} email={user.email} />
            {(!user.emailVerifiedAt || situation === "travada") && (
              <div className="mt-4 space-y-3 border-t border-moveo-border pt-4">
                {!user.emailVerifiedAt && (
                  <div>
                    <AdminActionButton action={confirmEmailAction} fields={{ userId }} label="Marcar e-mail como confirmado" />
                    <p className="mt-1 text-xs text-moveo-muted">
                      Ainda não há envio de e-mail na internet: confirme só depois de conferir o endereço com a pessoa.
                    </p>
                  </div>
                )}
                {situation === "travada" && <AdminActionButton action={unlockUserAction} fields={{ userId }} label="Destravar acesso" />}
              </div>
            )}
          </Panel>

          <Panel
            title="Registro profissional"
            actions={
              profile && <Badge tone={VERIFICATION_LABEL[profile.verificationStatus].tone}>{VERIFICATION_LABEL[profile.verificationStatus].label}</Badge>
            }
          >
            {profile?.verifiedAt && (
              <p className="mb-3 text-xs text-moveo-muted">
                Última decisão em {formatDate(profile.verifiedAt)} — fonte: {profile.verificationSource ?? "—"}
                {profile.verificationNote && ` — ${profile.verificationNote}`}
              </p>
            )}
            {profile && !profile.verifiedAt && profile.verificationNote && <p className="mb-3 text-xs text-moveo-muted">{profile.verificationNote}</p>}
            {!profile && (
              <p className="mb-3 text-sm text-moveo-muted">
                Sem registro profissional (conta de equipe). Preencha só se a pessoa for fisioterapeuta ou profissional de
                educação física — o registro começa pendente de verificação.
              </p>
            )}
            <ProfileForm userId={userId} profile={profile} />
            {profile && (
              <div className="mt-4 border-t border-moveo-border pt-4">
                <p className="mb-2 text-sm font-medium text-moveo-ink">Decidir a verificação</p>
                <VerificationForm userId={userId} />
              </div>
            )}
          </Panel>

          <Panel title="Espaços">
            {d.spaces.length === 0 ? (
              <p className="text-sm text-moveo-muted">Não participa de nenhum espaço.</p>
            ) : (
              <ul className="divide-y divide-moveo-border">
                {d.spaces.map(({ workspace, role, status, since }) => (
                  <li key={workspace.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium text-moveo-ink">{workspace.name}</span>
                      <span className="block text-xs text-moveo-muted">
                        {WORKSPACE_KIND_LABEL[workspace.kind]} · {ROLE_LABEL[role]} desde {formatDate(since, false)}
                        {workspace.createdBy === userId && " · criou o espaço"}
                      </span>
                    </span>
                    <span className="flex gap-2">
                      {status !== "ativo" && <Badge>removido da equipe</Badge>}
                      <Badge tone={workspace.environment === "real" ? "success" : "demo"}>
                        {workspace.environment === "real" ? "Atendimento real" : "Demonstração"}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Histórico" description="Últimos eventos da trilha de auditoria ligados a esta conta.">
            {d.history.length === 0 ? (
              <p className="text-sm text-moveo-muted">Nenhum evento registrado.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {d.history.map((e) => (
                  <li key={e.id} className="flex flex-wrap justify-between gap-x-4">
                    <span className="text-moveo-ink">
                      {EVENT_LABEL[e.action] ?? e.action}
                      {e.actorId !== userId && e.objectId === userId && <span className="text-moveo-muted"> · pela administração</span>}
                    </span>
                    <span className="text-xs text-moveo-muted">{formatDate(e.at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Atividade" description="Só contagens — o conteúdo fica com o profissional.">
            <dl className="space-y-2 text-sm">
              {[
                ["Pessoas atendidas cadastradas", activity.persons],
                ["Avaliações solicitadas", activity.requests],
                ["Avaliações realizadas", activity.completed],
                ["Medições presenciais", activity.manual],
                ["Devolutivas publicadas", activity.feedbacks],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-moveo-muted">{label}</dt>
                  <dd className="font-semibold tabular-nums text-moveo-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Etiquetas" description="Para organizar a base. Só a administração vê.">
            {d.tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {d.tags.map((t) => (
                  <TagChip key={t.tag} userId={userId} tag={t.tag} />
                ))}
              </div>
            )}
            <TagForm userId={userId} suggestions={allTags.map((t) => t.tag).filter((t) => !d.tags.some((x) => x.tag === t))} />
          </Panel>

          <Panel title="Anotações internas" description="Contatos, combinados e observações. Só a administração vê.">
            <NoteForm userId={userId} />
            {d.notes.length > 0 && (
              <ul className="mt-4 space-y-3 border-t border-moveo-border pt-4">
                {d.notes.map(({ note, authorName }) => (
                  <li key={note.id} className="text-sm">
                    <p className="whitespace-pre-wrap text-moveo-ink">{note.body}</p>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-moveo-muted">
                      <span>
                        {authorName ?? "conta excluída"} · {formatDate(note.createdAt)}
                      </span>
                      {note.authorId === admin.id && (
                        <AdminActionButton action={deleteNoteAction} fields={{ userId, noteId: note.id }} label="Apagar" pendingLabel="Apagando…" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {isSelf ? (
            <Panel title="Sua conta">
              <p className="text-sm text-moveo-muted">
                Você não pode desativar, excluir nem tirar o acesso de administração da sua própria conta — peça a outra
                pessoa da administração.
              </p>
            </Panel>
          ) : (
            <>
              <Panel
                title="Acesso de administração"
                description={user.isPlatformAdmin ? "Esta conta administra a plataforma." : "Permite usar toda esta área de administração."}
              >
                <AdminActionButton
                  action={setAdminAction}
                  fields={{ userId, makeAdmin: user.isPlatformAdmin ? "0" : "1" }}
                  label={user.isPlatformAdmin ? "Remover acesso de administração" : "Dar acesso de administração"}
                />
              </Panel>

              {situation === "desativada" ? (
                <Panel title="Reativar conta" description="A pessoa volta a entrar com a mesma senha.">
                  <AdminActionButton action={reactivateUserAction} fields={{ userId }} label="Reativar conta" variant="secondary" />
                </Panel>
              ) : (
                <Panel title="Desativar conta" description="Bloqueia o acesso na hora e derruba as sessões abertas. Nada é apagado; dá para reativar.">
                  <DeactivateForm userId={userId} />
                </Panel>
              )}

              <Panel title="Excluir definitivamente">
                {d.blockers.length > 0 ? (
                  <>
                    <p className="text-sm text-moveo-muted">Esta conta não pode ser excluída porque:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-moveo-ink">
                      {d.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-moveo-muted">
                      Registros de atendimento precisam ser guardados. Use <strong>Desativar</strong>: o acesso é bloqueado e o
                      histórico fica preservado.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-moveo-muted">
                      Sem registros de atendimento. Apaga a conta, o registro profissional, as etiquetas, as anotações e{" "}
                      {pl(d.spaces.filter((s) => s.workspace.createdBy === userId).length, "espaço vazio criado", "espaços vazios criados")}{" "}
                      por ela. <strong>Não dá para desfazer.</strong>
                    </p>
                    <DeleteUserForm userId={userId} email={user.email} />
                  </>
                )}
              </Panel>
            </>
          )}
        </div>
      </div>
    </>
  );
}
