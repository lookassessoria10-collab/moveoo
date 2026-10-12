# Moveo — acompanhamento de movimento para fisioterapia e educação física

Plataforma em que o profissional cadastra quem atende, envia avaliações
pelo celular da pessoa, revisa cada resultado antes de publicar e compara
reavaliações. A pessoa atendida acessa por um convite individual, sem
aplicativo. **Em desenvolvimento, apenas com dados fictícios** — as
medidas por câmera não têm validação clínica nem liberação para uso real.

- Arquitetura, modelo de dados, telas e próximos passos: [`docs/plataforma.md`](docs/plataforma.md)
- Auditoria do código herdado (inclui achados de precisão): [`docs/auditoria.md`](docs/auditoria.md)
- Documentação regulatória, qualidade, privacidade e PI: `docs/regulatorio`, `docs/qualidade`, `docs/privacidade`, `docs/seguranca`, `docs/validacao`, `docs/propriedade-intelectual`

## Rodar a plataforma localmente

```bash
npm install
npm run db:reset   # cria .data/pglite (PostgreSQL embutido) com o cenário fictício
npm run dev
```

- `http://localhost:3000` — página institucional; `/entrar` — área do profissional.
- Contas fictícias: `ana.fisio@moveo.test` (gestora, fisioterapia), `bruno.fisio@moveo.test`, `carla.recepcao@moveo.test` (assistente), `diego.ef@moveo.test` (educação física, outro espaço), `admin@moveo.test` (administração). Senha: `DEMO_PASSWORD` em [`db/seed-data.ts`](db/seed-data.ts).
- Nada é enviado de verdade: convites, códigos e confirmações aparecem em `http://localhost:3000/dev/caixa-de-saida`.
- Pare o `npm run dev` antes de `npm run db:reset` (o banco local não aceita dois processos).

### Hospedar nesta máquina (versão otimizada)

```bash
npm run local        # gera o build e sobe em http://localhost:3000
npm run local:start  # só sobe (quando o build já existe)
```

Requer o arquivo `.env.local` com `MOVEO_AMBIENTE=local` (modelo em `.env.example`; o arquivo não vai para o Git). Nesse modo a caixa de saída continua visível e o login funciona pela rede Wi-Fi sem HTTPS: no celular, abra `http://<IP-do-computador>:3000` (o Windows pode pedir para liberar o Node.js no firewall de rede privada). Para os links de convite funcionarem no celular, abra o painel pelo IP da rede (não por `localhost`) ou defina `MOVEO_BASE_URL`. A câmera do celular só funciona com HTTPS — pela rede local sem HTTPS, a pessoa consegue entrar e aceitar, mas a captura cai na opção "avisar o profissional".
- `npm test` roda os testes (inclui isolamento entre organizações com PostgreSQL em memória); `npm run typecheck` confere os tipos; `npm run db:generate` gera migração após mudar `db/schema.ts`.

---

# Módulos de avaliação (herdados da UORT)

Os quatro módulos abaixo continuam disponíveis como **avaliação livre** em
`/assessment` (marca UORT) e são reaproveitados, sem mudança de cálculo,
dentro do acompanhamento da plataforma.

Aplicação web mobile-first que usa apenas a câmera do celular (via
MediaPipe Pose Landmarker, rodando inteiramente no navegador) para medir
características **funcionais** do movimento: amplitude aproximada,
assimetria entre lados, velocidade, compensações, consistência entre
repetições e alinhamento observado.

**A aplicação não diagnostica lesões, doenças ou condições médicas**, não
identifica gravidade anatômica e não substitui avaliação profissional. Ela
descreve apenas o movimento observado durante o teste.

Quatro regiões estão disponíveis hoje, cada uma como um módulo independente
sobre a mesma infraestrutura de câmera/visão computacional:

| Região | Rota | Testes |
| --- | --- | --- |
| Ombro | `/assessment/shoulder` | Flexão, abdução (por lado, 3 reps) |
| Joelho | `/assessment/knee` | Flexão/extensão (por lado), agachamento, sentar e levantar |
| Coluna | `/assessment/spine` | Flexão anterior, inclinação lateral (dir./esq.), extensão confortável |
| Postura sentada | `/assessment/posture` | Captura única (tronco/pescoço), voltada para uso corporativo/ergonômico |

