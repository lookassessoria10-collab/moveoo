# Requisitos do produto

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano.
> Requisitos derivados do plano (cap. 5, 6, 8, 15, 18, 24) e do código existente. Situação: **SW-V** = verificado por teste automatizado aprovado em 2026-10-04; **SW** = implementado sem teste específico; **Parcial**; **NI** = não implementado. Testes listados em `docs/qualidade/matriz-de-rastreabilidade.md`.
> Requisitos de software não comprovam desempenho clínico.

## Acesso e identidade

| ID | Requisito | Origem | Implementação | Situação |
| --- | --- | --- | --- | --- |
| REQ-001 | Conta do profissional com confirmação de e-mail; convites só após e-mail confirmado | 6 (Base), 24.8 | `services/accounts.ts`, `assertCanInvite` em `services/assessments.ts` | SW |
| REQ-002 | Senha com hash forte; bloqueio temporário após falhas seguidas; mesma resposta para conta inexistente | 24.9 | scrypt (`lib/server/crypto.ts`); 5 falhas → 15 min (`config/platform.ts`) | SW-V |
| REQ-003 | Recuperação de senha por token de uso único com validade curta; encerra sessões abertas | 6 | `requestPasswordReset`, `resetPassword` (1 h) | SW |
| REQ-004 | Autenticação adicional (MFA) para perfis com acesso clínico e administração | 14, 24.8 | — | NI |
| REQ-005 | Registro profissional começa "pendente"; conferência manual com fonte, data e responsável; espaço real e convites reais exigem "verificado" | 4, 24.7 | `services/admin.ts`, `services/workspaces.ts`, `assertCanInvite` | SW-V (efeito em espaço real) |

## Isolamento e autorização

| ID | Requisito | Origem | Implementação | Situação |
| --- | --- | --- | --- | --- |
| REQ-006 | Todo registro de atendimento pertence a um espaço; o banco impede referência a objeto de outro espaço | 15 | FKs compostas `(workspace_id, id)` em `db/schema.ts` | SW-V |
| REQ-007 | Autorização no servidor por participação ativa, espaço e vínculo de atendimento; negação indistinguível de inexistência | 15, 18, 24.11 | `services/authz.ts` (`requireCareAccess`), `lib/server/errors.ts` | SW-V |
| REQ-008 | Assistente acessa cadastro, sem conteúdo clínico | 4 | `canHaveClinicalAccess` | SW-V |
| REQ-009 | Sem deduplicação de pessoas entre espaços | 15 | `persons` por espaço | SW (por desenho) |
| REQ-010 | Isolamento também por política no banco (RLS) | 14 | — (isolamento feito no servidor + FKs) | NI |

## Convite e acesso da pessoa atendida

| ID | Requisito | Origem | Implementação | Situação |
| --- | --- | --- | --- | --- |
| REQ-011 | Convite com token aleatório guardado só como hash, prazo (padrão 7, máx. 30 dias) e revogação | 15 | `invitations`, `randomToken` (256 bits), `sha256` | SW-V |
| REQ-012 | Abrir o link não autentica, não consome o convite e não revela nome, protocolo ou dado clínico | 15, 18 | `getInvitationLanding` | SW-V |
| REQ-013 | Confirmação por código de 6 dígitos gerado com o convite, exibido só ao profissional e repassado por outro meio; válido enquanto o convite valer; até 5 tentativas | 4, 24.11 | `createInvitation`, `confirmInvitation` | SW-V |
| REQ-014 | Sessão da pessoa restrita à solicitação do convite; revogar ou expirar o convite encerra a sessão | 15, 24.11 | `personScopeFromToken`, `requireScopedRequest` | SW-V |
| REQ-015 | Mensagens externas sem dados clínicos e sem nome do protocolo | 12 | `inviteMessage` | SW |
| REQ-016 | Limitar reenvio de código e tentativas por origem | 24.9 | 5 tentativas erradas por convite; no máximo um código por minuto (`codeResendSeconds = 60`). Sem limite por IP nem limite total de envios | Parcial (intervalo: SW-V) |

## Aceites

| ID | Requisito | Origem | Implementação | Situação |
| --- | --- | --- | --- | --- |
| REQ-017 | Aceites de teleatendimento e uso da câmera registrados com documento, versão, decisão, nome digitado e data; atividade bloqueada sem aceite | 13, 24.7, 24.11 | `consent_documents`, `consent_records`, `assertConsents` | SW-V |
| REQ-018 | Permissão de câmera do navegador não substitui o aceite | 13 | Texto do aceite `uso_camera` | SW |
| REQ-019 | Textos de aceite revisados juridicamente antes do uso real | 24.8 | Minutas marcadas `pendente_revisao_juridica` | NI (pendência externa PE-09) |
| REQ-020 | Menores e representação legal fora do escopo até definição jurídica | 24.7 | Aviso no formulário; sem bloqueio técnico | Parcial |

## Avaliação e resultado

