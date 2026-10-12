# Modelo de ameaças

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano (segurança).
> Baseado em leitura do código local; nenhum teste de intrusão, varredura de dependências (`npm audit`) ou revisão externa foi executado. Não há ambiente hospedado: ameaças de infraestrutura ficam como pendências.

## 1. Ativos

| Ativo | Sensibilidade |
| --- | --- |
| Medidas, contexto relatado (dor, lado, tempo de queixa), objetivos de acompanhamento, devolutivas | Dado de saúde (sensível) |
| Cadastro de pessoas (nome, e-mail, telefone, cidade/UF) | Pessoal |
| Credenciais e sessões (hash de senha, tokens de sessão, convite, código, redefinição) | Crítico |
| Decisões de liberação e verificação profissional | Integridade crítica (segurança do paciente) |
| Trilha de auditoria | Integridade |
| Código de cálculo, modelo e runtime | Integridade (resultado clínico) |
| Dados do modo de validação (pontos brutos, códigos de voluntários) | Pesquisa, pseudonimizado |

## 2. Atores

Profissional legítimo de outro espaço; colega sem vínculo; assistente; pessoa atendida tentando ver outra atividade; terceiro com o link encaminhado; atacante externo sem conta; administração com conta comprometida; fornecedor/CDN comprometido; pessoa com acesso ao banco ou a backups.

## 3. Fronteiras de confiança

1. Navegador ↔ servidor (rotas `/api/acompanhamento/*`, Server Actions, páginas).
2. Navegador ↔ CDNs (modelo e runtime).
3. Servidor ↔ banco (PGlite local hoje; serviço gerenciado no futuro).
4. Plataforma ↔ canais externos (e-mail, SMS, WhatsApp) — envio real não implementado.

## 4. Ameaças (STRIDE resumido)

| ID | Categoria | Ameaça | Controles existentes | Lacuna / ação | Risco |
| --- | --- | --- | --- | --- | --- |
| AM-01 | Elevação de privilégio | Profissional usa id de pessoa/solicitação de outro espaço | Autorização em três camadas; consultas filtradas por `workspace_id`; FKs compostas; resposta "não encontrado" (TESTE-001 a 005) | Sem RLS; exigir revisão de código em toda consulta nova | RISCO-011 |
| AM-02 | Elevação de privilégio | Assistente acessa conteúdo clínico | `canHaveClinicalAccess` (TESTE-006) | — | RISCO-011 |
| AM-03 | Divulgação | Pré-visualização de link (WhatsApp, e-mail) expõe dados | Página do link mostra só nome do espaço; GET não autentica (TESTE-008); `noindex`; `no-referrer` | — | RISCO-012 |
| AM-04 | Falsificação | Terceiro com link encaminhado entra como a pessoa | Código ao contato cadastrado; 10 min; 5 tentativas (TESTE-009) | Comprometimento do e-mail/telefone da pessoa não é coberto | RISCO-012 |
| AM-05 | Elevação de privilégio | Pessoa usa sua sessão em outra solicitação | Escopo por convite (TESTE-011) | — | RISCO-012 |
| AM-06 | Força bruta | Adivinhar código ou senha | 5 tentativas por convite; um código por minuto; bloqueio de conta por 15 min (TESTE-009, 052, 025) | Sem limite por IP; sem limite total de envios de código (RISCO-022); bloqueio de conta permite negação de serviço direcionada | RISCO-013, 022 |
| AM-07 | Falsificação | Conta administrativa comprometida registra "liberado" | Só `is_platform_admin`; auditoria | **Sem MFA**; decisão por uma pessoa | RISCO-013, 017 |
| AM-08 | Divulgação | Leitura da tabela `outbox_messages` revela links de convite, códigos e links de redefinição de senha em texto | Página `/dev/caixa-de-saida` indisponível em produção | **Corpo persistido contém segredos** — corrigir antes de qualquer implantação | RISCO-014 |
| AM-09 | Adulteração | Navegador envia resultado forjado (valores escolhidos) | Validação de formato; recalculo a partir das tentativas; faixa plausível; demonstração recusada em espaço real | O servidor **não consegue** verificar que os números vieram da câmera; mitigação é a revisão profissional e o rótulo de origem | RISCO-006, 008 |
| AM-10 | Adulteração | CDN entrega modelo ou WASM alterado | Versões fixas na URL | Sem verificação de integridade; hospedar com hash | RISCO-015 |
| AM-11 | Falsificação de requisição | Outro site dispara ações com o cookie da pessoa | `sameSite=lax`; verificação de `Origin` em `personApi.ts`; proteção de origem nativa das Server Actions (a confirmar na versão do Next.js em uso) | Sem teste (TESTE-113) | RISCO-012 |
| AM-12 | Divulgação | Script injetado lê dados da página | React escapa conteúdo; `X-Content-Type-Options`, `X-Frame-Options: DENY` | **Sem Content-Security-Policy e sem HSTS** | — |
| AM-13 | Repúdio | Profissional nega ter alterado uma revisão ou devolutiva | Append-only; autoria e data; auditoria | Auditoria fica no mesmo banco, sem proteção contra alteração por quem administra o banco | — |
| AM-14 | Divulgação | Logs com dado clínico | `console.error` só com mensagem técnica; metadados de auditoria restritos por convenção | Sem teste (TESTE-107); sem política de logs em produção | — |
| AM-15 | Negação de serviço | Corpo de requisição enorme ou volume de requisições | Limite de 512 KB nas rotas da pessoa | Sem limitação de taxa global | RISCO-009 |
| AM-16 | Divulgação | Banco local ou backup copiado | `.data/` fora do Git | Arquivo PGlite sem criptografia própria; política de backup inexistente | RISCO-010 |
| AM-17 | Divulgação | Modo de validação ativado por URL grava pontos no aparelho | Fica no aparelho | Não é controle de acesso; verificar bloqueio no acompanhamento (TESTE-110) | RISCO-019 |
| AM-18 | Divulgação | Dado real em prompt de desenvolvimento ou teste | Seed fictício; política do cap. 24.8 | Procedimento a formalizar | — |
| AM-19 | Cadeia de suprimentos | Dependência npm comprometida ou vulnerável | `package-lock.json` | Faixas `^` em várias dependências; sem `npm audit` registrado; sem monitoramento | — |

## 5. Controles transversais existentes

- Tokens de sessão, convite, código e redefinição armazenados como SHA-256 nas tabelas próprias; comparação de código em tempo constante.
- Senhas com scrypt (N=2^15, r=8, p=1).
- Cookies `httpOnly`, `sameSite=lax`, `secure` em produção.
- `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.
- Mensagens externas sem dado clínico.
- Nenhum script de análise, publicidade ou gravação de sessão.

## 6. Prioridades antes de qualquer implantação

1. Remover segredos do corpo persistido da caixa de saída (AM-08).
2. MFA para administração e perfis clínicos; dupla aprovação para liberação (AM-07).
3. CSP e HSTS; hospedar modelo/runtime com integridade (AM-10, AM-12).
4. Limitação de taxa por origem e limite total de envios de código (AM-06, AM-15).
5. Avaliar RLS como segunda barreira no PostgreSQL hospedado, testando a conexão usada pela aplicação [27] (AM-01).
6. `npm audit` e processo de atualização de dependências registrado (AM-19).
7. Backup criptografado, restauração testada e acesso ao banco restrito (AM-16).
