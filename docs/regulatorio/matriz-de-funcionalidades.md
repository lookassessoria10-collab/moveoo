# Matriz de funcionalidades e hipóteses de enquadramento

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano.
> **Nenhuma classe de risco é atribuída.** Toda coluna "hipótese" é proposta de engenharia a ser confirmada por especialista regulatório. Fontes: RDC 657/2022 [30], Perguntas e respostas Anvisa, questão 50 [25], RDC 751/2022 — notificação [31] e registro [32], PGA Anvisa 2026 [26] — **fonte a reverificar antes do lançamento**.
> Legenda de situação: ver `docs/regulatorio/finalidade-pretendida.md`.

Os itens numerados seguem o cap. 24.2 do plano: (1) usuários, (2) finalidade, (3) movimento/grandeza/unidade/lado/protocolo, (4) público e condições, (5) origem dos dados e captura, (6) saída e influência na decisão, (7) limitações e quando não deve produzir resultado, (8) automação e intervenção humana, (9) alegações previstas, (10) hipótese de enquadramento, fonte, data e questão para parecer.

## Parte A — Funções administrativas e documentais

Hipótese comum a esta parte (10): **funções de apoio administrativo/documental, sem cálculo clínico**. Fonte: [30], [25]. Data: 2026-10-04. Questão comum: *a separação destas funções das funções de mensuração é suficiente para tratá-las de forma distinta no enquadramento?* A separação na arquitetura **não determina isenção automaticamente** (24.2).

| ID | Função (arquivos) | (1) Usuários | (2) Finalidade | (5) Dados e origem | (6) Saída | (8) Automação | (9) Alegações | Situação |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | Conta do profissional (`services/accounts.ts`) | Profissional | Administrativa | Nome, e-mail, senha (hash scrypt) | Sessão autenticada | Automática; bloqueio após 5 falhas | "Contas novas começam num espaço de demonstração" | SW-V (TESTE-025, 026). MFA: NI |
| F-02 | Verificação profissional (`services/admin.ts`) | Admin; profissional | Administrativa (habilitação) | Conselho, região, número, UF informados; fonte da conferência | Estado pendente/verificado/recusado | **Manual**, com fonte, data e responsável. Sem consulta automática a conselhos | Não exibir selo de verificação automática | SW (sem teste da decisão); efeito em espaço real SW-V (TESTE-020) |
| F-03 | Espaços, equipe e papéis (`services/workspaces.ts`, `people.ts`) | Gestor | Administrativa | Nome do espaço, tipo, ambiente demonstração/real, membros | Contexto de trabalho | Automática | "Demonstração com dados fictícios" | SW-V (TESTE-001, 006, 020) |
| F-04 | Pessoas, episódios e vínculos (`services/people.ts`) | Profissional, gestor, assistente | Administrativa/documental | Nome, contato, cidade/UF opcionais; objetivo do acompanhamento; modalidade; nota do profissional sobre adequação do remoto | Cadastro e vínculo | Manual | "Cada profissional vê apenas quem atende" | SW-V (TESTE-002, 005, 006, 007) |
| F-05 | Convite e acesso da pessoa (`services/personAccess.ts`) | Profissional; pessoa | Administrativa (acesso) | Token (hash), canal, código de 6 dígitos (hash) | Sessão restrita à atividade | Automática | "O convite não abre o histórico completo" | SW-V (TESTE-008 a 011, 052) |
| F-06 | Aceites versionados (`services/core.ts`, `personAccess.ts`) | Pessoa | Documental | Documento, versão, decisão, nome digitado, data | Registro de aceite; bloqueio da atividade sem aceite | Automática | "Consentimento registrado com versão do texto e data" | SW-V (TESTE-012). Textos: **minutas pendentes de revisão jurídica** (REG/JUR) |
| F-07 | Solicitação e reavaliação (`services/assessments.ts`) | Profissional | Administrativa/organização do cuidado | Protocolo e versão, instruções livres, prazo, supervisão | Atividade para a pessoa | Manual | — | SW-V (TESTE-017, 021) |
| F-08 | Medição presencial (`recordManualMeasurements`) | Profissional | Documental (registro de medida feita pelo profissional) | Valor, unidade, lado, instrumento (goniômetro, inclinômetro, fita, cronômetro, contagem) | Medida com origem `manual_profissional` | Nenhum cálculo; valor digitado | "Medição presencial ... identificada" | SW-V (TESTE-019) |
| F-09 | Revisão de medidas e devolutiva | Profissional; pessoa (leitura) | Documental; a decisão clínica é do profissional | Decisão por medida, valor corrigido, justificativa; texto da orientação | Devolutiva versionada; medidas revisadas se o profissional incluir | **Humana obrigatória**; sistema impede publicar sem revisar | "Nenhum número chega à pessoa sem a sua revisão" | SW-V (TESTE-014 a 016) |
| F-10 | Linha do tempo e relatório imprimível (`app/painel/avaliacoes/[id]/relatorio`) | Profissional | Documental | Dados persistidos | Página para impressão pelo navegador (PDF no servidor: NI) | Automática (montagem) | Relatório mostra estado provisório, método, versões e limitações | SW (sem teste automatizado) |
| F-12 | Liberação por versão e auditoria (`services/core.ts`, `admin.ts`) | Admin | Controle interno de qualidade | Recurso, versões, estado, escopo, evidências, responsável | Bloqueio/permissão no servidor | Decisão **humana** registrada; aplicação automática | "O sistema não aprova nada sozinho" | SW-V (TESTE-021 a 024) |