| ID | Requisito | Origem | Implementação | Situação |
| --- | --- | --- | --- | --- |
| REQ-021 | Solicitação registra protocolo e versão; reavaliação exige o mesmo protocolo | 5, 10 | `createAssessmentRequest` | SW-V |
| REQ-022 | Resultado recalculado no servidor a partir das tentativas; formato validado; quadros e pontos do corpo descartados | 15, 24.5 | `lib/care/resultAdapters.ts`, `stripFrames` no cliente | SW-V |
| REQ-023 | Captura insuficiente ou ausente gera valor nulo, qualidade "insuficiente" e motivo — nunca 0 | 8, 24.6 | `makeMetric` | SW-V |
| REQ-024 | Origem identificada (`camera`, `manual_profissional`, `demonstracao`); demonstração recusada em espaço real | 6, 24.6 | `originEnum`, `submitAssessmentResult` | SW-V |
| REQ-025 | Cada sessão registra versão do app, protocolo, algoritmo, modelo, runtime e dimensões do vídeo | 15, 24.5 | `assessment_sessions` (`device.videoWidth/Height`) | SW-V (algoritmo e modelo); SW (dimensões) |
| REQ-026 | Reenvio idempotente não duplica sessão nem medidas | 18 | `idempotency_key` único por solicitação | SW-V |
| REQ-027 | Interrupção (saída da página, câmera indisponível, perguntas de segurança, decisão da pessoa) registrada com motivo | 18, 24.11 | `interruptAssessment`, `sendBeacon` | SW-V (saída da página) |
| REQ-028 | Lado anatômico correto independentemente do espelhamento da prévia | 8, 18 | Espelhamento na conversão; lado vem do bloco do módulo | Parcial (só mapeamento verificado) |
| REQ-029 | Cálculo angular com correção da proporção largura/altura da imagem | 8 | — | **NI (crítico)** |
| REQ-030 | Telas legadas não exibem 0° ou `-Infinity` quando não há tentativas | 8 | — | NI |
| REQ-031 | Pessoa não recebe números provisórios | 5, 10 | `CareAssessmentRunner` substitui a tela de resultado | SW |
| REQ-032 | Câmera sem áudio; recursos encerrados ao sair | 14 | `hooks/useCamera.ts` (`audio: false`, `track.stop()`) | SW |

## Revisão, devolutiva e comparação

| ID | Requisito | Origem | Implementação | Situação |
| --- | --- | --- | --- | --- |
| REQ-033 | Revisão por medida (aceita/corrigida/descartada), justificativa obrigatória para correção e descarte, registro append-only preservando o original | 15, 24.11 | `reviewSession`, `measurement_reviews` | SW-V |
| REQ-034 | Medida sem valor válido não pode ser aceita | 8 | `reviewSession` | SW-V |
| REQ-035 | Devolutiva só após revisão; nova versão substitui a anterior sem apagá-la; pessoa vê só a versão vigente e medidas revisadas escolhidas | 10, 18 | `publishFeedback`, `getPublishedFeedbackForPerson` | SW-V |
| REQ-036 | Comparação só entre mesma grandeza, lado, unidade, método, protocolo (versão principal) e algoritmo; diferença sem rótulo de melhora; motivo explícito de incompatibilidade | 10, 24.6 | `lib/care/comparison.ts` | SW-V |
| REQ-037 | Relatório a partir de dados persistidos com origem, versões, estado de revisão e limitações | 10, 24.11 | `app/painel/avaliacoes/[id]/relatorio` (impressão pelo navegador) | SW |

## Liberação e rastreabilidade

| ID | Requisito | Origem | Implementação | Situação |
| --- | --- | --- | --- | --- |
| REQ-038 | Liberação no servidor por recurso + versão do algoritmo + versão do protocolo; sem registro = desenvolvimento | 24.4 | `getReleaseState`, `assertProtocolExecutable` | SW-V |
| REQ-039 | Espaço real só executa "liberado"; "suspenso" bloqueia em qualquer ambiente, inclusive chamada direta | 24.4, 24.11 | idem | SW-V |
| REQ-040 | Só administração registra decisão, com escopo e evidências, auditada | 24.4 | `recordReleaseDecision` | SW-V |
| REQ-041 | Modelo e runtime associados à liberação | 24.4 | Não fazem parte da chave | NI |
| REQ-042 | Auditoria de ações relevantes sem conteúdo clínico | 24.8 | `audit()` com metadados restritos | SW |

## Segurança, privacidade e operação

| ID | Requisito | Origem | Implementação | Situação |
| --- | --- | --- | --- | --- |
| REQ-043 | Cabeçalhos de segurança; câmera só na própria origem; microfone negado; link de convite sem `Referer` e `noindex` | 14 | `next.config.js` | SW (sem CSP e HSTS) |
| REQ-044 | Rotas da pessoa com verificação de origem e limite de tamanho do corpo | 24.9 | `lib/server/personApi.ts` (512 KB) | SW |
| REQ-045 | Segredos de convite, código e redefinição nunca persistidos em texto | 15, 24.8 | Hash nas tabelas; **mas** o corpo da caixa de saída guarda link e código em texto | Parcial |
| REQ-046 | Retenção por categoria e descarte | 24.8 | — | NI |
| REQ-047 | Canal de solicitações do titular e exportação autenticada | 24.8 | — | NI |
| REQ-048 | Backup e restauração testados | 24.9 | — (PGlite local) | NI |
| REQ-049 | Modelo e runtime com versões fixas, coerentes e integridade verificável | 8 | Versões fixas na URL; WASM 0.10.17 ≠ npm 0.10.35; sem verificação de integridade | Parcial |
| REQ-050 | Envio real de e-mail/SMS por fornecedor contratado | 12 | Caixa de saída local (`/dev/caixa-de-saida`) | NI |
| REQ-051 | Vídeo opcional com armazenamento privado e URLs temporárias | 14, 24.8 | — | NI (fora do primeiro ciclo) |
