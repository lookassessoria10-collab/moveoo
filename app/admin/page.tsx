import Link from "next/link";
import type { ReactNode } from "react";
import { getDb } from "@/db/client";
import { PageHeader, Panel, buttonClass, inputClass } from "@/components/platform/ui";
import { getAdminOverview, listTags } from "@/lib/server/services/adminUsers";
import { requireAdmin } from "@/lib/server/session";

export const metadata = { title: "Visão geral" };

const num = (n: number) => n.toLocaleString("pt-BR");
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const dayMonth = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

function StatTile({ label, value, detail, href }: { label: string; value: number; detail?: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-moveo-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-moveo-ink">{num(value)}</p>
      {detail && <p className="mt-1 text-xs text-moveo-muted">{detail}</p>}
    </>
  );
  const box = "block rounded-2xl border border-moveo-border bg-white p-4";
  return href ? (
    <Link href={href} className={`${box} transition-colors hover:border-moveo-primary`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

/** Barra horizontal de uma série só: ponta arredondada, base reta, valor ao lado (texto em tinta, nunca na cor da barra). */
function BarRow({ label, value, max, detail }: { label: string; value: number; max: number; detail?: string }) {
  const width = max ? (value / max) * 100 : 0;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-moveo-ink">{label}</span>
        <span className="flex-none tabular-nums text-moveo-muted">
          <strong className="font-semibold text-moveo-ink">{num(value)}</strong>
          {detail && ` · ${detail}`}
        </span>
      </div>
      <div className="mt-1.5 h-3 bg-moveo-primarySoft" aria-hidden>
        <div className="h-full rounded-r bg-moveo-primary" style={{ width: `${width}%`, minWidth: value ? 3 : 0 }} />
      </div>
    </li>
  );
}

export default async function AdminOverviewPage({ searchParams }: { searchParams: { ignorar?: string } }) {
  const admin = await requireAdmin();
  const db = await getDb();
  const tags = await listTags(db, admin.id);
  const ignoreTag = tags.some((t) => t.tag === searchParams.ignorar) ? searchParams.ignorar : undefined;
  const { totals: t, funnel, weekly, byUf, activity30 } = await getAdminOverview(db, admin.id, { ignoreTag });
  const weekMax = Math.max(...weekly.map((w) => w.users));
  const peak = weekly.findIndex((w) => w.users === weekMax);
  const professionMax = Math.max(t.fisioterapia, t.educacaoFisica, t.noProfile);

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle={
          <>
            Profissionais e equipes cadastrados — contas de administração ficam de fora.
            {ignoreTag && <> Desconsiderando contas com a etiqueta “{ignoreTag}”.</>}
          </>
        }
        actions={
          tags.length > 0 && (
            <form className="flex items-end gap-2">
              <label className="text-xs text-moveo-muted">
                Desconsiderar contas com a etiqueta
                <select name="ignorar" defaultValue={ignoreTag ?? ""} className={`${inputClass} mt-1 py-2`}>
                  <option value="">nenhuma</option>
                  {tags.map((tag) => (
                    <option key={tag.tag} value={tag.tag}>
                      {tag.tag} ({tag.users})
                    </option>
                  ))}
                </select>
              </label>
              <button className={buttonClass("ghost")}>Aplicar</button>
            </form>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Contas ativas" value={t.active} detail={`de ${num(t.accounts)} no total`} href="/admin/usuarios?situacao=ativa" />
        <StatTile label="Novas em 7 dias" value={t.new7} detail={`${num(t.new30)} em 30 dias`} href="/admin/usuarios?periodo=7" />
        <StatTile
          label="Entraram nos últimos 30 dias"
          value={t.seen30}
          detail={`${pct(t.seen30, t.active)}% das contas ativas`}
          href="/admin/usuarios?ordem=acesso"
        />
        <StatTile label="Registro a verificar" value={t.verificationPending} detail="Conferir no conselho →" href="/admin/verificacao" />
        <StatTile
          label="E-mail não confirmado"
          value={t.emailPending}
          detail="Confirme na ficha, se já conferiu"
          href="/admin/usuarios?situacao=email_nao_confirmado"
        />
        <StatTile label="Desativadas" value={t.disabled} href="/admin/usuarios?situacao=desativada" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          className="min-w-0"
          title="Cadastros por semana"
          description="Últimas 12 semanas, começando na segunda-feira. Passe o mouse numa coluna para ver o número."
        >
          <div className="flex h-40 items-end gap-1 border-b border-moveo-border" aria-hidden>
            {weekly.map((w, i) => {
              const labeled = w.users > 0 && (i === peak || i === weekly.length - 1);
              return (
                <div key={w.start.toISOString()} className="group relative flex h-full w-0 flex-1 flex-col items-center justify-end">
                  {labeled && <span className="mb-1 text-xs font-semibold tabular-nums text-moveo-ink">{num(w.users)}</span>}
                  <div
                    className="w-full max-w-[24px] rounded-t bg-moveo-primary group-hover:bg-moveo-primaryDark"
                    style={{ height: weekMax ? Math.round((w.users / weekMax) * 132) : 0, minHeight: w.users ? 3 : 0 }}
                  />
                  <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-moveo-ink px-2 py-1 text-xs text-white group-hover:block">
                    Semana de {dayMonth(w.start)}: {num(w.users)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1 text-[11px] tabular-nums text-moveo-muted" aria-hidden>
            {weekly.map((w, i) => (
              <span
                key={w.start.toISOString()}
                className={`w-0 flex-1 whitespace-nowrap text-center ${i % 3 === 0 || i === weekly.length - 1 ? "" : "invisible"}`}
              >
                {dayMonth(w.start)}
              </span>
            ))}
          </div>
          <table className="sr-only">
            <caption>Cadastros por semana</caption>
            <tbody>
              {weekly.map((w) => (
                <tr key={w.start.toISOString()}>
                  <th scope="row">Semana de {dayMonth(w.start)}</th>
                  <td>{w.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel className="min-w-0" title="Funil de ativação" description="Quantas contas chegaram a cada etapa, em relação ao total de contas.">
          <ol className="space-y-3">
            {funnel.map((f) => (
              <BarRow key={f.key} label={f.label} value={f.users} max={funnel[0].users} detail={`${pct(f.users, funnel[0].users)}%`} />
            ))}
          </ol>
          <p className="mt-4 text-xs text-moveo-muted">
            “Avaliação realizada” conta só as feitas pela pessoa atendida (câmera); medição presencial fica de fora.
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Por profissão">
          <ul className="space-y-3">
            <BarRow label="Fisioterapia" value={t.fisioterapia} max={professionMax} detail={`${pct(t.fisioterapia, t.accounts)}%`} />
            <BarRow label="Educação física" value={t.educacaoFisica} max={professionMax} detail={`${pct(t.educacaoFisica, t.accounts)}%`} />
            <BarRow label="Sem registro (equipe)" value={t.noProfile} max={professionMax} detail={`${pct(t.noProfile, t.accounts)}%`} />
          </ul>
        </Panel>

        <Panel title="Por estado do registro">
          {byUf.length === 0 ? (
            <p className="text-sm text-moveo-muted">Nenhum registro profissional ainda.</p>
          ) : (
            <ul className="space-y-3">
              {byUf.slice(0, 8).map((u) => (
                <BarRow key={u.uf} label={u.uf} value={u.users} max={byUf[0].users} />
              ))}
            </ul>
          )}
          {byUf.length > 8 && <p className="mt-3 text-xs text-moveo-muted">E mais {byUf.length - 8} estados.</p>}
        </Panel>

        <Panel title="Uso nos últimos 30 dias">
          <dl className="space-y-3">
            {[
              ["Pessoas atendidas cadastradas", activity30.persons],
              ["Avaliações solicitadas", activity30.requests],
              ["Avaliações realizadas", activity30.completed],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-b border-moveo-border pb-2 last:border-0">
                <dt className="text-sm text-moveo-muted">{label}</dt>
                <dd className="text-xl font-semibold text-moveo-ink">{num(value as number)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </>
  );
}
