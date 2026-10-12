# Critérios de liberação por recurso e versão

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano.
> O sistema **registra evidência e decisão humana**; ele não emite aprovação regulatória. Um registro "liberado" no banco não substitui parecer, regularização sanitária ou validação clínica. Referência do plano: cap. 24.4 — **fonte a reverificar antes do lançamento**.

## 1. Estados

| Estado | Significado | Efeito aplicado pelo servidor hoje |
| --- | --- | --- |
| `desenvolvimento` | Padrão quando não há decisão registrada | Executa só em espaço de **demonstração** |
| `demonstracao` | Apresentação com dados fictícios | Igual a `desenvolvimento` (o servidor não diferencia) |
| `em_validacao` | Em estudo de desempenho | Igual a `desenvolvimento`. **Não autoriza** coleta com voluntários sem PE-16 |
| `liberado` | Uso real autorizado para o escopo descrito | Executa em espaço **real** e de demonstração |
| `suspenso` | Retirado de uso | Bloqueia **novas** execuções em qualquer ambiente; histórico permanece consultável |

Em 2026-10-04 não existe nenhuma decisão registrada: todos os recursos estão em `desenvolvimento`.

## 2. Como o servidor aplica (implementado)

- Chave da decisão: `feature_key` + `algorithm_version` + `protocol_version` (tabela `feature_releases`, `db/schema.ts`). Vale a decisão mais recente para a combinação exata. Uma decisão para outra versão **não** se aplica à versão atual.
- Recursos controlados (`FEATURES` em `lib/server/services/core.ts`): `mensuracao_camera_ombro`, `mensuracao_camera_joelho`, `mensuracao_camera_coluna`, `observacao_camera_postura`. O protocolo `registro-presencial` não tem `featureKey` (função administrativa).
- `assertProtocolExecutable` é chamado em: criação de solicitação, reemissão de convite, página da atividade, início da sessão e **envio do resultado** (`services/assessments.ts`, `services/personAccess.ts`, `app/acompanhamento/avaliacao/[requestId]/page.tsx`). Chamadas diretas às rotas `/api/acompanhamento/*` passam pela mesma verificação (TESTE-021).
- Espaço `real`: só executa com `liberado`; exige registro profissional `verificado` para criar o espaço e enviar convites (TESTE-020).
- Resultado marcado como demonstração é recusado em espaço real (TESTE-024).
- Só contas de administração da plataforma registram decisões; cada decisão exige escopo e evidências (mín. 10 caracteres) e gera evento de auditoria `liberacao.decisao_registrada` (TESTE-023).
- Assinatura ou plano comercial não participa da decisão (não há módulo de assinatura implementado).

## 3. Limitações conhecidas do controle (a corrigir antes do primeiro "liberado")

| Limitação | Consequência | Ação proposta |
| --- | --- | --- |
| ~~Modelo e runtime não fazem parte da chave~~ — **resolvido em 04/10/2026** (`model_version`, TESTE-118) | Troca do modelo ou do WASM agora volta o recurso a "desenvolvimento" até nova decisão | Incluir `model_id` e `runtime_version` na chave, ou regra obrigatória: qualquer mudança de modelo/runtime incrementa `ALGORITHM_VERSION` (ver `docs/qualidade/controle-de-versoes-e-mudancas.md`) |
| Campo `scope` é texto livre | Público, indicação e restrições **não são aplicados** pelo sistema; "liberado" vale para todos os espaços reais | Tornar escopo estruturado (profissão, espaço, população) ou liberar por espaço |
| Uma única pessoa registra a decisão | Erro ou abuso não é barrado | Dupla aprovação (quatro olhos) e MFA na administração |
| Versões digitadas manualmente | Admin pode registrar decisão para versão inexistente | Selecionar versões a partir do registro de protocolos |
| `demonstracao` e `em_validacao` não têm efeito distinto | Estados só informativos | Documentar ou implementar efeito específico |

## 4. Evidências exigidas antes de registrar "liberado"

O campo `evidence` deve listar **identificadores de documentos arquivados** (não texto livre genérico). Todos os grupos abaixo precisam estar completos para a combinação exata recurso + versão do algoritmo + versão do protocolo + modelo/runtime.

### A. Software (responsável técnico)

- [ ] Correção de proporção da imagem implementada e verificada com geometria conhecida (TESTE-101 aprovado) — **bloqueio atual**.
- [ ] Runtime WASM e pacote JS na mesma versão; modelo e runtime servidos com integridade verificável (RISCO-015).
- [ ] Todos os testes automatizados aprovados na versão candidata; matriz de rastreabilidade atualizada sem itens "não executado" críticos.
- [ ] Teste ponta a ponta de lado anatômico em Safari/iOS e Chrome/Android (TESTE-102, TESTE-105).
- [ ] Análise de impacto da versão registrada (`controle-de-versoes-e-mudancas.md`).

### B. Desempenho analítico (responsável pela validação)

- [ ] Relatório por grandeza e lado conforme `docs/validacao/plano-analitico-e-clinico.md`, com critérios de aceitação **definidos antes** da coleta e atendidos.
- [ ] Taxa de rejeição/captura insuficiente relatada junto com o erro nos casos aceitos.
- [ ] Aparelhos, orientações e condições cobertos correspondem ao escopo pretendido.

### C. Clínica e usabilidade (responsáveis clínicos)

- [ ] Protocolo clínico aprovado (perguntas de segurança, instruções, interrupção) — PE-14.
- [ ] Evidência clínica pertinente ao uso e avaliação de usabilidade das tarefas críticas.

### D. Regulatória (responsável regulatório)

- [ ] Parecer de enquadramento (PE-01) e, quando aplicável, **evidência da regularização efetiva** com escopo compatível (PE-03).
- [ ] Obrigações da empresa conferidas (PE-02).

### E. Privacidade e jurídico

- [ ] Textos de aceite, aviso de privacidade, termos e contrato de tratamento aprovados e publicados como nova versão (PE-09, PE-10).
- [ ] Hospedagem, subprocessadores e retenção definidos (PE-11, PE-12).

### F. Operação

- [ ] Ambiente de produção separado, backup e restauração testados (RISCO-010).
- [ ] Procedimento de incidentes ativo e simulação de suspensão executada (`docs/operacao/incidentes-e-reclamacoes.md`).
- [ ] Instruções de uso revisadas para a versão (`docs/produto/instrucoes-de-uso.md`).

### G. Decisão

- [ ] Responsáveis nomeados (técnico, clínico, regulatório, privacidade) assinaram a decisão fora do sistema; o registro no sistema referencia esse documento.

## 5. O que **não** autoriza "liberado"

- Testes automatizados aprovados; revisão profissional de resultados; aceite de termos pela pessoa.
- Piloto operacional de 30 a 50 pessoas (não é estudo de validação).
- Correlação alta isolada com instrumento de referência.
- Pagamento de taxa, protocolo administrativo, contratação de plano, rótulo "beta" ou uso interno.

## 6. Suspensão

1. Administração registra `suspenso` para a combinação recurso + versões afetada, com motivo no campo de evidências e referência ao registro de incidente.
2. Efeito imediato: novas solicitações, reemissões, inícios e envios de resultado são recusados (TESTE-022). Resultados e devolutivas anteriores continuam consultáveis.
3. Avaliar comunicação aos profissionais afetados e às autoridades conforme `incidentes-e-reclamacoes.md` (obrigações a confirmar).
4. Retorno exige nova decisão com novas evidências; nunca reprocessar silenciosamente os resultados antigos.
