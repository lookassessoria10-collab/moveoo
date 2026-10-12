# Matriz de rastreabilidade

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano.
> Relaciona requisito (REQ), risco (RISCO), controle implementado, teste (TESTE) e resultado. **"Aprovado" só aparece para testes que existem e passaram** na execução registrada abaixo. Testes aprovados verificam software; não validam a exatidão clínica das medidas.

## 1. Execução registrada

| Item | Valor |
| --- | --- |
| Data | 2026-10-04 |
| Comando | `npm test` (`vitest run`) |
| Ferramenta | Vitest 2.1.9, Node v24.14.1, PGlite em memória |
| Código | Branch `claude/plataforma`, alterações locais não commitadas (base `93e2e68`), incluindo o intervalo mínimo entre códigos (`codeResendSeconds`) |
| Resultado | 13 arquivos, **98 testes aprovados**, 0 falhas (execução das 20:35; uma execução anterior no mesmo dia, antes do teste de reenvio, teve 97 aprovados) |

## 2. Catálogo de testes

Identificadores são estáveis: um teste novo recebe o próximo número livre, sem renumerar os anteriores (por isso TESTE-052 aparece junto dos testes de convite).

### `lib/server/__tests__/platform.test.ts`

| ID | Nome do teste (describe › it) |
| --- | --- |
| TESTE-001 | isolamento entre organizações › profissional não carrega contexto de um espaço do qual não participa |
| TESTE-002 | isolamento entre organizações › profissional da organização A não acessa pessoa da organização B, mesmo com o id |
| TESTE-003 | isolamento entre organizações › solicitação de B não é visível a partir de A |
| TESTE-004 | isolamento entre organizações › o banco rejeita ligar um registro a uma pessoa de outro espaço (chave composta) |
| TESTE-005 | vínculo e papéis dentro da mesma organização › profissional sem vínculo não acessa a pessoa atendida por colega |
| TESTE-006 | vínculo e papéis dentro da mesma organização › assistente vê o cadastro, mas não tem acesso clínico |
| TESTE-007 | vínculo e papéis dentro da mesma organização › pessoa cadastrada em espaço de demonstração fica marcada como fictícia |
| TESTE-008 | convite e acesso da pessoa › abrir o link (prévia) não autentica nem registra acesso |
| TESTE-009 | convite e acesso da pessoa › código errado não dá acesso; após o limite de tentativas, o convite bloqueia |
| TESTE-010 | convite e acesso da pessoa › convite expirado ou revogado não abre a atividade e derruba a sessão derivada |
| TESTE-011 | convite e acesso da pessoa › a sessão da pessoa só alcança a solicitação do próprio convite |
| TESTE-012 | convite e acesso da pessoa › sem os aceites registrados, a atividade não inicia |
| TESTE-013 | resultado, revisão e devolutiva › captura insuficiente não gera número; reenvio não duplica |
| TESTE-014 | resultado, revisão e devolutiva › devolutiva não pode ser publicada antes da revisão das medidas |
| TESTE-015 | resultado, revisão e devolutiva › medida sem valor não pode ser 'aceita'; correção preserva o valor original |
| TESTE-016 | resultado, revisão e devolutiva › publicar de novo cria versão nova e preserva a anterior |
| TESTE-017 | resultado, revisão e devolutiva › reavaliação com o mesmo protocolo é comparada; diferença sem rótulo de melhora |
| TESTE-018 | resultado, revisão e devolutiva › saída no meio da captura marca a sessão como interrompida |
| TESTE-019 | resultado, revisão e devolutiva › medição presencial fica identificada como método do profissional |
| TESTE-020 | liberação por recurso e ambiente › espaço real exige registro verificado |
| TESTE-021 | liberação por recurso e ambiente › função de mensuração sem liberação é bloqueada em espaço real, inclusive por chamada direta |
| TESTE-022 | liberação por recurso e ambiente › recurso suspenso bloqueia novas execuções também na demonstração |
| TESTE-023 | liberação por recurso e ambiente › só administração da plataforma registra decisões de liberação |
| TESTE-024 | liberação por recurso e ambiente › com decisão 'liberado' registrada, o espaço real executa; resultado de demonstração continua recusado |
| TESTE-025 | acesso de profissionais › bloqueia a conta após tentativas seguidas com senha errada |
| TESTE-026 | acesso de profissionais › e-mail inexistente e senha errada têm a mesma resposta |
| TESTE-052 | convite e acesso da pessoa › não envia um novo código antes de um minuto (evita disparo repetido) |