## Parte B — Cálculo sobre dados existentes

### F-11 — Comparação entre avaliações (`lib/care/comparison.ts`)

| Item | Conteúdo |
| --- | --- |
| (1) Usuários | Profissional (painel e relatório). A pessoa não vê a comparação |
| (2) Finalidade | Monitoramento/acompanhamento da evolução — apoio à decisão do profissional |
| (3) Grandeza | Diferença entre valor efetivo atual e anterior, mesma unidade da medida |
| (4) Público | Pessoas com reavaliação no mesmo protocolo |
| (5) Origem | Medidas persistidas e suas revisões (valor corrigido prevalece; descartada = sem valor) |
| (6) Saída | "antes → depois (diferença)" ou motivo de incompatibilidade; marca "inclui valor não revisado" |
| (7) Limitações | Só compara mesma grandeza, lado, unidade, método, protocolo (mesma versão principal) e algoritmo. **Não considera** aparelho, orientação nem resolução do vídeo |
| (8) Automação | Cálculo automático; interpretação humana. Nunca rotula como melhora |
| (9) Alegações | "Reavaliações ... comparadas lado a lado — ou o sistema explica por que não são comparáveis" |
| (10) Hipótese | Herda a natureza da medida comparada; para medidas por câmera, hipótese de integrar a função de mensuração. Questão: *a apresentação de diferenças altera o enquadramento?* Data: 2026-10-04. Situação: SW-V (TESTE-017, 037 a 040) |

## Parte C — Funções de mensuração por câmera

Hipótese comum (10): **pode configurar software como dispositivo médico (SaMD)** quando destinada a apoiar avaliação ou reabilitação — RDC 657/2022 [30]; exemplo análogo na questão 50 [25]. **Classe não atribuída** (RDC 751/2022 [31, 32]). Data: 2026-10-04. Estado de liberação: **desenvolvimento** em todas. Espaço real bloqueia execução (SW-V, TESTE-021).

Limitações transversais (7) a todas as funções de câmera:

- **Erro de proporção da imagem (`docs/auditoria.md` A1):** ângulos calculados em coordenadas normalizadas sem correção largura/altura. Em vídeo retrato 720×1280, um segmento real a 45° é calculado como ~60,6°. Afeta ângulos entre três pontos e inclinações. Correção pendente; exigirá nova `ALGORITHM_VERSION` e nova verificação.
- Estimativa 2D com uma câmera; não separa planos; sensível à orientação da câmera [17].
- Confiança/visibilidade do rastreador não equivale à exatidão do ângulo.
- Runtime WASM 0.10.17 diverge do pacote npm 0.10.35 (`docs/auditoria.md` A3).
- Quando não deve produzir resultado: bloco sem tentativas, valores não finitos ou fora da faixa plausível → `value = null`, `quality = insuficiente`, motivo registrado (SW-V, TESTE-013, 028 a 030, 034, 036).

