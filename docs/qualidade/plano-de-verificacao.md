# Plano de verificação de software

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano.
> Verificação confirma que o software faz o que foi especificado. **Não** valida a exatidão clínica das medidas — isso está em `docs/validacao/plano-analitico-e-clinico.md`.

## 1. Objetivo e escopo

Verificar, a cada versão candidata, os requisitos de `requisitos-do-produto.md`, com prioridade para (24.11): isolamento, exposição de dados, bloqueio de recurso não liberado, integridade dos resultados e recuperação.

Fora do escopo deste plano: desempenho analítico, utilidade clínica, usabilidade formal (ver `usabilidade-e-acessibilidade.md`).

## 2. Níveis

| Nível | O que cobre | Ferramenta | Situação |
| --- | --- | --- | --- |
| Unitário de cálculo | Ângulos, enquadramento, repetição, suavização, métricas | Vitest | Existe (TESTE-041 a 051). Falta geometria com proporção real (TESTE-101) |
| Unitário de contrato | Adaptadores de resultado e comparação | Vitest | Existe (TESTE-027 a 040) |
| Integração com banco | Serviços contra PostgreSQL real em memória (PGlite) | Vitest | Existe (TESTE-001 a 026) |
| Rotas HTTP e Server Actions | Origem, tamanho do corpo, códigos HTTP, cookies | — | Não existe (TESTE-113) |
| Ponta a ponta em aparelhos | Câmera real, lado anatômico, orientação, navegadores móveis | Manual roteirizado (a definir) | Não executado (TESTE-102, 105, 112, 116) |
| Segurança | Revisão de código, dependências, testes de acesso | A definir | Não executado (ver `docs/seguranca/modelo-de-ameacas.md`) |
| Operação | Backup/restauração, suspensão, incidentes | A definir | Não executável (sem hospedagem) |

## 3. Ambiente

- Testes automatizados: `npm test`; banco PGlite em memória criado por arquivo de teste; cenário fictício de `db/seed-data.ts` (duas organizações, profissionais, assistente, administração). Credenciais de teste ficam apenas no arquivo de seed.
- Testes manuais: `npm run db:reset` e dados fictícios; nunca dados de pessoas reais (24.8).
- Ponta a ponta em celular exige HTTPS (contexto seguro para a câmera).

## 4. Critérios de entrada e saída por versão candidata

| Entrada | Saída |
| --- | --- |
| Análise de impacto registrada (`controle-de-versoes-e-mudancas.md`) | 100% dos testes automatizados aprovados |
| `ALGORITHM_VERSION` e versões de protocolo conferidas | Testes ponta a ponta do escopo executados com registro |
| Matriz de rastreabilidade atualizada | Nenhum item "não executado" em requisito ligado a risco de severidade alta do escopo, ou justificativa assinada |
| | Resultado arquivado (data, commit, ambiente, executor, saída) |

## 5. Critérios de aceitação do cap. 24.11 — situação em 2026-10-04

| Cenário | Esperado | Evidência | Situação |
| --- | --- | --- | --- |
| Profissional ainda não conferido | Demonstração disponível; atendimento real bloqueado | TESTE-020 | Aprovado |
| Função clínica sem liberação | API rejeita execução real, inclusive chamada direta | TESTE-021 | Aprovado |
| Nova versão do motor sem análise | Permanece em desenvolvimento | Chave por versão (`getReleaseState`); TESTE-114 | Não executado |
| Profissional A acessa paciente de B | Negado mesmo com identificador | TESTE-002, 003 | Aprovado |
| Link expirado, revogado ou encaminhado | Sem histórico; confirmação por código | TESTE-008 a 011 | Aprovado |
| Captura com confiança insuficiente | Sem medida válida; motivo registrado | TESTE-013, 028 a 030 | Aprovado (no acompanhamento). Telas legadas: não executado (TESTE-103) |
| Usuário recusa gravação opcional | Vídeo não persistido | — | Não aplicável (vídeo não implementado; nunca é gravado) |
| Câmera encerrada ou página abandonada | Captura finalizada; interrupção registrada | TESTE-018; TESTE-116 | Aprovado (registro); encerramento da câmera não testado |
| Consentimento registrado | Versão, identidade, finalidade e data recuperáveis | TESTE-012 (bloqueio) | Parcial: leitura do registro não testada |
| Profissional corrige resultado | Original, correção, autoria, motivo e data preservados | TESTE-015 | Aprovado |
| Relatório exportado | Preserva origem, versão, protocolo, revisão e limitações | TESTE-106 | Não executado |
| Recurso suspenso | Novas execuções impedidas; histórico consultável | TESTE-022; TESTE-104 | Aprovado (nova solicitação); não executado (sessão já iniciada) |
| Usuário solicita exclusão | Solicitação acompanhável | — | Não implementado |
| Backup restaurado | Dados e acessos recuperados | TESTE-108 | Não implementado |
| Rotina de demonstração | Não alcança pessoas reais, produção ou evidências | TESTE-007, 024 | Parcial: nada impede cadastrar pessoa real em espaço de demonstração (RISCO-016) |

## 6. Casos do cap. 18 ainda não cobertos

Prévia espelhada (TESTE-102), mudança de orientação (TESTE-112), quadros com intervalo variável (tempo real é usado em `movementMetrics`, sem teste com intervalo irregular), falha de processamento com estado de erro visível, acesso a mídia privada (não aplicável sem vídeo), valor impossível gerando incidente técnico registrado (hoje é descartado sem registro; só formato inválido gera evento `avaliacao.resultado_rejeitado_formato`).

## 7. Prioridade de novos testes

1. TESTE-101 (proporção) — antes de qualquer nova coleta de validação.
2. TESTE-104, 114 (liberação por versão e suspensão em sessão iniciada).
3. TESTE-102, 105, 116 (aparelhos reais).
4. TESTE-106, 107, 113, 115 (exposição de dados).
5. TESTE-103, 110 (legado e modo de validação).

## 8. Registro de execução

| Data | Commit/estado | Executor | Comando | Resultado |
| --- | --- | --- | --- | --- |
| 2026-10-04 (20:16) | `claude/plataforma`, alterações locais sobre `93e2e68` | Claude Code (apoio de IA), a conferir por responsável humano | `npm test` | 13 arquivos, 97 aprovados, 0 falhas |
| 2026-10-04 (20:35) | Idem, após inclusão do intervalo mínimo entre códigos e do TESTE-052 | Claude Code (apoio de IA), a conferir por responsável humano | `npm test` | 13 arquivos, 98 aprovados, 0 falhas |
