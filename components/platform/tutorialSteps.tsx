/**
 * Conteúdo do tutorial de boas-vindas do painel (ver Tutorial.tsx).
 *
 * Cada passo explica uma parte do ciclo principal — cadastrar, solicitar,
 * a pessoa faz no celular, revisar, publicar e reavaliar — e, quando faz
 * sentido, destaca o item do menu onde aquilo fica (`target` = valor do
 * atributo `data-tour` no painel). Os textos acompanham o vocabulário da
 * profissão (paciente/aluno) e o papel no espaço: quem não tem acesso
 * clínico não vê os passos de avaliação.
 */
import type { ReactNode } from "react";

export interface TutorialInfo {
  firstName: string;
  person: string;
  persons: string;
  /** Artigo de `person` ("o" paciente, "a" pessoa atendida). */
  article: "o" | "a";
  episode: string;
  council: string;
  /** Tem perfil profissional (conselho e registro). Assistentes podem não ter. */
  hasProfile: boolean;
  clinical: boolean;
  isGestor: boolean;
  isDemo: boolean;
}

export interface TutorialStep {
  id: string;
  title: string;
  body: ReactNode;
  visual?: ReactNode;
  /** Valor de `data-tour` do elemento destacado enquanto o passo está aberto. */
  target?: string;
  /** Último passo: botão principal que fecha o tutorial e leva a uma página. */
  cta?: { href: string; label: string };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildTutorialSteps(i: TutorialInfo): TutorialStep[] {
  const Ps = cap(i.persons);
  const oP = `${i.article} ${i.person}`; // "o paciente"
  const doP = `d${oP}`; // "do paciente"
  const aoP = i.article === "o" ? `ao ${i.person}` : `à ${i.person}`; // "ao paciente"

  const steps: (TutorialStep | false)[] = [
    {
      id: "boas-vindas",
      title: `Boas-vindas ao Moveo, ${i.firstName}!`,
      body: (
        <>
          <p>
            Em poucos passos, mostramos como a plataforma funciona e onde fica cada coisa. Leva uns 2 minutos — e
            você pode rever quando quiser em <strong>Como funciona</strong>, no menu.
          </p>
          <p>O caminho principal tem cinco etapas:</p>
        </>
      ),
      visual: (
        <ol className="space-y-2">
          {(i.clinical
            ? [
                [`Você cadastra ${oP}`, "Nome, contato e o objetivo do acompanhamento."],
                ["Solicita uma avaliação", "Escolhe os movimentos e gera um convite individual."],
                [`${cap(oP)} faz pelo celular`, "Com a câmera, sem instalar aplicativo."],
                ["Você revisa as medidas", "Aceita, corrige ou descarta cada uma."],
                ["Publica a devolutiva", "E compara com as reavaliações seguintes."],
              ]
            : [
                [`A equipe cadastra ${oP}`, "Nome, contato e o objetivo do acompanhamento."],
                ["O profissional solicita uma avaliação", "Escolhe os movimentos e gera um convite individual."],
                [`${cap(oP)} faz pelo celular`, "Com a câmera, sem instalar aplicativo."],
                ["O profissional revisa as medidas", "Aceita, corrige ou descarta cada uma."],
                ["E publica a devolutiva", "Depois, compara com as reavaliações seguintes."],
              ]
          ).map(([t, d], n) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-moveo-primary text-xs font-bold text-white">
                {n + 1}
              </span>
              <span className="min-w-0 text-sm leading-snug">
                <span className="block font-semibold text-moveo-ink">{t}</span>
                <span className="block text-moveo-muted">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      ),
    },

    i.isDemo
      ? {
          id: "espaco",
          target: "espaco-atual",
          title: "Você está num espaço de demonstração",
          body: (
            <>
              <p>
                {i.hasProfile ? "Toda conta nova começa aqui, para você testar sem risco." : "Aqui dá para testar sem risco."} Use{" "}
                <strong>só pessoas e dados fictícios</strong>
                {i.clinical && <> — uma boa ideia é cadastrar a si mesmo como {i.person} e fazer a avaliação no seu celular</>}.
              </p>
              <p>
                {i.hasProfile
                  ? `Para atender pessoas reais, seu registro no ${i.council} precisa ser conferido (a conferência é manual). Depois disso, você cria um espaço de atendimento real; os dois nunca se misturam.`
                  : "O atendimento de pessoas reais acontece num espaço separado, criado por um profissional com registro verificado; os dois nunca se misturam."}
              </p>
            </>
          ),
          visual: (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-violet-50 p-3 ring-1 ring-inset ring-violet-200">
                <p className="font-semibold text-violet-800">Demonstração</p>
                <p className="mt-1 text-violet-800/80">Agora. Dados fictícios, para testar à vontade.</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-inset ring-emerald-200">
                <p className="font-semibold text-emerald-800">Atendimento real</p>
                <p className="mt-1 text-emerald-800/80">Depois que o registro for verificado.</p>
              </div>
            </div>
          ),
        }
      : {
          id: "espaco",
          target: "espaco-atual",
          title: "Seu espaço de atendimento",
          body: (
            <p>
              O espaço reúne a equipe, as {i.persons} e as avaliações. Se você participa de mais de um, é aqui que
              você troca de espaço.
            </p>
          ),
        },

    i.clinical && {
      id: "hoje",
      target: "hoje",
      title: "Hoje: o que depende de você",
      body: (
        <p>
          É a primeira tela ao entrar. Reúne as pendências: resultados para revisar, atividades para refazer, prazos
          ou convites vencidos e o que ainda está aguardando {oP}.
        </p>
      ),
      visual: (
        <div className="grid grid-cols-2 gap-2">
          {[
            ["2", "Para revisar"],
            ["1", "Para refazer"],
            ["0", "Prazo vencido"],
            ["3", Ps],
          ].map(([n, l]) => (
            <div key={l} className="rounded-xl border border-moveo-border bg-white px-3 py-2">
              <p className="text-lg font-bold leading-tight text-moveo-ink">{n}</p>
              <p className="text-xs text-moveo-muted">{l}</p>
            </div>
          ))}
        </div>
      ),
    },

    {
      id: "pessoas",
      target: "pessoas",
      title: `${Ps}: cadastro e ficha`,
      body: (
        <>
          <p>
            Cadastre quem você atende com nome, contato (e-mail ou celular) e o canal preferido para receber
            convites.
          </p>
          <p>
            {i.clinical
              ? `Na ficha de cada ${i.person} ficam o ${i.episode}, os consentimentos e a linha do tempo das avaliações.`
              : "Avaliações, medidas e devolutivas ficam com os profissionais vinculados — seu papel cuida do cadastro."}
          </p>
        </>
      ),
      visual: (
        <div className="rounded-xl border border-moveo-border bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-moveo-ink">Joana Exemplo</p>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-800 ring-1 ring-inset ring-violet-200">
              fictício
            </span>
          </div>
          <p className="text-xs text-moveo-muted">WhatsApp · (11) 90000-0000</p>
          {i.clinical && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-lg bg-moveo-primary px-2 py-1 text-[11px] font-semibold text-white">Solicitar avaliação</span>
              <span className="rounded-lg border border-moveo-border px-2 py-1 text-[11px] font-semibold text-moveo-ink">
                Registrar medição presencial
              </span>
            </div>
          )}
        </div>
      ),
    },

    i.clinical && {
      id: "solicitar",
      title: "Solicitar uma avaliação",
      body: (
        <p>
          Na ficha {doP}, toque em <strong>Solicitar avaliação</strong>. Escolha a região, os movimentos e lados, o
          prazo, se precisa de supervisão ao vivo e, se quiser, orientações que aparecem antes de começar.
        </p>
      ),
      visual: (
        <div className="space-y-2 rounded-xl border border-moveo-border bg-white p-3 text-xs">
          <div className="flex flex-wrap gap-1.5">
            {["Ombro", "Joelho", "Tronco", "Postura sentada"].map((r, n) => (
              <span
                key={r}
                className={`rounded-full px-2.5 py-1 font-medium ${
                  n === 0 ? "bg-moveo-primary text-white" : "bg-moveo-bg text-moveo-muted ring-1 ring-inset ring-moveo-border"
                }`}
              >
                {r}
              </span>
            ))}
          </div>
          {[
            ["Flexão · direito", true],
            ["Flexão · esquerdo", true],
            ["Elevação lateral · direito", false],
          ].map(([l, on]) => (
            <p key={l as string} className="flex items-center gap-2 text-moveo-ink">
              <span
                aria-hidden
                className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                  on ? "border-moveo-primary bg-moveo-primary text-white" : "border-moveo-border bg-white"
                }`}
              >
                {on ? "✓" : ""}
              </span>
              {l}
            </p>
          ))}
          <p className="text-moveo-muted">Prazo: 7 dias · sem supervisão</p>
        </div>
      ),
    },

    i.clinical && {
      id: "convite",
      title: "Link e código: sempre separados",
      body: (
        <>
          <p>
            Ao criar a solicitação, aparecem um <strong>link</strong> e um <strong>código de 6 dígitos</strong>.
            Envie o link (pelo WhatsApp, por exemplo) e passe o código por outro meio: pessoalmente, por ligação ou
            em outra mensagem.
          </p>
          <p>
            Sem o código, o link não abre nada; depois de 5 tentativas erradas, o convite bloqueia. Link e código
            só aparecem nessa hora — se perder, é só gerar um novo.
          </p>
        </>
      ),
      visual: (
        <div className="space-y-2">
          <div className="rounded-xl border-2 border-dashed border-moveo-primary/50 bg-white p-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-moveo-muted">Código de acesso</p>
            <p className="font-mono text-2xl font-bold tracking-[0.3em] text-moveo-ink">482913</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-inset ring-moveo-border">
            <code className="min-w-0 flex-1 truncate text-[11px] text-moveo-muted">moveo…/convite/k3J9x…</code>
            <span className="flex-none rounded-lg bg-moveo-primary px-2 py-1 text-[11px] font-semibold text-white">Abrir no WhatsApp</span>
          </div>
        </div>
      ),
    },

    i.clinical && {
      id: "celular",
      title: `O que ${oP} faz no celular`,
      body: (
        <>
          <p>
            Abre o link, digita o código e registra os aceites (atendimento a distância e uso da câmera). Depois
            segue as instruções na tela — sem instalar aplicativo nem criar conta.
          </p>
          <p>
            A câmera analisa o movimento no próprio aparelho: <strong>o vídeo não é enviado</strong>, só as medidas e
            as respostas. Se as perguntas de segurança indicarem risco, a atividade para e aparece para você em{" "}
            <strong>Para refazer</strong>.
          </p>
        </>
      ),
      visual: (
        <div className="mx-auto w-44 rounded-[1.6rem] border-4 border-moveo-ink bg-white p-2.5 shadow-sm">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-moveo-border" />
          <ol className="space-y-1.5 text-[11px]">
            {[
              ["Código", true],
              ["Aceites", true],
              ["Movimentos com a câmera", false],
              ["Enviado ao profissional", false],
            ].map(([l, done], n) => (
              <li key={l as string} className="flex items-center gap-1.5">
                <span
                  className={`flex h-4 w-4 flex-none items-center justify-center rounded-full text-[9px] font-bold ${
                    done ? "bg-moveo-primary text-white" : "bg-moveo-bg text-moveo-muted ring-1 ring-inset ring-moveo-border"
                  }`}
                >
                  {done ? "✓" : n + 1}
                </span>
                <span className={done ? "text-moveo-muted" : "font-medium text-moveo-ink"}>{l}</span>
              </li>
            ))}
          </ol>
        </div>
      ),
    },

    i.clinical && {
      id: "revisar",
      title: "Revise antes de publicar",
      body: (
        <>
          <p>
            O resultado chega em <strong>Hoje → Para revisar</strong>. Em cada medida, você <strong>aceita</strong>,{" "}
            <strong>corrige</strong> (com justificativa) ou <strong>descarta</strong> — o valor original sempre fica
            guardado.
          </p>
          <p>
            Nada chega {aoP} antes de você publicar a <strong>devolutiva</strong>, com as medidas revisadas se
            quiser. Também dá para gerar um relatório para imprimir ou salvar em PDF.
          </p>
        </>
      ),
      visual: (
        <div className="space-y-2 rounded-xl border border-moveo-border bg-white p-3 text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-moveo-ink">Flexão do ombro · direito</span>
            <span className="font-mono font-semibold text-moveo-ink">152°</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Aceitar", "Corrigir", "Descartar"].map((l, n) => (
              <span
                key={l}
                className={`rounded-full px-2.5 py-1 font-medium ${
                  n === 0 ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200" : "bg-moveo-bg text-moveo-muted ring-1 ring-inset ring-moveo-border"
                }`}
              >
                {l}
              </span>
            ))}
          </div>
          <div className="border-t border-moveo-border pt-2 text-right">
            <span className="rounded-lg bg-moveo-primary px-2.5 py-1 font-semibold text-white">Publicar devolutiva</span>
          </div>
        </div>
      ),
    },

    i.clinical && {
      id: "reavaliar",
      title: "Reavalie e compare",
      body: (
        <>
          <p>
            Numa avaliação já feita, use <strong>Solicitar reavaliação</strong>: ela repete o mesmo protocolo e os
            mesmos movimentos, para que os resultados possam ser comparados. A plataforma só compara medidas
            compatíveis e mostra o motivo quando não dá — a interpretação é sempre sua.
          </p>
          <p>
            Mediu com goniômetro ou inclinômetro? Use <strong>Registrar medição presencial</strong>, na ficha {doP}.
          </p>
        </>
      ),
      visual: (
        <div className="overflow-hidden rounded-xl border border-moveo-border bg-white text-xs">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-moveo-border bg-moveo-bg px-3 py-1.5 font-medium uppercase tracking-wide text-moveo-muted">
            <span>Medida</span>
            <span>Antes → depois</span>
            <span>Diferença</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2 text-moveo-ink">
            <span>Flexão · D</span>
            <span className="font-mono">138° → 152°</span>
            <span className="font-mono">+14°</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-x-3 border-t border-moveo-border px-3 py-2">
            <span className="text-moveo-ink">Flexão · E</span>
            <span className="text-moveo-muted">não comparável: captura insuficiente</span>
          </div>
        </div>
      ),
    },

    {
      id: "equipe",
      target: "equipe",
      title: i.isGestor ? "Equipe, espaço e perfil" : "Equipe e perfil",
      body: (
        <>
          <p>
            {i.isGestor && `Em Espaço, ajuste o nome e a cor que ${oP} vê no convite. `}
            {i.hasProfile ? "Em Meu perfil ficam seus dados e a situação do registro profissional." : "Em Meu perfil ficam seus dados."}
          </p>
          <p>
            {i.isGestor
              ? "Em Equipe, você adiciona colegas ao espaço (cada um cria a própria conta no Moveo antes). O papel define o que cada um pode fazer:"
              : "Em Equipe, você vê quem participa do espaço e o papel de cada um:"}
          </p>
        </>
      ),
      visual: (
        <ul className="space-y-1.5 text-xs">
          {[
            ["Gestor", "equipe, vínculos e configurações do espaço"],
            ["Profissional", "avaliações, revisões e devolutivas"],
            ["Assistente", "cadastro, sem acesso a dados de avaliação"],
          ].map(([r, d]) => (
            <li key={r} className="flex items-start gap-2">
              <span className="w-24 flex-none rounded-full bg-slate-100 px-2 py-0.5 text-center font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                {r}
              </span>
              <span className="pt-0.5 text-moveo-muted">{d}</span>
            </li>
          ))}
          <li className="pt-1 text-moveo-muted">O acesso clínico depende sempre do vínculo com {oP}.</li>
        </ul>
      ),
    },

    {
      id: "fim",
      target: "tutorial",
      title: "Tudo pronto!",
      body: (
        <>
          <p>
            Um lembrete importante: as medidas por câmera são <strong>estimativas do movimento observado</strong>.
            Não fazem diagnóstico e ainda não têm validação clínica — o seu julgamento profissional vem sempre
            primeiro.
          </p>
          {i.isDemo && (
            <p>
              Para começar, cadastre {i.article === "o" ? "um" : "uma"} {i.person} fictíci{i.article}
              {i.clinical
                ? " com o seu próprio contato e envie uma avaliação para você mesmo: assim você vê as duas pontas."
                : "."}
            </p>
          )}
          <p>
            Para rever este tutorial, use <strong>Como funciona</strong> (destacado no menu).
          </p>
        </>
      ),
      cta: { href: "/painel/pessoas/nova", label: `Cadastrar ${i.person}` },
    },
  ];

  return steps.filter((s): s is TutorialStep => !!s);
}
