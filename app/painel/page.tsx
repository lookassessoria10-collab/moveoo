import Link from "next/link";
import { getDb } from "@/db/client";
import { Badge, EmptyState, LinkButton, Notice, PageHeader, Panel } from "@/components/platform/ui";
import { getTodayPanel, type PendingItem } from "@/lib/server/services/dashboard";
import { canHaveClinicalAccess } from "@/lib/server/services/authz";
import { getWorkspaceContext } from "@/lib/server/session";
import { vocabularyFor } from "@/lib/care/vocabulary";
import { formatDate } from "@/lib/care/labels";

export const metadata = { title: "Hoje" };

function PendingList({ items, empty, cta }: { items: PendingItem[]; empty: string; cta: string }) {
  if (!items.length) return <p className="text-sm text-moveo-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-moveo-border">
      {items.map((i) => (
        <li key={i.requestId} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-medium text-moveo-ink">
              {i.personName} {i.isFictitious && <Badge tone="demo">fictício</Badge>}
            </p>
            <p className="text-sm text-moveo-muted">
              {i.protocolTitle} · {i.detail} · {formatDate(i.at)}
            </p>
          </div>
          <LinkButton href={`/painel/avaliacoes/${i.requestId}`} variant="ghost">
            {cta}
          </LinkButton>
        </li>
      ))}
    </ul>
  );
}

export default async function TodayPage({ searchParams }: { searchParams: { bemvindo?: string; verificacao?: string } }) {
  const ctx = await getWorkspaceContext();
  const v = vocabularyFor(ctx.profile?.profession);
  const panel = await getTodayPanel(await getDb(), ctx);
  const firstName = ctx.userName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        subtitle="Pendências que dependem de você, das pessoas que você atende."
        actions={<LinkButton href="/painel/pessoas/nova">Cadastrar {v.person}</LinkButton>}
      />

      <div className="mb-6 space-y-2">
        {searchParams.bemvindo && (
          <Notice tone="success" title="Conta criada">
            Seu espaço de demonstração está pronto. Cadastre uma pessoa fictícia (use o seu próprio e-mail como
            contato) e envie uma avaliação para testar o fluxo completo no seu celular.
          </Notice>
        )}
        {searchParams.verificacao && <Notice tone="info">Enviamos um novo link de confirmação para o seu e-mail.</Notice>}
        {ctx.profile && ctx.profile.verificationStatus !== "verificado" && (
          <Notice tone="warn" title="Registro profissional ainda não verificado">
            Enquanto isso, use o espaço de demonstração. A conferência é manual e registrada com fonte e data.{" "}
            <Link href="/painel/perfil" className="underline">
              Ver detalhes
            </Link>
          </Notice>
        )}
        {!canHaveClinicalAccess(ctx) && (
          <Notice tone="info" title="Acesso administrativo">
            Seu papel neste espaço permite cadastrar pessoas e organizar a equipe, sem acesso a avaliações e
            devolutivas.
          </Notice>
        )}
      </div>

      {canHaveClinicalAccess(ctx) && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Para revisar", panel.awaitingReview.length],
              ["Para refazer", panel.redo.length],
              ["Prazo ou convite vencido", panel.overdue.length],
              [`${v.persons.charAt(0).toUpperCase() + v.persons.slice(1)} acompanhados`, panel.totals.people],
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-2xl border border-moveo-border bg-white p-4">
                <p className="text-2xl font-bold text-moveo-ink">{n}</p>
                <p className="text-sm text-moveo-muted">{label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <Panel title="Resultados aguardando sua revisão" description="Resultado enviado não é resultado revisado: nada chega à pessoa sem você publicar.">
              <PendingList items={panel.awaitingReview} empty="Nenhum resultado aguardando revisão." cta="Revisar" />
            </Panel>
            <Panel title="Atividades para refazer" description="Interrompidas pela pessoa, pela câmera ou pelas perguntas de segurança.">
              <PendingList items={panel.redo} empty="Nenhuma atividade interrompida." cta="Ver" />
            </Panel>
            <Panel title="Prazo encerrado ou sem convite ativo">
              <PendingList items={panel.overdue} empty="Nada vencido." cta="Gerar novo link" />
            </Panel>
            <Panel title="Aguardando a pessoa">
              <PendingList items={panel.waitingPerson} empty="Nenhuma atividade em aberto." cta="Acompanhar" />
            </Panel>
            {panel.totals.people === 0 && (
              <EmptyState title={`Você ainda não acompanha ${v.persons}.`}>
                <Link href="/painel/pessoas/nova" className="font-medium text-moveo-primary">
                  Cadastrar {v.person}
                </Link>
              </EmptyState>
            )}
          </div>
        </>
      )}
    </>
  );
}