### `lib/care/__tests__/resultAdapters.test.ts`

| ID | Nome do teste (describe › it) |
| --- | --- |
| TESTE-027 | adaptModuleResult — ombro › recalcula a média a partir das tentativas e registra tentativas analisadas |
| TESTE-028 | adaptModuleResult — ombro › bloco sem tentativas NÃO vira 0°: valor nulo + captura insuficiente com motivo |
| TESTE-029 | adaptModuleResult — ombro › valores impossíveis (NaN/Infinity → null, negativos) são descartados |
| TESTE-030 | adaptModuleResult — ombro › movimento ausente do resultado é registrado como não realizado |
| TESTE-031 | adaptModuleResult — ombro › quadros e pontos do corpo não são guardados no resumo |
| TESTE-032 | adaptModuleResult — ombro › resultado de demonstração mantém a origem identificada |
| TESTE-033 | adaptModuleResult — ombro › rejeita formato inválido |
| TESTE-034 | adaptModuleResult — joelho, coluna e postura › joelho: sentar-levantar sem repetições não produz contagem 0 |
| TESTE-035 | adaptModuleResult — joelho, coluna e postura › coluna: inclinações laterais ficam com o lado anatômico informado pelo teste |
| TESTE-036 | adaptModuleResult — joelho, coluna e postura › postura: leitura nula vira captura insuficiente |
| TESTE-037 | comparação entre avaliações › mesma grandeza, método e versões: mostra a diferença (sem rotular como melhora) |
| TESTE-038 | comparação entre avaliações › versão do algoritmo diferente: incompatível e explica o motivo |
| TESTE-039 | comparação entre avaliações › métodos diferentes (câmera × goniômetro) não são comparados diretamente |
| TESTE-040 | comparação entre avaliações › correção do profissional vale para a comparação; descarte remove o valor |

### Testes de cálculo dos módulos (verificação com exemplos conhecidos)

| ID | Arquivo (testes) | Observação |
| --- | --- | --- |
| TESTE-041 | `lib/__tests__/angles.test.ts` (5) | Coordenadas sem proporção de imagem: **não detecta RISCO-001** |
| TESTE-042 | `modules/knee/__tests__/angles.test.ts` (5) | Idem |
| TESTE-043 | `modules/spine/__tests__/angles.test.ts` (3) | Idem |
| TESTE-044 | `modules/posture/__tests__/angles.test.ts` (4) | Idem |
| TESTE-045 | `lib/__tests__/framing.test.ts` (9) | Enquadramento e orientação |
| TESTE-046 | `lib/__tests__/movementDetection.test.ts` (3) | Máquina de estados de repetição |
| TESTE-047 | `lib/__tests__/movementMetrics.test.ts` (10) | Duração, velocidade, consistência, diferença entre lados |
| TESTE-048 | `lib/__tests__/smoothing.test.ts` (7) | Filtro EMA |
| TESTE-049 | `lib/__tests__/trunkCompensation.test.ts` (4) | Classificação de compensação (limiares experimentais) |
| TESTE-050 | `lib/validation/__tests__/csv.test.ts` (4) | Exportação CSV do modo de validação |
| TESTE-051 | `config/__tests__/precision.test.ts` (2) | Presença de `ALGORITHM_VERSION` |

