"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import {
  addMemberAction,
  createEpisodeAction,
  createPersonAction,
  createRequestAction,
  createWorkspaceAction,
  manualMeasurementAction,
  publishFeedbackAction,
  reissueInvitationAction,
  updateWorkspaceAction,
} from "@/app/actions/care";
import { UFS } from "@/lib/care/vocabulary";
import { MANUAL_INSTRUMENTS } from "@/lib/care/protocols";
import { Field, Notice, buttonClass, inputClass } from "./ui";
import { FormError, SubmitButton } from "./forms";

export function PersonForm({ personLabel, episodeLabel, episodeHint }: { personLabel: string; episodeLabel: string; episodeHint: string }) {
  const [state, action] = useFormState(createPersonAction, undefined);
  const [modality, setModality] = useState("hibrido");
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Nome completo d${personLabel === "paciente" ? "o paciente" : "o aluno"}`} htmlFor="fullName">
          <input id="fullName" name="fullName" required className={inputClass} />
        </Field>
        <Field label="Canal preferido para convites" htmlFor="preferredChannel">
          <select id="preferredChannel" name="preferredChannel" className={inputClass} defaultValue="email">
            <option value="email">E-mail</option>
            <option value="whatsapp">WhatsApp (você envia o link)</option>
            <option value="sms">SMS</option>
          </select>
        </Field>
        <Field label="E-mail" htmlFor="email">
          <input id="email" name="email" type="email" className={inputClass} />
        </Field>
        <Field label="Celular" htmlFor="phone" hint="Com DDD. Usado para código de acesso e WhatsApp.">
          <input id="phone" name="phone" inputMode="tel" className={inputClass} />
        </Field>
        <Field label="Cidade (opcional)" htmlFor="city">
          <input id="city" name="city" className={inputClass} />
        </Field>
        <Field label="UF (opcional)" htmlFor="uf">
          <select id="uf" name="uf" className={inputClass} defaultValue="">
            <option value="">—</option>
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-xs text-moveo-muted">
        Coletamos só o necessário ao acompanhamento: não peça CPF, endereço ou documentos aqui.
      </p>

      <div className="space-y-4 rounded-xl bg-moveo-bg p-4">
        <Field label={episodeLabel.charAt(0).toUpperCase() + episodeLabel.slice(1)} htmlFor="episodeTitle" hint={episodeHint}>
          <input id="episodeTitle" name="episodeTitle" required className={inputClass} />
        </Field>
        <Field label="Modalidade" htmlFor="modality">
          <select id="modality" name="modality" value={modality} onChange={(e) => setModality(e.target.value)} className={inputClass}>
            <option value="hibrido">Híbrido (presencial + a distância)</option>
            <option value="remoto">Somente a distância</option>
            <option value="presencial">Somente presencial</option>
          </select>
        </Field>
        {modality !== "presencial" && (
          <Field
            label="Sua avaliação sobre a adequação do acompanhamento a distância"
            htmlFor="remoteSuitabilityNote"
            hint="Registre por que o remoto é adequado neste caso e quando uma avaliação presencial será necessária."
          >
            <textarea id="remoteSuitabilityNote" name="remoteSuitabilityNote" rows={3} className={inputClass} />
          </Field>
        )}
      </div>

      <FormError state={state} />
      <SubmitButton>Cadastrar</SubmitButton>
    </form>
  );
}

export function EpisodeForm({ personId, episodeLabel }: { personId: string; episodeLabel: string }) {
  const [state, action] = useFormState(createEpisodeAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="personId" value={personId} />
      <Field label={`Novo ${episodeLabel}`} htmlFor="title">
        <input id="title" name="title" required className={inputClass} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="modality" className={inputClass} defaultValue="hibrido" aria-label="Modalidade">
          <option value="hibrido">Híbrido</option>
          <option value="remoto">Somente a distância</option>
          <option value="presencial">Somente presencial</option>
        </select>
        <input name="remoteSuitabilityNote" placeholder="Adequação do remoto (opcional)" className={inputClass} />
      </div>
      <FormError state={state} />
      {state?.ok && <p className="text-sm text-emerald-700">Registrado.</p>}
      <SubmitButton variant="secondary">Abrir</SubmitButton>
    </form>
  );
}

function InviteResult({ data }: { data: Record<string, unknown> }) {
  const url = String(data.url);
  const code = data.code ? String(data.code) : null;
  const whatsappUrl = data.whatsappUrl ? String(data.whatsappUrl) : null;
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <Notice tone="success" title="Convite criado">
        {data.channel === "whatsapp"
          ? "Envie o link pelo WhatsApp. A mensagem não contém dados clínicos."
          : "O link foi enviado ao contato cadastrado (no computador local, veja a caixa de saída)."}{" "}
        O link e o código aparecem só agora: o sistema guarda apenas uma assinatura deles. Se perder, gere um novo.
      </Notice>
      {code && (
        <div className="rounded-xl border-2 border-dashed border-moveo-primary/50 bg-white p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-moveo-muted">Código de acesso da pessoa</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-moveo-ink">{code}</p>
          <p className="mt-2 text-xs text-moveo-muted">
            Passe este código por um meio <strong>diferente do link</strong> (pessoalmente, por ligação ou numa
            mensagem separada). Se for junto com o link, quem receber a mensagem encaminhada consegue entrar.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-moveo-bg p-3">
        <code className="min-w-0 flex-1 break-all text-xs text-moveo-ink">{url}</code>
        <button
          type="button"
          className={buttonClass("ghost")}
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? "Copiado" : "Copiar link"}
        </button>
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noreferrer noopener" className={buttonClass("primary")}>
            Abrir no WhatsApp
          </a>
        )}
      </div>
      <p className="text-xs text-moveo-muted">
        Sem o código, o link sozinho não abre a atividade. Após 5 tentativas erradas o convite bloqueia e você gera
        um novo.
      </p>
    </div>
  );
}

export function RequestForm({
  personId,
  protocols,
  episodes,
  defaultChannel,
  hasEmail,
  hasPhone,
  previousRequestId,
  fixedProtocolId,
  defaultItems,
}: {
  personId: string;
  protocols: { id: string; title: string; capture: string; blocked: string | null; items: { id: string; label: string }[] }[];
  episodes: { id: string; title: string }[];
  defaultChannel: string;
  hasEmail: boolean;
  hasPhone: boolean;
  previousRequestId?: string;
  fixedProtocolId?: string;
  /** Reavaliação: movimentos pedidos na avaliação anterior (null = todos). */
  defaultItems?: string[] | null;
}) {
  const [state, action] = useFormState(createRequestAction, undefined);
  const [protocolId, setProtocolId] = useState(fixedProtocolId ?? protocols.find((p) => !p.blocked)?.id ?? "");
  if (state?.ok && state.data) {
    return (
      <div className="space-y-4">
        <InviteResult data={state.data} />
        <a href={`/painel/avaliacoes/${state.data.requestId}`} className={buttonClass("secondary")}>
          Ir para a avaliação
        </a>
      </div>
    );
  }
  const selected = protocols.find((p) => p.id === protocolId);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="personId" value={personId} />
      {previousRequestId && <input type="hidden" name="previousRequestId" value={previousRequestId} />}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-moveo-ink">Protocolo</legend>
        {protocols.map((p) => (
          <label
            key={p.id}
            className={`block rounded-xl border p-3 ${p.blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${
              protocolId === p.id ? "border-moveo-primary bg-moveo-primarySoft/60" : "border-moveo-border"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="protocolId"
                value={p.id}
                disabled={!!p.blocked || (!!fixedProtocolId && fixedProtocolId !== p.id)}
                checked={protocolId === p.id}
                onChange={() => setProtocolId(p.id)}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium text-moveo-ink">{p.title}</p>
                <p className="text-xs text-moveo-muted">{p.capture}</p>
                {p.blocked && <p className="mt-1 text-xs font-medium text-red-700">{p.blocked}</p>}
              </div>
            </div>
          </label>
        ))}
      </fieldset>

      {selected && selected.items.length > 0 && (
        <fieldset key={selected.id} className="space-y-2 rounded-xl bg-moveo-bg p-4">
          <legend className="sr-only">Movimentos</legend>
          <input type="hidden" name="itemsPresent" value="1" />
          <p className="text-sm font-medium text-moveo-ink">Quais movimentos pedir?</p>
          <p className="text-xs text-moveo-muted">
            Desmarque o que não precisa. A pessoa faz só os movimentos marcados, e o resultado traz só essas medidas.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {selected.items.map((i) => (
              <label key={i.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-moveo-border">
                <input
                  type="checkbox"
                  name="selectedItems"
                  value={i.id}
                  defaultChecked={selected.id === fixedProtocolId && defaultItems ? defaultItems.includes(i.id) : true}
                />
                {i.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {episodes.length > 0 && (
          <Field label="Vincular ao objetivo/episódio" htmlFor="episodeId">
            <select id="episodeId" name="episodeId" className={inputClass} defaultValue={episodes[0].id}>
              {episodes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Prazo para realizar" htmlFor="dueInDays">
          <select id="dueInDays" name="dueInDays" className={inputClass} defaultValue="7">
            <option value="2">2 dias</option>
            <option value="7">7 dias</option>
            <option value="14">14 dias</option>
            <option value="30">30 dias</option>
          </select>
        </Field>
        <Field label="Supervisão" htmlFor="supervision" hint="Sessão ao vivo: a pessoa só deve fazer com você acompanhando.">
          <select id="supervision" name="supervision" className={inputClass} defaultValue="sem_supervisao">
            <option value="sem_supervisao">Pode fazer sem supervisão</option>
            <option value="sessao_ao_vivo">Somente em sessão ao vivo</option>
          </select>
        </Field>
        <Field label="Enviar convite por" htmlFor="channel">
          <select id="channel" name="channel" className={inputClass} defaultValue={defaultChannel}>
            <option value="email" disabled={!hasEmail}>
              E-mail{!hasEmail ? " (sem e-mail cadastrado)" : ""}
            </option>
            <option value="whatsapp" disabled={!hasPhone}>
              WhatsApp — você envia{!hasPhone ? " (sem celular)" : ""}
            </option>
            <option value="sms" disabled={!hasPhone}>
              SMS{!hasPhone ? " (sem celular)" : ""}
            </option>
          </select>
        </Field>
      </div>
      <Field label="Orientações para a pessoa (opcional)" htmlFor="instructions" hint="Aparecem antes de iniciar. Não escreva diagnóstico.">
        <textarea id="instructions" name="instructions" rows={3} maxLength={1000} className={inputClass} />
      </Field>
      {selected && (
        <p className="text-xs text-moveo-muted">
          Estimativa por câmera, ainda sem validação clínica. O resultado chega como provisório para a sua revisão.
        </p>
      )}
      <FormError state={state} />
      <SubmitButton pendingLabel="Criando convite…">Criar solicitação e convite</SubmitButton>
    </form>
  );
}

export function ReissueForm({ requestId, defaultChannel }: { requestId: string; defaultChannel: string }) {
  const [state, action] = useFormState(reissueInvitationAction, undefined);
  if (state?.ok && state.data) return <InviteResult data={state.data} />;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <select name="channel" defaultValue={defaultChannel} className={`${inputClass} w-auto`} aria-label="Canal">
        <option value="email">E-mail</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="sms">SMS</option>
      </select>
      <SubmitButton variant="secondary">Gerar novo link</SubmitButton>
      <FormError state={state} />
      <p className="w-full text-xs text-moveo-muted">Links anteriores desta avaliação deixam de funcionar.</p>
    </form>
  );
}

export function FeedbackForm({ requestId, current, canIncludeMeasurements }: { requestId: string; current: string; canIncludeMeasurements: boolean }) {
  const [state, action] = useFormState(publishFeedbackAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <textarea
        name="body"
        rows={6}
        defaultValue={current}
        required
        minLength={10}
        maxLength={5000}
        className={inputClass}
        placeholder="Orientação para a pessoa: o que foi observado, o que fazer agora, quando reavaliar…"
        aria-label="Devolutiva"
      />
      {canIncludeMeasurements && (
        <label className="flex items-start gap-2 text-sm text-moveo-ink">
          <input type="checkbox" name="includeMeasurements" defaultChecked className="mt-1" />
          <span>
            Mostrar à pessoa as medidas revisadas (com método e unidade). Medidas descartadas nunca aparecem.
          </span>
        </label>
      )}
      <FormError state={state} />
      {state?.ok && <Notice tone="success">Devolutiva publicada. A pessoa já pode ver pelo link do convite.</Notice>}
      <SubmitButton pendingLabel="Publicando…">{current ? "Publicar nova versão" : "Publicar devolutiva"}</SubmitButton>
      {current && <p className="text-xs text-moveo-muted">A versão anterior fica guardada no histórico, com autoria e data.</p>}
    </form>
  );
}

const EMPTY_ROW = { movement: "", side: "direito", value: "", unit: "graus", instrument: "goniometro" };

export function ManualMeasurementForm({ personId, episodes }: { personId: string; episodes: { id: string; title: string }[] }) {
  const [state, action] = useFormState(manualMeasurementAction, undefined);
  const [rows, setRows] = useState([EMPTY_ROW]);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="personId" value={personId} />
      {episodes.length > 0 && (
        <Field label="Objetivo/episódio" htmlFor="episodeId">
          <select id="episodeId" name="episodeId" className={inputClass}>
            {episodes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="space-y-3">
        {rows.map((_, i) => (
          <div key={i} className="grid gap-2 rounded-xl bg-moveo-bg p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_1.3fr]">
            <input name="movement" placeholder="Movimento (ex.: Flexão do joelho)" className={inputClass} aria-label="Movimento" required={i === 0} />
            <select name="side" className={inputClass} aria-label="Lado" defaultValue="direito">
              <option value="direito">Direito</option>
              <option value="esquerdo">Esquerdo</option>
              <option value="bilateral">Bilateral</option>
              <option value="nao_se_aplica">Não se aplica</option>
            </select>
            <input name="value" inputMode="decimal" placeholder="Valor" className={inputClass} aria-label="Valor" required={i === 0} />
            <select name="unit" className={inputClass} aria-label="Unidade" defaultValue="graus">
              <option value="graus">graus</option>
              <option value="centimetros">cm</option>
              <option value="segundos">segundos</option>
              <option value="repeticoes">repetições</option>
            </select>
            <select name="instrument" className={inputClass} aria-label="Instrumento" defaultValue="goniometro">
              {Object.entries(MANUAL_INSTRUMENTS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <button type="button" className={buttonClass("ghost")} onClick={() => setRows((r) => [...r, EMPTY_ROW])}>
        + Adicionar medida
      </button>
      <Field label="Observações (opcional)" htmlFor="notes">
        <textarea id="notes" name="notes" rows={2} className={inputClass} />
      </Field>
      <FormError state={state} />
      <SubmitButton>Registrar medição presencial</SubmitButton>
    </form>
  );
}

export function AddMemberForm() {
  const [state, action] = useFormState(addMemberAction, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
      <Field label="E-mail da conta" htmlFor="member-email">
        <input id="member-email" name="email" type="email" required className={inputClass} />
      </Field>
      <Field label="Papel" htmlFor="member-role">
        <select id="member-role" name="role" className={inputClass} defaultValue="profissional">
          <option value="profissional">Profissional</option>
          <option value="assistente">Assistente (sem acesso clínico)</option>
          <option value="gestor">Gestor</option>
        </select>
      </Field>
      <SubmitButton>Adicionar</SubmitButton>
      <div className="sm:col-span-3">
        <FormError state={state} />
        {state?.ok && <p className="text-sm text-emerald-700">Membro adicionado.</p>}
      </div>
    </form>
  );
}

export function WorkspaceSettingsForm({ name, brandColor }: { name: string; brandColor: string }) {
  const [state, action] = useFormState(updateWorkspaceAction, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
      <Field label="Nome exibido às pessoas atendidas" htmlFor="ws-name">
        <input id="ws-name" name="name" defaultValue={name} required className={inputClass} />
      </Field>
      <Field label="Cor da marca" htmlFor="ws-color">
        <input id="ws-color" name="brandColor" type="color" defaultValue={brandColor} className="h-11 w-full rounded-xl border border-moveo-border" />
      </Field>
      <SubmitButton>Salvar</SubmitButton>
      <div className="sm:col-span-3">
        <FormError state={state} />
        {state?.ok && <p className="text-sm text-emerald-700">Salvo.</p>}
      </div>
    </form>
  );
}

export function NewWorkspaceForm({ canCreateReal }: { canCreateReal: boolean }) {
  const [state, action] = useFormState(createWorkspaceAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" htmlFor="nw-name">
          <input id="nw-name" name="name" required className={inputClass} />
        </Field>
        <Field label="Tipo" htmlFor="nw-kind">
          <select id="nw-kind" name="kind" className={inputClass} defaultValue="autonomo">
            <option value="autonomo">Profissional autônomo</option>
            <option value="clinica">Clínica</option>
            <option value="estudio">Estúdio</option>
            <option value="academia">Academia</option>
          </select>
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-moveo-ink">Ambiente</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="environment" value="demonstracao" defaultChecked className="mt-1" />
          <span>
            <strong>Demonstração</strong> — somente pessoas e dados fictícios.
          </span>
        </label>
        <label className={`flex items-start gap-2 text-sm ${canCreateReal ? "" : "opacity-60"}`}>
          <input type="radio" name="environment" value="real" disabled={!canCreateReal} className="mt-1" />
          <span>
            <strong>Atendimento real</strong> — exige registro verificado. Funções de mensuração continuam bloqueadas
            até terem liberação registrada para a versão em uso.
          </span>
        </label>
      </fieldset>
      <FormError state={state} />
      <SubmitButton>Criar espaço</SubmitButton>
    </form>
  );
}