O nome do produto ("UORT") e todos os textos, cores, CTA e limites
experimentais da plataforma ficam centralizados em
[`config/app.ts`](config/app.ts); cada módulo tem sua própria configuração
em `config/modules/<região>.ts`.

## Testar os módulos no celular

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Para testar no celular, garanta que o
computador e o celular estejam na mesma rede Wi-Fi e acesse
`http://<IP-do-computador>:3000` (o `next dev` escuta em todas as
interfaces de rede por padrão). Como `getUserMedia` exige HTTPS ou
`localhost` em navegadores móveis, para testar fora da rede local será
necessário publicar em HTTPS (ex.: Vercel) ou usar um túnel HTTPS (ex.:
`ngrok`) apontando para a porta 3000.

## Como publicar na Vercel

> **Atenção — vale só para a versão antiga, sem a plataforma.** A
> plataforma usa um PostgreSQL embutido (PGlite) que grava em disco local;
> em hospedagem serverless esse disco é temporário e os dados se perdem.
> Antes de publicar a plataforma é preciso trocar para um PostgreSQL
> gerenciado (ver `docs/plataforma.md`, seção 2) e cumprir os itens de
> segurança e regulatórios pendentes. Não publique esta branch como está.

1. Suba o conteúdo desta pasta em um repositório Git (já configurado —
   ver [github.com/lookassessoria10-collab/moveo](https://github.com/lookassessoria10-collab/moveo)).
2. Importe o repositório em [vercel.com/new](https://vercel.com/new).
3. Nenhuma variável de ambiente é necessária — todo o processamento de
   câmera acontece no navegador do usuário.
4. Build command padrão (`next build`) e output padrão do framework Next.js
   funcionam sem configuração adicional.

## Arquitetura dos módulos

```
app/
  assessment/page.tsx         → seleção de região da avaliação livre (RegionSelectScreen)
  assessment/
    shoulder/page.tsx         → módulo Ombro
    knee/page.tsx             → módulo Joelho
    spine/page.tsx            → módulo Coluna

lib/            → núcleo compartilhado entre todos os módulos
  types.ts                    → Point2D, FrameLandmarks (33→18 pontos), PainDuringMovement
  geometry.ts                 → matemática de ângulo/vetor genérica
  angles.ts                   → ângulos do ombro + calculateTrunkAngle (reaproveitado por joelho/coluna)
  smoothing.ts                → EMA para landmarks, média móvel para ângulos
  movementDetection.ts        → máquina de estados de repetição (genérica)
  trunkCompensation.ts        → classificação de compensação (genérica, thresholds injetáveis)
  movementMetrics.ts          → duração, velocidade, consistência, diferença entre lados (genéricas)
  safety.ts                   → hasSafetyConcern() genérico para qualquer conjunto de respostas
  positioning.ts              → checagem de enquadramento específica do ombro
  resultRules.ts              → painLabel() (genérico) + geração de resumo do ombro
  pose/
    loadPoseLandmarker.ts     → carrega o PoseLandmarker do MediaPipe (singleton)
    convertLandmarks.ts       → converte os 33 landmarks brutos para o formato interno
    usePoseLandmarker.ts      → hook do loop de detecção (requestAnimationFrame)

hooks/useCamera.ts             → getUserMedia (compartilhado)
stores/appStore.ts              → estado mínimo da plataforma (fora dos módulos)
components/
  ui/, PainScale.tsx           → primitivos de UI compartilhados
  shared/                      → SafetyBlockedScreen e ProcessingScreen genéricos (joelho/coluna)
  RegionSelectScreen.tsx       → tela inicial (os 3 cards de região)
  AssessmentFlow.tsx, CameraFlow.tsx, screens/*  → módulo Ombro (original, inalterado)

modules/
  knee/    → tipos, ângulos, regras de resultado, store, dados de demo e telas do Joelho
  spine/   → idem para a Coluna

config/
  app.ts                       → config da plataforma + protocolo/thresholds do Ombro (histórico)
  modules/knee.ts               → protocolo/thresholds do Joelho
  modules/spine.ts              → protocolo/thresholds da Coluna
```

### Por que o ombro não foi movido para `modules/shoulder/`

O módulo de ombro já existia, publicado e funcionando, antes desta
ampliação. Para minimizar risco de regressão, ele **não foi movido nem
reescrito** — continua em `components/` e `stores/assessmentStore.ts`,
exatamente como estava. A generalização do núcleo compartilhado (`lib/`)
foi feita de forma **aditiva**: novos campos, parâmetros opcionais com
valor padrão idêntico ao comportamento anterior, nunca removendo ou
renomeando algo que o ombro já usava. Os módulos de Joelho e Coluna,
sendo código novo, já nascem em `modules/<região>/`, seguindo a
convenção pedida para o crescimento da plataforma.

### Núcleo compartilhado entre os módulos

- **Câmera**: `hooks/useCamera.ts` (getUserMedia, sem gravação).
- **Pose**: `lib/pose/*` — carrega o MediaPipe Pose Landmarker uma única
  vez e converte os 33 landmarks do BlazePose para os 18 pontos usados
  pela aplicação (nariz, orelhas, ombros, cotovelos, punhos, quadris,
  joelhos, tornozelos, calcanhares, pontas dos pés). O ombro usa apenas o
  subconjunto que sempre usou; joelho e coluna usam os pontos das pernas
  e do tronco.
- **Suavização**: `lib/smoothing.ts` (EMA por landmark + média móvel do
  ângulo calculado), igual para os três módulos.
- **Detecção de repetição**: `lib/movementDetection.ts` — uma máquina de
  estados `IDLE → READY → ASCENDING → PEAK → DESCENDING → COMPLETED` que
  recebe qualquer sinal numérico (ângulo, ou combinação de ângulos) e
  detecta início/pico/retorno automaticamente, sem depender de botões.
  Cada módulo configura seus próprios limiares de sensibilidade.
- **Compensação do tronco**: `lib/trunkCompensation.ts` — genérica sobre
  qualquer frame que tenha um campo `trunkAngle`; aceita limites e uma
  função de "ângulo principal" por parâmetro (com padrão compatível com o
  ombro), para que joelho e coluna possam usar seus próprios limites.
- **Métricas**: `lib/movementMetrics.ts` — duração, velocidade angular,
  consistência entre repetições, diferença entre lados. Já eram genéricas
  (trabalham com números), reaproveitadas sem alteração.
- **Segurança**: `lib/safety.ts` — `hasSafetyConcern()` agora aceita
  qualquer conjunto de respostas booleanas (cada módulo define suas
  próprias perguntas).
- **Qualidade/posicionamento**: cada módulo faz sua própria checagem de
  enquadramento (landmarks visíveis, orientação frontal ou lateral),
  porque os requisitos de câmera diferem bastante entre "ver os dois
  ombros" e "ver quadril, joelho e tornozelo de perfil".

## Como funciona o MediaPipe

- Usa `@mediapipe/tasks-vision` (`PoseLandmarker`), carregado no navegador
  a partir de CDNs públicas (`jsdelivr` para o runtime wasm,
  `storage.googleapis.com` para o modelo `pose_landmarker_full`).
- A detecção roda em `runningMode: "VIDEO"`, chamando `detectForVideo` a
  cada frame dentro de um loop de `requestAnimationFrame`.
- O eixo X é espelhado na conversão dos landmarks porque o vídeo é exibido
  em modo espelho (como em qualquer app de câmera frontal) — overlay,
  ângulos e vídeo ficam no mesmo referencial.
- Nenhum vídeo, frame ou imagem é enviado a um servidor (ver "Privacidade").

## Como os ângulos são calculados

- **Ombro** (flexão/abdução): ângulo no vértice do ombro entre o vetor
  ombro→quadril (eixo do tronco) e o vetor ombro→cotovelo.
- **Joelho** (`modules/knee/angles.ts`): ângulo bruto quadril-joelho-
  tornozelo; convertido para "graus de flexão" (0° = perna estendida,
  crescente conforme dobra) apenas para exibição.
- **Coluna** (`modules/spine/angles.ts`): reaproveita a mesma
  `calculateTrunkAngle()` do ombro (ângulo da linha ombro-médio↔quadril-
  médio em relação à vertical) sem nenhuma alteração de código — o que
  muda é a orientação da câmera pedida ao usuário: de lado para
  flexão/extensão (plano sagital), de frente para inclinação lateral
  (plano frontal). Essa é a forma mais honesta de medir cada plano com uma
  única câmera 2D.

Todos os ângulos são **estimativas de amplitude por visão computacional
2D**, não goniometria clínica certificada. Uma câmera 2D não separa
perfeitamente planos de movimento nem isola segmentos articulares — por
isso cada teste tem uma orientação de câmera específica (indicada na tela
de reposicionamento) e os textos sempre dizem "amplitude estimada"/
"movimento observado", nunca um valor clínico exato.

## Compensação, consistência e índices experimentais

Compensação do tronco/quadril é classificada como **mínima / moderada /
elevada** a partir de limites configuráveis por módulo
(`config/app.ts` para o ombro, `config/modules/knee.ts` e
`config/modules/spine.ts` para os demais). Consistência entre repetições
usa o desvio padrão relativo dos ângulos máximos. **Todos esses limites
são experimentais, ainda não validados clinicamente**, e servem apenas
para destaque visual — nunca como critério diagnóstico. O código comenta
isso explicitamente em cada arquivo de configuração.

O **Índice de Movimento** (0–100, apenas no módulo Ombro) é explicitamente
experimental — combina assimetria, amplitude, consistência e compensação
só para a própria pessoa comparar seus testes ao longo do tempo. Não é um
score de saúde, gravidade ou lesão, não é comparado a valores
populacionais, e **não existe um índice equivalente para joelho ou coluna**
neste momento — não há base para um score único e comparável entre
regiões tão diferentes.

## Limitações da câmera 2D

- Uma câmera única não mede profundidade nem separa planos de movimento
  com precisão — os ângulos são estimativas, sensíveis à orientação da
  câmera em relação ao corpo (por isso cada teste indica frontal ou
  lateral).
- Iluminação ruim, roupas largas, enquadramento incorreto ou perda de
  landmarks reduzem a confiabilidade da medição.
- Nenhuma distância é calculada em metros: usa-se a visibilidade e a
  posição relativa dos landmarks no frame para orientar o
  posicionamento ("aproxime-se", "afaste-se", "vire-se de lado").
- Quando uma métrica não pode ser calculada com confiança (ex.: nenhuma
  compensação relevante detectada), a interface mostra "não detectada" em
  vez de inventar um valor.
- No módulo Coluna em particular, uma câmera 2D não isola segmentos da
  coluna vertebral — os testes descrevem "movimento do tronco", nunca
  "flexão lombar" ou qualquer segmento específico.

## Limitações clínicas

Esta ferramenta **não diagnostica** lesões, doenças ou condições médicas
(nenhuma região), e não deve ser usada como critério isolado para decisões
de saúde. Ela descreve apenas o movimento observado durante o teste
(amplitude, assimetria, velocidade, compensação, consistência, alinhamento
observado e dor autorrelatada). Antes de cada teste, perguntas de
segurança específicas da região podem interromper a avaliação e recomendar
buscar avaliação profissional — nunca tentam diagnosticar a causa.

## Privacidade

- Todo o processamento de pose acontece localmente no navegador
  (MediaPipe Tasks Vision roda via WebAssembly/WebGL no dispositivo).
- Nenhum vídeo, frame ou imagem é gravado ou enviado a um servidor.
- Apenas landmarks, ângulos, timestamps, resultados calculados e respostas
  do usuário ficam em memória (estado do Zustand), durante a sessão.
- Não há banco de dados neste momento: ao fechar ou recarregar a página,
  os dados são descartados. O modelo de dados já foi desenhado para que,
  no futuro, seja possível persistir e comparar testes ao longo do tempo
  sem reestruturar tudo (cada resultado já carrega `completedAt`,
  respostas de intake e métricas discretas, prontos para serialização).

## Modo Demonstração

Se a câmera não estiver disponível (ex.: desktop sem webcam, permissão
negada, ou nenhuma câmera detectada), a interface de cada módulo oferece
"Continuar em modo demonstração", que carrega um resultado fictício
próprio daquele módulo (`lib/demoData.ts`, `modules/knee/demoData.ts`,
`modules/spine/demoData.ts`). A tela de resultados sempre exibe um aviso
"Modo demonstração — resultados fictícios" nesse caso, e dados reais e
fictícios nunca são combinados.

## Modo Debug

Durante as telas de câmera de qualquer módulo, um botão discreto "debug"
no canto superior direito ativa um painel com tela atual, teste ativo,
fase da máquina de estados, repetição e sinal/ângulo atual — útil para
depurar o rastreamento sem poluir a interface para o usuário final.

## Testes

Funções de cálculo (ângulos, comparação entre lados, consistência,
compensação, duração, máquina de estados de detecção) são puras e
testadas isoladamente, sem depender de câmera, para todas as três regiões:

```bash
npm test
```

## Checklist de teste manual

**Ombro** — abrir pelo celular → iniciar avaliação → responder perguntas →
liberar câmera → posicionar → calibrar → 3 flexões direita → 3 flexões
esquerda → 3 abduções direita → 3 abduções esquerda → dor → resultado →
comparação → compensação → consistência → dados detalhados → refazer.

**Joelho** — selecionar Joelho → perguntas → segurança → câmera →
reposicionar (lateral) → calibrar → 3 flexões direita → reposicionar →
3 flexões esquerda → reposicionar (frontal) → agachamento (3 reps,
observar os dois joelhos e o tronco) → reposicionar (lateral) → sentar e
levantar (3 reps) → dor após cada bloco → resumo → dados detalhados.

**Coluna** — selecionar Coluna → perguntas → segurança → câmera →
reposicionar (lateral) → calibrar (também captura a postura inicial) →
flexão anterior (3 reps) → reposicionar (frontal) → inclinação direita →
inclinação esquerda → reposicionar (lateral) → extensão confortável →
dor após cada bloco → resultado com ângulos, diferença lateral e postura
observada → dados detalhados.

## Limitações técnicas conhecidas nesta versão

- Testado estruturalmente via Modo Demonstração e revisão de código; a
  captura real por câmera de joelho e coluna ainda não foi validada em um
  dispositivo físico neste ambiente de desenvolvimento (o sandbox usado
  para construir esta versão não tem acesso a uma câmera real). Recomenda-
  se um teste físico completo antes de considerar os três módulos
  totalmente validados.
- O módulo de Joelho não possui relatório imprimível para o médico (só o
  ombro tem, em `/assessment/shoulder` → "Gerar Resumo"); os critérios de
  conclusão informados não exigiam essa peça para joelho/coluna, mas é uma
  extensão natural futura reaproveitando o mesmo componente.
- A escolha automática de "qual joelho está mais visível" no teste de
  sentar-e-levantar é heurística (maior visibilidade reportada pelo
  MediaPipe) — funciona bem quando a pessoa se senta de perfil, mas pode
  errar em enquadramentos ambíguos.
- Overlay visual (pontos/linhas sobre o vídeo) desenha apenas
  ombro/cotovelo/punho/quadril; os pontos de joelho/tornozelo ainda não
  aparecem no overlay (os cálculos os usam normalmente — é só uma
  limitação do desenho na tela).

## Preparado para o futuro

Sem implementar agora: login, perfis paciente/profissional, banco de
dados, histórico entre sessões, comparação temporal automática, painel
médico, envio por WhatsApp, e novas regiões (cotovelo, punho, quadril,
tornozelo, pescoço, marcha). A estrutura em `modules/<região>/` e o núcleo
compartilhado em `lib/` foram pensados exatamente para que essas regiões
futuras sigam o mesmo padrão do joelho e da coluna, sem tocar no núcleo.
