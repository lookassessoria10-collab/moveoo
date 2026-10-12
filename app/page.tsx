import Link from "next/link";
import { LinkButton, MoveoLogo } from "@/components/platform/ui";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Você define a avaliação",
    text: "Cadastre a pessoa, registre o objetivo do acompanhamento e escolha o protocolo, o prazo e as orientações.",
  },
  {
    title: "A pessoa realiza pelo celular",
    text: "Ela recebe um convite individual, confirma o acesso com um código e segue as instruções na tela. Sem aplicativo.",
  },
  {
    title: "Você revisa antes de publicar",
    text: "O resultado chega como provisório, com método, qualidade da captura e versões. Você aceita, corrige ou descarta cada medida.",
  },
  {
    title: "A devolutiva e a reavaliação ficam no histórico",
    text: "A pessoa vê a sua orientação. Reavaliações com o mesmo protocolo são comparadas lado a lado — ou o sistema explica por que não são comparáveis.",
  },
];

const PRINCIPLES = [
  ["Revisão humana sempre", "Nenhum número chega à pessoa atendida sem a sua revisão. Correções preservam o valor original e a justificativa."],
  ["Origem do dado à vista", "Cada medida mostra se veio da câmera, de uma medição sua ou de uma demonstração — e com qual versão do protocolo e do cálculo."],
  ["Captura ruim não vira número", "Quando a imagem não sustenta o cálculo, a medida fica sem valor e com o motivo registrado. Nunca aparece como 0°."],
  ["Vídeo fica no aparelho", "Nas avaliações por câmera, a imagem é processada no próprio celular. Seguem os números estimados, as respostas da pessoa e dados técnicos do aparelho — nunca imagens."],
  ["Acesso por vínculo", "Cada espaço vê só os próprios registros, e cada profissional vê apenas quem atende. O convite não abre o histórico completo."],
  ["Sem diagnóstico automático", "A ferramenta descreve o movimento observado. A interpretação, a conduta e a prescrição são suas."],
];

export default async function Landing() {
  const user = await getCurrentUser();
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <MoveoLogo />
        <nav className="flex items-center gap-2 text-sm">
          <a href="#como-funciona" className="hidden px-3 py-2 text-moveo-muted hover:text-moveo-ink sm:inline">
            Como funciona
          </a>
          <a href="#perfis" className="hidden px-3 py-2 text-moveo-muted hover:text-moveo-ink sm:inline">
            Para quem é
          </a>
          {user ? (
            <LinkButton href="/painel">Abrir painel</LinkButton>
          ) : (
            <>
              <Link href="/entrar" className="px-3 py-2 font-medium text-moveo-ink hover:text-moveo-primary">
                Entrar
              </Link>
              <LinkButton href="/cadastro">Criar conta</LinkButton>
            </>
          )}
        </nav>
      </header>

      <section className="bg-gradient-to-b from-moveo-primarySoft/70 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-moveo-primary">
              Fisioterapia · Educação física
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-moveo-ink sm:text-5xl">
              Acompanhe o movimento de quem você atende, também entre as sessões.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-moveo-muted">
              Solicite avaliações pelo celular da pessoa, revise cada resultado antes de publicar e compare
              reavaliações com o mesmo protocolo — tudo organizado num histórico por pessoa.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/cadastro" className="px-6 py-3 text-base">
                Criar conta de profissional
              </LinkButton>
              <LinkButton href="#como-funciona" variant="ghost" className="px-6 py-3 text-base">
                Ver como funciona
              </LinkButton>
            </div>
            <p className="mt-4 text-xs text-moveo-muted">
              Em desenvolvimento. Contas novas começam num espaço de demonstração, com dados fictícios.
            </p>
          </div>
          <div aria-hidden className="relative mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-moveo-border bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-moveo-ink">Ombro — reavaliação</p>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                  Aguardando sua revisão
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  ["Flexão · direito", "97°", "110°", "+13°"],
                  ["Flexão · esquerdo", "142°", "—", "sem valor válido"],
                  ["Elevação lateral · direito", "88°", "101°", "+13°"],
                ].map(([label, a, b, d]) => (
                  <div key={label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-xl bg-moveo-bg px-3 py-2">
                    <span className="text-moveo-ink">{label}</span>
                    <span className="text-moveo-muted">{a}</span>
                    <span className="font-semibold text-moveo-ink">{b}</span>
                    <span className="text-xs text-moveo-muted">{d}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-moveo-muted">
                Exemplo fictício. Câmera do celular (estimativa 2D) · protocolo ombro-camera 1.0.0
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight">Como funciona</h2>
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-moveo-border bg-white p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-moveo-primary text-sm font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold text-moveo-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-moveo-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="perfis" className="bg-moveo-bg">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-moveo-primary">Fisioterapia</p>
            <h3 className="mt-2 text-xl font-bold">Episódios de cuidado com avaliação, devolutiva e reavaliação</h3>
            <ul className="mt-4 space-y-2 text-sm text-moveo-muted">
              <li>• Pacientes organizados por episódio, com modalidade (presencial, remoto ou híbrido) e sua decisão sobre a adequação do remoto.</li>
              <li>• Avaliação por câmera ou medição presencial com goniômetro/inclinômetro, cada uma identificada.</li>
              <li>• Consentimento do atendimento a distância registrado com versão do texto e data.</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-moveo-primary">Educação física</p>
            <h3 className="mt-2 text-xl font-bold">Objetivos de treino com avaliação de movimento comparável</h3>
            <ul className="mt-4 space-y-2 text-sm text-moveo-muted">
              <li>• Alunos com objetivos de treino e avaliações de mobilidade e agachamento pelo celular.</li>
              <li>• Revisão técnica com a sua orientação publicada para o aluno.</li>
              <li>• Reavaliação com o mesmo protocolo para acompanhar a evolução.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight">Princípios</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-moveo-border p-5">
              <h3 className="font-semibold text-moveo-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-moveo-muted">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-2xl bg-moveo-primarySoft p-6 text-sm leading-relaxed text-moveo-ink">
          <p className="font-semibold">Situação atual</p>
          <p className="mt-1">
            As estimativas por câmera ainda não passaram por validação clínica e não estão liberadas para
            atendimento real. Enquanto isso, a plataforma funciona em espaços de demonstração com dados fictícios.
            Planos e preços estão em definição.
          </p>
        </div>
      </section>

      <footer className="border-t border-moveo-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-moveo-muted sm:px-6">
          <MoveoLogo className="opacity-80" />
          <div className="flex flex-wrap gap-4">
            <Link href="/privacidade" className="hover:text-moveo-ink">
              Privacidade
            </Link>
            <Link href="/assessment" className="hover:text-moveo-ink">
              Avaliação livre (UORT)
            </Link>
            <Link href="/entrar" className="hover:text-moveo-ink">
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
