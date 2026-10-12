import Link from "next/link";
import { getDb } from "@/db/client";
import { PersonShell } from "@/components/care/PersonShell";
import { buttonClass } from "@/components/platform/ui";
import { personLogoutAction } from "@/app/actions/person";
import { consentStatus, REQUIRED_CONSENTS_FOR_CAMERA } from "@/lib/server/services/personAccess";
import { requirePersonScope } from "@/lib/server/session";
import { getProtocol, selectedItems } from "@/lib/care/protocols";
import { formatDate } from "@/lib/care/labels";

export default async function PersonHome() {
  const scope = await requirePersonScope();
  const db = await getDb();
  const { request, workspace, person, professionalName } = scope;
  const protocol = getProtocol(request.protocolId);
  const consents = await consentStatus(db, scope, REQUIRED_CONSENTS_FOR_CAMERA);
  const needsConsent = consents.some((c) => !c.accepted);
  const firstName = person.fullName.split(" ")[0];
  const open = request.status === "pendente" || request.status === "em_andamento";

  return (
    <PersonShell
      workspaceName={workspace.name}
      brandColor={workspace.brandColor}
      logoUrl={workspace.logoUrl}
      isDemo={workspace.environment === "demonstracao"}
      footer={
        <form action={personLogoutAction}>
          <button className="underline">Sair</button>
        </form>
      }
    >
      <h1 className="text-2xl font-bold">Olá, {firstName}</h1>
      <p className="mt-1 text-sm text-moveo-muted">Atividade enviada por {professionalName}.</p>

      <section className="mt-6 rounded-2xl border border-moveo-border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-moveo-muted">{open ? "Para fazer" : "Atividade"}</p>
        <h2 className="mt-1 text-lg font-bold">{protocol?.shortTitle ?? "Avaliação de movimento"}</h2>
        {request.selectedItems ? (
          <div className="mt-2 text-sm text-moveo-ink">
            <p>Você vai fazer só estes movimentos, até onde for confortável:</p>
            <ul className="mt-1 list-disc pl-5">
              {selectedItems(request.protocolId, request.selectedItems).map((i) => (
                <li key={i.id}>{i.label}</li>
              ))}
            </ul>
          </div>
        ) : (
          protocol?.personInstructions && <p className="mt-2 text-sm text-moveo-ink">{protocol.personInstructions}</p>
        )}
        {request.instructions && (
          <div className="mt-3 rounded-xl bg-moveo-bg p-3 text-sm">
            <p className="text-xs font-semibold text-moveo-muted">Orientação de {professionalName}</p>
            <p className="mt-1 whitespace-pre-wrap">{request.instructions}</p>
          </div>
        )}
        {request.dueAt && open && <p className="mt-3 text-xs text-moveo-muted">Faça até {formatDate(request.dueAt, false)}.</p>}

        {request.supervision === "sessao_ao_vivo" && open && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            Faça esta atividade somente durante a sessão combinada com {professionalName}.
          </p>
        )}

        <div className="mt-5">
          {open && (
            <Link
              href={needsConsent ? "/acompanhamento/consentimento" : `/acompanhamento/avaliacao/${request.id}`}
              className={buttonClass("primary", "w-full py-4 text-base")}
            >
              {request.status === "em_andamento" ? "Recomeçar atividade" : "Começar"}
            </Link>
          )}
          {request.status === "aguardando_revisao" && (
            <p className="rounded-xl bg-moveo-primarySoft p-3 text-sm text-moveo-primaryDark">
              Enviado. {professionalName} vai revisar e publicar um retorno para você aqui.
            </p>
          )}
          {request.status === "revisada" && (
            <Link href="/acompanhamento/retorno" className={buttonClass("primary", "w-full py-4 text-base")}>
              Ver retorno do profissional
            </Link>
          )}
          {request.status === "cancelada" && <p className="text-sm text-moveo-muted">Esta atividade foi cancelada pelo profissional.</p>}
        </div>
      </section>

      <section className="mt-6 space-y-2 text-sm text-moveo-muted">
        <p>• Você pode interromper a qualquer momento.</p>
        <p>• Se sentir dor forte, tontura ou falta de ar, pare e procure atendimento.</p>
        <p>• O vídeo não é gravado: a câmera é usada só no seu celular.</p>
      </section>
    </PersonShell>
  );
}