### Testes necessários que não existem (resultado: **não executado**)

| ID | Objetivo |
| --- | --- |
| TESTE-101 | Ângulo de segmento conhecido em vídeo 720×1280 (retrato) e 1280×720 retorna o valor real dentro da tolerância definida |
| TESTE-102 | Ponta a ponta: movimento do lado direito real é registrado como "direito" com prévia espelhada (iOS e Android) |
| TESTE-103 | Telas `/assessment/*` não exibem 0° nem `-Infinity` quando um bloco não tem tentativas |
| TESTE-104 | Suspensão registrada após o início impede o envio do resultado da sessão já iniciada |
| TESTE-105 | Fluxo completo da pessoa em Safari/iPhone, Chrome/Android e navegador interno do WhatsApp |
| TESTE-106 | Relatório preserva origem, versões, estado de revisão e limitações |
| TESTE-107 | Eventos de auditoria não contêm texto clínico |
| TESTE-108 | Restauração de backup recupera dados e controles de acesso |
| TESTE-109 | E-mail não confirmado impede envio de convite |
| TESTE-110 | `?modo=validacao` não ativa gravação de pontos no fluxo de acompanhamento |
| TESTE-111 | Limite de tentativas e de envios por origem (IP) e limite total de envios de código por convite |
| TESTE-112 | Mudança de orientação do celular durante a captura pausa ou invalida a atividade |
| TESTE-113 | Corpo maior que 512 KB e origem diferente são recusados nas rotas da pessoa |
| TESTE-114 | Decisão "liberado" para outra versão de algoritmo não libera a versão atual |
| TESTE-115 | Caixa de saída não persiste tokens nem códigos (após correção do RISCO-014) |
| TESTE-116 | Câmera recusada: alternativa exibida e interrupção `camera_indisponivel` registrada |
| TESTE-117 | liberação por recurso e ambiente › segredos (links e códigos) são mascarados fora do desenvolvimento — **aprovado** (`npm test`, 04/10/2026) |
| TESTE-118 | liberação por recurso e ambiente › decisão registrada para outro modelo/runtime não libera a versão em uso — **aprovado** |
| TESTE-119 | adaptModuleResult — ombro › valores impossíveis são descartados e contados (evento `medicao.valor_impossivel_descartado`) — **aprovado** |

## 3. Matriz

