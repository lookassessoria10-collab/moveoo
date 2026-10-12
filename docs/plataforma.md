# Plataforma Moveo — arquitetura, modelo de dados e plano

Data: 04/10/2026 · Estado: **primeiro ciclo completo funcionando em ambiente local**, com dados fictícios.
Referências: plano de produto (`moveo-pesquisa-e-plano-claude-code.md`), [auditoria](auditoria.md), documentação regulatória em `docs/regulatorio`, `docs/qualidade`, `docs/privacidade`, `docs/seguranca`, `docs/validacao`, `docs/propriedade-intelectual`.

## 1. O que está pronto

Ciclo verificado de ponta a ponta no navegador e por testes automatizados:

1. Profissional cria conta (fisioterapia ou educação física, com conselho e número) → espaço de **demonstração** criado automaticamente, registro "não verificado".
2. Confirma o e-mail (sem isso, não envia convites).
3. Cadastra a pessoa (paciente/aluno) e o episódio/objetivo, com modalidade e a decisão sobre a adequação do remoto.
4. Solicita avaliação (protocolo, **movimentos e lados escolhidos**, prazo, supervisão, orientações) → convite individual por e-mail, SMS ou WhatsApp (envio manual pelo profissional) + **código de acesso de 6 dígitos mostrado só ao profissional**, que o repassa por outro meio.
5. A pessoa abre o link (sem login, sem dados expostos) e digita o código recebido do profissional → sessão restrita àquela atividade. O código vale enquanto o convite valer; 5 erros bloqueiam o convite.
6. Registra os aceites (atendimento a distância e uso da câmera, com versão do texto).
7. Faz a avaliação com o módulo existente, na marca do espaço; resultado vai para o servidor, que recalcula medidas e qualidade.
8. Profissional revisa cada medida (aceitar, corrigir com justificativa, descartar), publica a devolutiva (versionada) e pode incluir as medidas revisadas.
9. A pessoa vê o retorno. O profissional solicita reavaliação; a comparação explica incompatibilidades.
10. Também: medição presencial (goniômetro, inclinômetro…), relatório para impressão/PDF, painel "Hoje", equipe e vínculos, administração (verificação manual, liberação por recurso, auditoria).
11. Tutorial de boas-vindas no painel: pop-ups em passos que explicam o ciclo principal e destacam no menu onde fica cada coisa (`components/platform/Tutorial.tsx`, textos em `tutorialSteps.tsx`). Abre sozinho na primeira visita a "Hoje" de uma conta nova; concluir, pular ou fechar grava `users.tutorial_seen_at`. Reabre pelo botão "Como funciona", no menu. Os passos seguem a profissão (paciente/aluno) e o papel (assistente não vê os passos de avaliação). Contas que já existiam quando a coluna foi criada ficaram marcadas como vistas.
12. Gestão de usuários pela administração (`lib/server/services/adminUsers.ts`): visão geral com números da base (contas, novas, ativas em 30 dias, verificação pendente, cadastros por semana, funil conta → pessoa → avaliação solicitada → realizada → devolutiva, por profissão e UF), lista com busca e filtros, planilha CSV (Excel em português), ficha com edição da conta e do registro (mudar o registro volta a verificação para pendente), confirmar e-mail e destravar acesso manualmente, dar/remover acesso de administração, etiquetas e anotações internas. **Desativar** bloqueia o acesso e derruba as sessões, sem apagar nada; **excluir definitivamente** só contas sem nenhum registro de atendimento ou decisão (a ficha lista o que impede). Ninguém desativa, exclui ou tira o próprio acesso de administração. Tudo vai para a auditoria, sem nome, e-mail ou texto livre na metadata.

## 2. Decisões técnicas

