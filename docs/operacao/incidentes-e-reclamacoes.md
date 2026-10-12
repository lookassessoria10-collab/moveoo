# Incidentes, reclamações e suspensão de função

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano.
> Procedimento proposto. **Prazos legais, obrigações de comunicação e destinatários oficiais não são presumidos**: devem ser confirmados pelos responsáveis regulatório e de privacidade (PE-03, PE-13). Nenhum canal de recebimento está implementado. Referência do plano: cap. 24.8 e 24.9.

## 1. Categorias

| Categoria | Exemplos | Responsável pela avaliação (a definir) |
| --- | --- | --- |
| C1 — Problema técnico | Erro ao enviar, câmera não abre, indisponibilidade, falha de login | Técnico |
| C2 — Resultado suspeito / falha de medição | Valor incompatível com o observado, lado trocado, valor igual em todas as tentativas, 0° ou ausência inesperada | Técnico + clínico |
| C3 — Evento com possível impacto à saúde | Pessoa se machucou ou piorou durante a atividade; decisão clínica baseada em medida errada | Clínico + regulatório |
| C4 — Incidente de dados | Acesso indevido, link/código exposto, dado de outro espaço visível, envio ao contato errado, perda de dados | Privacidade (encarregado) + técnico |
| C5 — Reclamação ou uso indevido | Pessoa real em espaço de demonstração, alegação comercial indevida, profissional não habilitado | Produto + jurídico |

Um mesmo evento pode ter mais de uma categoria. Na dúvida, tratar pela mais grave.

## 2. Recebimento (a implementar)

- Canais a definir: formulário no painel, e-mail de suporte, canal para a pessoa atendida (hoje só pelo profissional).
- O registro deve conter: data/hora, quem relatou, espaço, identificadores técnicos (solicitação, sessão, medida — **sem copiar conteúdo clínico** para o registro do incidente), versões (app, protocolo, algoritmo, modelo, runtime, `userAgent`), descrição, evidências.
- Fontes internas já disponíveis: trilha `/admin/auditoria` (ações relevantes, sem conteúdo clínico), colunas de versão e `device` em `assessment_sessions`, eventos `avaliacao.resultado_rejeitado_formato`, `acesso.bloqueado`.
- Não há monitoramento de erros nem alertas automáticos em produção (não existe produção).

## 3. Triagem (meta: no mesmo dia útil — a confirmar)

1. Classificar categoria e severidade (`docs/qualidade/gestao-de-riscos.md`).
2. Identificar a combinação recurso + `ALGORITHM_VERSION` + versão do protocolo + modelo/runtime envolvida.
3. Verificar se outros resultados da mesma versão podem estar afetados.
4. Decidir sobre contenção (§4).

## 4. Contenção

| Situação | Ação | Como |
| --- | --- | --- |
| Suspeita de erro sistemático em uma medida | Suspender o recurso na versão afetada | `/admin/liberacoes` → estado `suspenso`, com referência ao incidente no campo de evidências. Bloqueia novas solicitações, convites, inícios e envios em qualquer ambiente; histórico continua consultável (TESTE-022) |
| Link ou código exposto | Revogar o convite | Painel da avaliação → revogar; a sessão derivada cai imediatamente (TESTE-010) |
| Conta comprometida | Desativar conta e encerrar sessões | **Sem tela própria hoje** (`disabled_at` existe no banco; redefinição de senha encerra sessões) — implementar |
| Dado em espaço errado | Isolar e avaliar | Sem ferramenta de correção; não apagar registros sem decisão documentada |

## 5. Encaminhamento e comunicação

- **C3:** avaliar com o responsável regulatório se há obrigação de notificação sanitária (tecnovigilância) e em que prazo — **a confirmar**; informar o profissional responsável pela pessoa.
- **C4:** avaliar com o encarregado se há obrigação de comunicar ANPD e titulares e em que prazo — **a confirmar** [24]; não concluir automaticamente que a comunicação é dispensada.
- **C2 com impacto possível em decisões já tomadas:** informar os profissionais dos espaços afetados quais resultados (por versão e período) devem ser reavaliados; não alterar os resultados antigos (ver `controle-de-versoes-e-mudancas.md` §6).
- **C5 envolvendo habilitação profissional:** rever verificação (F-02) e registrar a decisão.

## 6. Correção e encerramento

1. Causa identificada e registrada.
2. Correção com análise de impacto, nova versão quando aplicável e testes (incluir teste que reproduza o problema).
3. Atualizar riscos, requisitos e matriz de rastreabilidade.
4. Nova decisão de liberação, se o recurso tiver sido suspenso, com novas evidências.
5. Encerramento registrado com responsável e data; revisão periódica dos incidentes para tendências.

## 7. Registro de incidentes

| ID | Data | Categoria | Versões | Descrição (sem conteúdo clínico) | Contenção | Comunicações | Situação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | Nenhum incidente registrado (sem uso real) | — | — | — |

Achados de auditoria de código (proporção da imagem, divergência do runtime, telas legadas, segredos na caixa de saída) estão tratados como riscos e pendências internas, não como incidentes, porque não houve uso com pessoas reais.