| REQ | RISCO | Controle implementado (arquivo) | TESTE | Resultado |
| --- | --- | --- | --- | --- |
| REQ-001 | RISCO-013, 016 | `assertCanInvite` | TESTE-109 | não executado |
| REQ-002 | RISCO-013 | `login`, `crypto.ts` | TESTE-025, 026 | aprovado |
| REQ-003 | RISCO-013 | `resetPassword` | — | não executado |
| REQ-004 | RISCO-013, 017 | — (NI) | — | não executado |
| REQ-005 | RISCO-016 | `createWorkspace`, `assertCanInvite` | TESTE-020 | aprovado |
| REQ-006 | RISCO-011 | FKs compostas `db/schema.ts` | TESTE-004 | aprovado |
| REQ-007 | RISCO-011 | `services/authz.ts` | TESTE-001, 002, 003, 005 | aprovado |
| REQ-008 | RISCO-011 | `canHaveClinicalAccess` | TESTE-006 | aprovado |
| REQ-010 | RISCO-011 | — (NI) | — | não executado |
| REQ-011 | RISCO-012 | `invitations`, `randomToken`, `sha256` | TESTE-010 | aprovado |
| REQ-012 | RISCO-012 | `getInvitationLanding` | TESTE-008 | aprovado |
| REQ-013 | RISCO-012 | `beginInvitation`, `confirmInvitation` | TESTE-009 | aprovado |
| REQ-014 | RISCO-012 | `personScopeFromToken`, `requireScopedRequest` | TESTE-010, 011 | aprovado |
| REQ-016 | RISCO-022 | `beginInvitation` (intervalo de 60 s entre códigos) | TESTE-052; TESTE-111 | aprovado (intervalo); não executado (limite por origem e total) |
| REQ-017 | RISCO-007, 023 | `assertConsents` | TESTE-012 | aprovado |
| REQ-021 | RISCO-018 | `createAssessmentRequest` | TESTE-017 | aprovado |
| REQ-022 | RISCO-006 | `resultAdapters.ts` | TESTE-027, 031, 033 | aprovado |
| REQ-023 | RISCO-004, 006 | `makeMetric` | TESTE-013, 028, 029, 030, 034, 036 | aprovado |
| REQ-024 | RISCO-016 | `originEnum`, `submitAssessmentResult` | TESTE-019, 024, 032 | aprovado |
| REQ-025 | RISCO-001, 015 | colunas de versão em `assessment_sessions` | TESTE-013 (algoritmo e modelo) | aprovado (dimensões do vídeo: não executado) |
| REQ-026 | RISCO-010 | `idempotency_key` | TESTE-013 | aprovado |
| REQ-027 | RISCO-009, 023 | `interruptAssessment` | TESTE-018; TESTE-116 | aprovado (saída da página); não executado (câmera recusada) |
| REQ-028 | RISCO-003 | mapeamento de lado no adaptador | TESTE-035; TESTE-102 | aprovado (mapeamento); não executado (ponta a ponta) |
| REQ-029 | RISCO-001 | — (NI) | TESTE-101 | não executado |
| REQ-030 | RISCO-006, 021 | — (NI) | TESTE-103 | não executado |
| REQ-031 | RISCO-008 | `CareAssessmentRunner` | — | não executado |
| REQ-032 | — | `hooks/useCamera.ts` | — | não executado |
| REQ-033 | RISCO-008 | `reviewSession` | TESTE-015 | aprovado |
| REQ-034 | RISCO-006 | `reviewSession` | TESTE-015 | aprovado |
| REQ-035 | RISCO-007, 008 | `publishFeedback` | TESTE-014, 016 | aprovado |
| REQ-036 | RISCO-018, 007 | `comparison.ts` | TESTE-017, 037, 038, 039, 040 | aprovado |
| REQ-037 | RISCO-020 | página de relatório | TESTE-106 | não executado |
| REQ-038 | RISCO-017 | `getReleaseState` (chave: recurso + algoritmo + protocolo + modelo/runtime) | TESTE-021; TESTE-118; TESTE-114 | aprovado; não executado (outra versão de algoritmo) |
| REQ-039 | RISCO-016, 017 | `assertProtocolExecutable` | TESTE-021, 022, 024; TESTE-104 | aprovado; não executado (suspensão após início) |
| REQ-040 | RISCO-017 | `recordReleaseDecision` | TESTE-023 | aprovado |
| REQ-041 | RISCO-015, 017 | — (NI) | — | não executado |
| REQ-042 | — | `audit()` | TESTE-107 | não executado |
| REQ-043 | RISCO-012 | `next.config.js` | — | não executado |
| REQ-044 | RISCO-012 | `personApi.ts` | TESTE-113 | não executado |
| REQ-045 | RISCO-014 | `redactSecrets` fora do desenvolvimento (parcial) | TESTE-117; TESTE-115 | aprovado (mascaramento); não executado (sem persistência com provedor) |
| REQ-046 a 048 | RISCO-010 | — (NI) | TESTE-108 | não executado |
| REQ-049 | RISCO-015 | versões fixas na URL | — | não executado |
| REQ-050, 051 | — | — (NI) | — | não executado |
| — (cálculo) | RISCO-002, 004, 005 | módulos de cálculo | TESTE-041 a 049 | aprovado (exemplos sintéticos; sem proporção de imagem) |

REQ-009, REQ-015, REQ-018, REQ-019 e REQ-020 dependem de revisão de conteúdo ou de decisão externa e não têm teste automatizado previsto.