| Decisão | Escolha | Por quê | Caminho para produção |
| --- | --- | --- | --- |
| Framework | Manter Next.js 14 (App Router) | Módulos de câmera já funcionam nele; Server Components + Server Actions cobrem o backend | Manter |
| Banco | Local: **PGlite** (Postgres em WebAssembly) em `.data/pglite`. Com `DATABASE_URL`: PostgreSQL hospedado (Neon na Vercel) via node-postgres | Roda local sem instalação; o mesmo SQL e as mesmas migrações servem ao hospedado | Na Vercel, migrações e contas fictícias no build (`vercel-build` → `db/migrate.ts`). Região, subprocessadores e backup a decidir antes de uso real |
| ORM / migrações | Drizzle (`db/schema.ts` → `db/migrations/*.sql`) | Tipos fortes, SQL explícito e revisável | Igual |
| Autenticação | Própria: scrypt, sessão com token aleatório (só o hash no banco), cookie `httpOnly` | Sem serviço externo no ambiente local; regras auditáveis | Avaliar provedor gerenciado; **MFA obrigatório antes do atendimento real** |
| Autorização | No servidor, em toda consulta: espaço → papel → vínculo | Identificador do navegador nunca basta | Acrescentar RLS no Postgres hospedado |
| Isolamento no banco | Chaves estrangeiras compostas `(workspace_id, id)` | Impossível ligar registro a pessoa/solicitação de outro espaço | Igual + RLS |
| Mensagens | Caixa de saída no banco; `/dev/caixa-de-saida` só na hospedagem local. Código de acesso exibido ao profissional, que repassa | Sem provedor externo; link por WhatsApp com envio manual | Provedor de e-mail (confirmação de conta) e, se desejado, SMS/WhatsApp automático com consentimento do canal |
| Câmera | Módulos existentes, no aparelho; só números e respostas vão ao servidor | Privacidade e reaproveitamento | Servir modelo da própria origem (auditoria A5) |
| PDF | Impressão do navegador | Sem dependência nova | Geração no servidor quando houver demanda |

## 3. Modelo de dados

Arquivo: `db/schema.ts`. Nomes do plano → tabelas:

| Conceito do plano | Tabela | Notas |
| --- | --- | --- |
| User | `users`, `user_sessions`, `user_tokens` | Bloqueio após 5 falhas; tokens de e-mail/senha com validade |
| ProfessionalProfile | `professional_profiles` | `pendente/verificado/recusado`, fonte e responsável da conferência |
| Workspace | `workspaces` | `environment`: `demonstracao` ou `real` (nunca muda) |
| Membership | `memberships` | `gestor`, `profissional`, `assistente` |
| Person | `persons` | Por espaço, sem deduplicação entre espaços; `is_fictitious` |
| CareRelationship | `care_relationships` | Sem vínculo ativo = sem acesso clínico |
| CareEpisode | `care_episodes` | Modalidade e adequação do remoto |
| ConsentRecord | `consent_documents`, `consent_records` | Texto versionado (minuta), decisão, nome de quem aceitou, convite |
| Invitation | `invitations`, `person_sessions` | Token e código só como hash; prazo, revogação, tentativas |
| AssessmentProtocol | código: `lib/care/protocols.ts` | id + versão + métricas + limitações |
| AssessmentRequest | `assessment_requests` | `pendente → em_andamento → aguardando_revisao → revisada` / `cancelada`; reavaliação aponta a anterior |
| AssessmentSession | `assessment_sessions` | Origem, versões (app, algoritmo, modelo, runtime), contexto informado, aparelho, chave de idempotência |
| Measurement | `measurements` | Uma grandeza por linha; `value` nulo quando insuficiente |
| (revisão) | `measurement_reviews` | Só acréscimo; original preservado |
| Feedback | `feedbacks` | Versões; anterior vira `substituida` |
| (liberação) | `feature_releases` | Decisão humana por recurso + versões |
| AuditEvent | `audit_events` | Sem conteúdo clínico |
| Notification (parcial) | `outbox_messages` | Lembretes ainda não implementados |
| MediaAsset, Exercise, ProgramVersion, ExerciseSession, OutcomeForm, ClinicalNote, Subscription | — | **Não implementados** (próximas etapas) |

## 4. Contrato de resultado

Cada medida grava: pessoa e espaço (via sessão), solicitação, sessão, grandeza (`metric_key`), movimento, lado, valor, unidade, método, tentativas planejadas e analisadas, qualidade (`apta`/`insuficiente`), motivo de rejeição; a sessão grava protocolo + versão, versão do algoritmo, modelo, runtime, versão do app, momento, origem (`camera`, `manual_profissional`, `demonstracao`) e estado de revisão (`provisorio`/`revisado`).

Regras: o servidor recalcula a partir das tentativas; captura sem dado vira `null` com motivo (nunca 0°); medida sem valor não pode ser "aceita"; correção não apaga o original; quadros e pontos do corpo não são persistidos por este caminho.

Comparação (`lib/care/comparison.ts`): só mesma grandeza + lado + unidade + método + protocolo (mesma versão principal) + algoritmo, ambas com valor válido. Caso contrário, a interface mostra o motivo. A diferença nunca é rotulada como melhora.

## 5. Mapa de telas