### F-13 — Ombro (`ombro-camera` 1.0.0, recurso `mensuracao_camera_ombro`)

| Item | Conteúdo |
| --- | --- |
| (1) Usuários | Profissional solicita e revisa; pessoa executa |
| (2) Finalidade | Mensuração para avaliação/acompanhamento (hipótese) |
| (3) Grandeza | Elevação do braço em relação ao tronco, média das tentativas analisadas, **graus**; "flexão" e "elevação lateral"; lados direito e esquerdo; 3 tentativas por movimento |
| (4) Público/condições | Adultos; em pé, de frente para o celular apoiado, tronco e braços visíveis. Exclusões: ver finalidade §5 |
| (5) Origem/captura | Câmera frontal, processamento no aparelho; servidor recebe tentativas sem quadros e recalcula a média |
| (6) Saída | Valor provisório + qualidade + tentativas analisadas; após revisão, pode compor a devolutiva |
| (7) Limitações específicas | Não isola a glenoumeral. **A flexão é captada em vista frontal: a câmera 2D não separa plano sagital e frontal; flexão e elevação lateral usam o mesmo cálculo geométrico (`docs/auditoria.md` A4).** Inclinação do tronco altera a estimativa |
| (8) Automação | Detecção de repetição e cálculo automáticos; revisão humana obrigatória antes de publicar |
| (9) Alegações | Nenhuma alegação de precisão permitida. Rótulo "Câmera do celular (estimativa 2D)" |
| (10) Questão | Uma medida que não distingue flexão de abdução pode ser apresentada com o rótulo "flexão"? Mudança prevista para vista lateral (`config/precision.ts`, passo 7) exigirá protocolo 2.0.0 |

### F-14 — Joelho (`joelho-camera` 1.0.0, recurso `mensuracao_camera_joelho`)

| Item | Conteúdo |
| --- | --- |
| (1) Usuários | Profissional; pessoa |
| (2) Finalidade | Mensuração e avaliação funcional (hipótese) |
| (3) Grandezas | Flexão do joelho em pé por lado (graus); agachamento — flexão média no ponto mais baixo e diferença média entre joelhos (graus, bilateral); sentar e levantar — repetições analisadas, tempo médio início→pico (segundos), repetições com indício de apoio das mãos |
| (4) Público/condições | Adultos capazes de agachar e sentar/levantar com segurança, cadeira estável. Risco de queda: ver RISCO-023 |
| (5) Captura | Lateral para flexão e sentar-levantar; frontal para agachamento |
| (6) Saída | Valores provisórios por grandeza, qualidade, motivo de rejeição |
| (7) Limitações específicas | Roupa e segmentos escondidos; agachamento só frontal (não é 3D); sentar-levantar não mede força; apoio das mãos é heurístico; escolha do joelho mais visível é heurística |
| (8) Automação | Automática + revisão humana obrigatória |
| (9) Alegações | Material público cita "avaliações de mobilidade e agachamento pelo celular" — revisar |
| (10) Questão | Contagem e tempo de sentar-levantar equivalem a teste funcional padronizado? Não usar nome de teste validado sem seguir o instrumento |

### F-15 — Tronco (`coluna-camera` 1.0.0, recurso `mensuracao_camera_coluna`)

| Item | Conteúdo |
| --- | --- |
| (3) Grandezas | Inclinação global do segmento ombros–quadril em flexão anterior, inclinação lateral (direita/esquerda) e extensão; graus |
| (5) Captura | Lateral para flexão/extensão; frontal para inclinações |
| (7) Limitações específicas | Não corresponde à amplitude lombar nem a segmentos da coluna; movimento da pelve confunde a leitura |
| (1), (2), (4), (6), (8) | Como F-13 |
| (9) Alegações | Proibido falar em "flexão lombar" ou segmento vertebral |
| (10) Questão | Inclinação global do tronco, sem segmento anatômico, mantém hipótese de SaMD quando usada em reabilitação? |

