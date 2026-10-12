import type { Metadata } from "next";
import Link from "next/link";
import { MoveoLogo, Notice } from "@/components/platform/ui";

export const metadata: Metadata = { title: "Privacidade" };

const SECTIONS: [string, string[]][] = [
  [
    "Quem trata os dados",
    [
      "O profissional ou a organização que atende você decide sobre o seu acompanhamento. O Moveo fornece a ferramenta. Os papéis exatos de cada parte (controlador e operador) estão sendo definidos com assessoria jurídica para cada tipo de operação.",
    ],
  ],
  [
    "Quais dados",
    [
      "Do profissional: nome, e-mail, profissão, conselho, número de registro e UF.",
      "Da pessoa atendida: nome, contato (e-mail e/ou telefone), cidade/UF opcionais, objetivo do acompanhamento, respostas dadas nas atividades, medidas estimadas e devolutivas do profissional. Dados de saúde são tratados como dados sensíveis.",
      "Não pedimos CPF, endereço completo ou documentos sem finalidade definida.",
    ],
  ],
  [
    "Câmera e vídeo",
    [
      "Nas avaliações por câmera, a imagem é processada no próprio aparelho. O vídeo não é gravado nem enviado; seguem os números estimados, a qualidade da captura, as respostas da pessoa e informações técnicas do aparelho (tipo de navegador e resolução da câmera), usadas para conferir a medida.",
      "A permissão de câmera do navegador é técnica e não substitui o aceite registrado da atividade.",
    ],
  ],
  [
    "Quem acessa",
    [
      "Somente os profissionais com vínculo de atendimento com a pessoa, dentro do mesmo espaço. Outros espaços não veem nem descobrem que a pessoa é atendida em outro lugar.",
      "O link do convite dá acesso apenas à atividade enviada, após confirmação por código.",
      "Acessos e alterações relevantes ficam registrados, sem copiar conteúdo clínico nos registros.",
    ],
  ],
  [
    "O que não fazemos",
    [
      "Não enviamos dados clínicos, vídeos ou textos de atendimento para publicidade ou análise de uso.",
      "Não usamos dados das pessoas atendidas para treinar modelos.",
    ],
  ],
  [
    "Seus direitos",
    [
      "Você pode pedir informações, cópia, correção ou exclusão dos seus dados ao profissional que atende você. Pedidos de exclusão são avaliados considerando as obrigações de guarda de registros profissionais. O canal dedicado para essas solicitações está em implementação.",
    ],
  ],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/">
        <MoveoLogo />
      </Link>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Aviso de privacidade</h1>
      <div className="mt-4">
        <Notice tone="warn" title="Minuta pendente de revisão jurídica">
          Este texto descreve o funcionamento atual do software e ainda não é o aviso definitivo. Não use a
          plataforma com pessoas reais antes da revisão.
        </Notice>
      </div>
      <div className="mt-8 space-y-8">
        {SECTIONS.map(([title, paragraphs]) => (
          <section key={title}>
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-moveo-muted">
              {paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
