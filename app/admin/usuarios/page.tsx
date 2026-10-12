import Link from "next/link";
import { getDb } from "@/db/client";
import { Badge, EmptyState, Field, Notice, PageHeader, Panel, buttonClass, inputClass } from "@/components/platform/ui";
import { accountSituation, listTags, listUsers, parseUserFilters, type UserFilters } from "@/lib/server/services/adminUsers";
import { requireAdmin } from "@/lib/server/session";
import { VERIFICATION_LABEL, formatDate } from "@/lib/care/labels";
import { PROFESSION_LABEL, UFS } from "@/lib/care/vocabulary";

export const metadata = { title: "Usuários" };

const pl = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

/** Mesmos filtros na URL, trocando só o que for pedido (paginação, exportação). */
function withFilters(path: string, f: UserFilters, change: Partial<Record<keyof UserFilters, string | number | undefined>> = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...change })) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const admin = await requireAdmin();
  const db = await getDb();
  const f = parseUserFilters(searchParams);
  const [{ rows, total, page, pageCount }, tags] = await Promise.all([listUsers(db, admin.id, f), listTags(db, admin.id)]);
  const filtering = Object.keys(f).some((k) => k !== "pagina" && k !== "ordem");

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Profissionais e equipes. A administração vê só dados de cadastro e contagens — nunca conteúdo clínico."
        actions={
          <a href={withFilters("/admin/usuarios/exportar", f, { pagina: undefined })} className={buttonClass("ghost")}>
            Baixar planilha (CSV)
          </a>
        }
      />

      {searchParams.excluido && (
        <div className="mb-4">
          <Notice tone="success">Conta excluída definitivamente.</Notice>
        </div>
      )}

      <Panel className="mb-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Field label="Buscar" htmlFor="f-q">
              <input id="f-q" name="q" type="search" defaultValue={f.q} placeholder="Nome, e-mail ou número de registro" className={inputClass} />
            </Field>
          </div>
          <Field label="Profissão" htmlFor="f-profissao">
            <select id="f-profissao" name="profissao" defaultValue={f.profissao ?? ""} className={inputClass}>
              <option value="">Todas</option>
              <option value="fisioterapia">Fisioterapia</option>
              <option value="educacao_fisica">Educação física</option>
              <option value="sem_perfil">Sem registro (equipe)</option>
            </select>
          </Field>
          <Field label="UF do registro" htmlFor="f-uf">
            <select id="f-uf" name="uf" defaultValue={f.uf ?? ""} className={inputClass}>
              <option value="">Todas</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Verificação" htmlFor="f-verificacao">
            <select id="f-verificacao" name="verificacao" defaultValue={f.verificacao ?? ""} className={inputClass}>
              <option value="">Todas</option>
              <option value="pendente">Pendente</option>
              <option value="verificado">Verificado</option>
              <option value="recusado">Recusado</option>
            </select>
          </Field>
          <Field label="Situação" htmlFor="f-situacao">
            <select id="f-situacao" name="situacao" defaultValue={f.situacao ?? ""} className={inputClass}>
              <option value="">Todas</option>
              <option value="ativa">Ativa</option>
              <option value="desativada">Desativada</option>
              <option value="travada">Travada (senha errada)</option>
              <option value="email_nao_confirmado">E-mail não confirmado</option>
              <option value="administracao">Administração</option>
            </select>
          </Field>
          <Field label="Etiqueta" htmlFor="f-etiqueta">
            <select id="f-etiqueta" name="etiqueta" defaultValue={f.etiqueta ?? ""} className={inputClass}>
              <option value="">Todas</option>
              {tags.map((t) => (
                <option key={t.tag} value={t.tag}>
                  {t.tag} ({t.users})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cadastro" htmlFor="f-periodo">
            <select id="f-periodo" name="periodo" defaultValue={f.periodo ?? ""} className={inputClass}>
              <option value="">Qualquer data</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
          </Field>
          <Field label="Ordenar por" htmlFor="f-ordem">
            <select id="f-ordem" name="ordem" defaultValue={f.ordem ?? "recentes"} className={inputClass}>
              <option value="recentes">Cadastro mais recente</option>
              <option value="nome">Nome</option>
              <option value="acesso">Último acesso</option>
            </select>
          </Field>
          <div className="flex items-end gap-2 lg:col-span-3">
            <button className={buttonClass("primary")}>Filtrar</button>
            {filtering && (
              <Link href="/admin/usuarios" className={buttonClass("ghost")}>
                Limpar filtros
              </Link>
            )}
          </div>
        </form>
      </Panel>

      <Panel title={pl(total, "usuário", "usuários")} description={filtering ? "Com os filtros acima." : undefined}>
        {rows.length === 0 ? (
          <EmptyState title="Ninguém encontrado com esses filtros." />
        ) : (
          <ul className="divide-y divide-moveo-border">
            {rows.map((u) => {
              const situation = accountSituation(u);
              return (
                <li key={u.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/usuarios/${u.id}`} className="font-semibold text-moveo-ink hover:text-moveo-primary">
                        {u.name}
                      </Link>
                      {u.isPlatformAdmin && <Badge tone="info">administração</Badge>}
                      {situation === "desativada" && <Badge tone="danger">desativada</Badge>}
                      {situation === "travada" && <Badge tone="warn">travada</Badge>}
                      {!u.emailVerifiedAt && <Badge>e-mail não confirmado</Badge>}
                    </p>
                    <p className="truncate text-sm text-moveo-muted">{u.email}</p>
                    <p className="mt-0.5 text-sm text-moveo-muted">
                      {u.profession
                        ? `${PROFESSION_LABEL[u.profession]} · ${u.council}-${u.councilRegion} nº ${u.registrationNumber} · ${u.jurisdictionUf}`
                        : "Sem registro profissional"}
                    </p>
                    {u.tags.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap gap-1">
                        {u.tags.map((t) => (
                          <Link
                            key={t}
                            href={withFilters("/admin/usuarios", {}, { etiqueta: t })}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:ring-moveo-primary"
                          >
                            {t}
                          </Link>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-moveo-muted sm:text-right">
                    {u.verificationStatus && <Badge tone={VERIFICATION_LABEL[u.verificationStatus].tone}>{VERIFICATION_LABEL[u.verificationStatus].label}</Badge>}
                    <p>
                      {pl(u.workspaces, "espaço", "espaços")}
                      {u.realWorkspaces > 0 && ` (${u.realWorkspaces} real)`} · {pl(u.persons, "pessoa", "pessoas")} · {pl(u.requests, "avaliação", "avaliações")}
                    </p>
                    <p>
                      Cadastro {formatDate(u.createdAt, false)} · último acesso {u.lastLoginAt ? formatDate(u.lastLoginAt, false) : "nunca"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pageCount > 1 && (
          <nav aria-label="Páginas" className="mt-4 flex items-center justify-between gap-3 border-t border-moveo-border pt-4 text-sm">
            {page > 1 ? (
              <Link href={withFilters("/admin/usuarios", f, { pagina: page - 1 })} className={buttonClass("ghost")}>
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-moveo-muted">
              Página {page} de {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={withFilters("/admin/usuarios", f, { pagina: page + 1 })} className={buttonClass("ghost")}>
                Próxima →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </Panel>
    </>
  );
}