| Área | Rota | Estado |
| --- | --- | --- |
| Pública | `/`, `/privacidade` (minuta), `/entrar`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha`, `/verificar-email` | Pronto |
| Avaliação livre (UORT) | `/assessment`, `/assessment/{shoulder,knee,spine,posture}` | Preservado |
| Profissional | `/painel` (Hoje), `/painel/pessoas`, `/painel/pessoas/nova`, `/painel/pessoas/[id]`, `.../solicitar`, `.../medicao-presencial`, `.../vinculos`, `/painel/avaliacoes/[id]`, `.../relatorio`, `/painel/equipe`, `/painel/espaco`, `/painel/perfil`, `/novo-espaco` | Pronto |
| Pessoa atendida | `/convite/[token]`, `/acompanhamento`, `/acompanhamento/consentimento`, `/acompanhamento/avaliacao/[id]`, `/acompanhamento/retorno`, `/acompanhamento/sem-acesso` | Pronto |
| Administração | `/admin` (visão geral: números e funil), `/admin/usuarios` (+ `/[id]` e `/exportar`), `/admin/verificacao`, `/admin/liberacoes`, `/admin/espacos`, `/admin/auditoria` | Pronto |
| Desenvolvimento | `/dev/caixa-de-saida` (só fora de produção) | Pronto |
| Planejado | programas e biblioteca de exercícios, vídeos e revisão, mensagens, agenda, lembretes, solicitações de titulares, planos | Próximas etapas |

## 6. Testes

`npm test` — 105 testes (57 dos módulos originais + 48 novos). Os novos cobrem, com PostgreSQL real em memória: isolamento entre organizações (inclusive com id conhecido e pela chave composta), profissional sem vínculo, assistente sem acesso clínico, prévia de link sem autenticar, código errado/bloqueio, código fora da mensagem do convite, número do WhatsApp com 55, escolha de movimentos (resultado só com o pedido, seleção inválida recusada, reavaliação repete a seleção), convite expirado e revogado (derruba a sessão), escopo da pessoa, aceites obrigatórios, captura insuficiente sem número, reenvio sem duplicar, revisão antes de publicar, correção preservando original, versões da devolutiva, comparação compatível/incompatível, interrupção, medição presencial identificada, espaço real exige verificação, função sem liberação bloqueada em espaço real, suspensão bloqueia até na demonstração, só administração decide liberação, demonstração recusada em espaço real, bloqueio de conta, resposta idêntica para conta inexistente, liberação presa à versão do modelo e mascaramento de segredos fora do desenvolvimento.

Esses testes verificam software, não precisão clínica.

## 7. Próximas etapas (com critério para avançar)

| Etapa | Trabalho | Critério |
| --- | --- | --- |
| Precisão (prioridade 1) | Corrigir proporção da imagem (A1), unificar MediaPipe (A3), modelo na própria origem (A5), nova `ALGORITHM_VERSION` | Testes com ângulos conhecidos em vídeo retrato/paisagem; reprocessamento dos dados de validação |
| 3. Programas e vídeos | Biblioteca própria/licenciada, programa individual versionado, registro de sessão, envio de vídeo privado, revisão com comentário no tempo do vídeo | Ciclo prescrever → executar → enviar → revisar → responder, com arquivos privados e URLs temporárias |
| 4. Evolução e operação | Gráfico de evolução, lembretes com preferência, painel de pendências com prazos, PDF no servidor | Dados compatíveis comparados; falhas de envio tratadas |
| Segurança antes do real | MFA, limite de tentativas por IP, RLS no Postgres, backups testados, canal de solicitações do titular, retenção por categoria | Itens do modelo de ameaças fechados |
| 5. Exercício por câmera | Catálogo pequeno com regras por fase, repetição detectada/no critério/não analisável | Critérios de validação por movimento |
| 6. Equipes e negócio | Planos e limites independentes da autorização | Bloqueio de plano nunca apaga registro nem libera função |

## 8. Serviços externos e custos a orçar

Nada abaixo foi contratado. Hospedagem da aplicação; Postgres gerenciado com backup; armazenamento de objetos privado (vídeos); provedor de e-mail transacional; SMS; API oficial do WhatsApp (se houver automação); monitoramento de erros sem dados sensíveis; revisão jurídica (termos, aviso de privacidade, contrato de tratamento); análise regulatória (Anvisa); estudo de validação por movimento; busca de marca no INPI.

## 9. Como rodar

```bash
npm install
npm run db:reset
npm run dev
```

Contas fictícias em `db/seed-data.ts` (senha em `DEMO_PASSWORD`). Links de convite, códigos e confirmações aparecem em `http://localhost:3000/dev/caixa-de-saida`. Para testar no celular, ver README (HTTPS é exigido pela câmera fora de `localhost`).