### F-16 — Postura sentada (`postura-sentada-camera` 1.0.0, recurso `observacao_camera_postura`)

| Item | Conteúdo |
| --- | --- |
| (2) Finalidade | Observação descritiva; módulo legado apresentado como conscientização ergonômica |
| (3) Grandezas | Inclinação do tronco em relação à vertical; inclinação da cabeça em relação ao ombro; graus; faixa plausível −90° a 90° |
| (5) Captura | Lateral, pessoa sentada na posição habitual |
| (7) Limitações | Não conclui doença, causa de dor nem diagnóstico ergonômico |
| (10) Questão | Uso "corporativo/ergonômico" (bem-estar) e uso em atendimento têm enquadramentos distintos? Não apresentar como bem-estar para contornar exigências (24.2) |

### F-17 — Perguntas de segurança e bloqueio (`lib/safety.ts`, telas `SafetyCheck*`)

| Item | Conteúdo |
| --- | --- |
| (2) Finalidade | Controle de risco: interromper o teste diante de sinal de alerta relatado |
| (6) Saída | Atividade interrompida (`perguntas_de_seguranca`) e orientação a procurar avaliação; não diagnostica |
| (8) Automação | Regra simples: qualquer "sim" interrompe |
| (10) Questão | O conteúdo das perguntas e das orientações precisa ser aprovado por responsável clínico (24.6). Situação: **não aprovado formalmente** (PE-14) |

## Parte D — Ferramentas internas e legado

### F-18 — Avaliação livre pública `/assessment/*` (legado UORT)

| Item | Conteúdo |
| --- | --- |
| (1) Usuários | Qualquer pessoa, **sem profissional e sem cadastro** |
| (2) Finalidade | Autoavaliação de movimento com resultado imediato (legado) |
| (6) Saída | Números, classificações experimentais de compensação/consistência, "Índice de Movimento" (ombro), resumo para o médico |
| (7) Limitações | Mesmas de F-13 a F-16 **e** possibilidade de exibir 0° (`average([])`) ou `-Infinity` (`Math.max()` sem tentativas) — `docs/auditoria.md` A2, não corrigido. Sem persistência no servidor |
| (8) Automação | Totalmente automática, sem revisão humana |
| (10) Hipótese | Uso direto por leigo sem supervisão pode ter enquadramento e risco distintos do fluxo profissional. **Questão prioritária:** manter público, restringir a demonstração ou retirar antes de qualquer lançamento? |

### F-19 — Modo de validação (`?modo=validacao`, `lib/validation/*`, `scripts/reprocess-validation.ts`)

| Item | Conteúdo |
| --- | --- |
| (1) Usuários | Equipe de validação (examinador) com voluntário identificado por código |
| (2) Finalidade | Pesquisa/engenharia: comparar com goniômetro/inclinômetro; ombro e joelho |
| (5) Dados | CSV por repetição (valor, referência, confiança média, `userAgent`) e JSON de pontos 2D/3D brutos, guardados no navegador do aparelho até exportação. **Dimensões do vídeo não são registradas** |
| (8) Automação | Ativação por parâmetro de URL (não é controle de acesso) |
| (10) Questão | Coleta com seres humanos exige avaliação ética e regulatória prévia (24.6). Não é função de atendimento e não pode ser liberada como tal |

## Parte E — Funções previstas e não implementadas

Vídeo enviado e revisão de vídeo, biblioteca de exercícios e programas, contagem/correção de exercício por câmera, orientação por voz durante exercício prescrito, lembretes, questionários padronizados, sessão ao vivo, PDF no servidor, canal de direitos do titular, assinatura e cobrança. Cada uma exigirá linha própria nesta matriz antes da implementação.
