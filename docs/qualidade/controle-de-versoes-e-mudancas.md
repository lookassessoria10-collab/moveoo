# Controle de versões e mudanças

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano.
> Objetivo: permitir reconstruir qual software produziu cada resultado (24.5) e impedir que uma mudança altere medidas sem análise, nova verificação e nova decisão de liberação (24.4). Alterações relevantes podem exigir peticionamento regulatório [30] — a confirmar com o responsável regulatório.

## 1. Identificadores de versão

| Identificador | Onde está | Gravado em cada resultado | Quando muda |
| --- | --- | --- | --- |
| Versão do aplicativo | `package.json` (`0.2.0-dev`) | `assessment_sessions.app_version` | A cada versão publicada |
| Versão do algoritmo | `config/precision.ts` → `ALGORITHM_VERSION` (`2026.09-smoothing-v1`) | `algorithm_version`; também em cada linha do CSV de validação | Qualquer mudança que possa alterar um valor medido (§3) |
| Protocolo | `lib/care/protocols.ts` (`id` + `version`, hoje 1.0.0) | `protocol_id`, `protocol_version` | Mudança de instrução, posição, tentativas, grandezas ou unidade |
| Modelo | `lib/pose/modelInfo.ts` → `POSE_MODEL_ID` (`pose_landmarker_full/float16/1`) | `model_id` | Troca de variante ou versão do modelo |
| Runtime | `POSE_RUNTIME_LABEL` (`tasks-vision js 0.10.35 / wasm 0.10.17`) | `runtime_version` | Atualização do pacote ou do WASM |
| Aparelho | Navegador | `device` (`userAgent`, `videoWidth`, `videoHeight`) | Por sessão |
| Textos de aceite | `CONSENT_DOCS` em `services/core.ts` (`2026-10-minuta-1`) | `consent_records.document_id` → versão | Qualquer alteração de texto (gera novo aceite) |
| Schema | `db/migrations/` (Drizzle) | — | Mudança de estrutura; migrações nunca apagam histórico clínico |

## 2. Política de `ALGORITHM_VERSION`

- Formato atual: `AAAA.MM-descricao` (ex.: `2026.09-smoothing-v1`). Manter histórico comentado em `config/precision.ts`.
- Incrementar em **qualquer** mudança que possa alterar um valor: geometria, correção de proporção, suavização, limiares de detecção, estabilização, faixa plausível, agregação (média, mediana), escolha de pontos, conversões de lado/espelhamento, **troca de modelo ou runtime**.
- Não incrementar para mudanças só de texto ou visual que comprovadamente não alteram valores — registrar a justificativa na análise de impacto.
- Uma nova `ALGORITHM_VERSION` nasce em `desenvolvimento`: a chave de liberação inclui a versão, então nenhuma decisão anterior se aplica a ela.
- A comparação entre avaliações recusa versões de algoritmo diferentes (TESTE-038). Por isso, cada incremento interrompe comparações com avaliações anteriores — comunicar aos profissionais.

## 3. Política de versão de protocolo

| Mudança | Versão |
| --- | --- |
| Correção de texto sem efeito na execução | Revisão (`1.0.x`) |
| Instrução que pode mudar a execução, número de tentativas | Secundária (`1.x.0`) — avaliar impacto; a comparação trata versões secundárias como compatíveis |
| Posição da câmera, plano, grandeza, unidade, convenção de zero | **Principal** (`x.0.0`) — avaliações anteriores deixam de ser comparáveis |

Mudança prevista: flexão do ombro em vista lateral (passo 7 de `config/precision.ts`) → `ombro-camera` 2.0.0 + nova `ALGORITHM_VERSION`.

## 4. Fixação de modelo, runtime e dependências

| Item | Situação | Ação necessária |
| --- | --- | --- |
| `@mediapipe/tasks-vision` | Versão exata 0.10.35 no `package.json` | Manter exata |
| Runtime WASM | **0.10.17** baixado de `cdn.jsdelivr.net` — diverge do pacote | Alinhar com o pacote e servir da própria origem com hash verificado; incrementar `ALGORITHM_VERSION` |
| Modelo | URL com versão `1` em `storage.googleapis.com` | Servir da própria origem com hash; registrar hash no `model_id` |
| Demais dependências | Várias com faixa `^` (react, recharts, zustand, tailwind, vitest...); versões efetivas fixadas pelo `package-lock.json` | Instalar com `npm ci`; exigir análise de impacto para atualizar qualquer dependência usada no cálculo |
| README | Corrigido em 04/10/2026 (cita `pose_landmarker_full`) | — |

## 5. Análise de impacto (obrigatória antes de liberar uma mudança)

Registrar para cada mudança que toque captura, rastreamento, qualidade, métricas, regras, protocolo, resultado ou acesso:

1. Descrição e motivo; arquivos e commits.
2. Componentes afetados (captura, rastreamento, qualidade, métricas, regras, feedback, resultado, revisão).
3. Grandezas, lados e protocolos afetados; efeito esperado nos valores.
4. Versões a incrementar (`ALGORITHM_VERSION`, protocolo, app).
5. Riscos novos ou alterados (`gestao-de-riscos.md`) e requisitos afetados.
6. Testes a executar ou criar; resultado.
7. Necessidade de nova validação analítica (`plano-analitico-e-clinico.md` §9).
8. Efeito em comparações e relatórios existentes; comunicação aos profissionais.
9. Efeito regulatório (necessidade de notificação/peticionamento — a confirmar com o responsável).
10. Decisão de liberação a registrar e plano de reversão para versão permitida.

## 6. Resultados antigos: nada de reprocessamento silencioso

- Medidas persistidas mantêm para sempre a versão que as produziu; nenhuma rotina atualiza `measurements.value` de sessões antigas.
- O fluxo de atendimento **não** guarda pontos do corpo; portanto não é possível recalcular resultados antigos de atendimento. As dimensões do vídeo gravadas permitem, no máximo, estimar o efeito da correção de proporção — **qualquer estimativa assim** deve ser gerada como novo registro, com nova versão, referência ao original e identificação clara, nunca substituindo o original.
- Os dados do modo de validação podem ser reprocessados offline (`npm run reprocess`), gerando relatórios separados por versão.
- Relatórios já publicados permanecem com a versão original e suas limitações.

## 7. Mudanças pendentes conhecidas

| Mudança | Efeito em valores | Versões |
| --- | --- | --- |
| Correção de proporção da imagem (RISCO-001) | Sim, potencialmente grande | Nova `ALGORITHM_VERSION`; protocolos podem permanecer 1.x se instruções não mudarem |
| Alinhamento do WASM | Possível | Nova `ALGORITHM_VERSION` |
| Protocolo do ombro em vista lateral | Sim | `ombro-camera` 2.0.0 + nova `ALGORITHM_VERSION` |
| Passos 4 a 8 de `config/precision.ts` (pré-checagem, estabilização, compensação, confiabilidade) | Sim | Uma versão por passo, com análise de impacto |
| Correção das telas legadas (0°/`-Infinity`) | Só no legado | Versão do app; registrar |

## 8. Reversão e suspensão

Se uma versão liberada apresentar problema: registrar `suspenso` para a combinação afetada (efeito imediato em novas execuções), avaliar reverter o código para a última combinação liberada e seguir `docs/operacao/incidentes-e-reclamacoes.md`. Conservar o histórico não significa continuar oferecendo o recurso suspenso.
