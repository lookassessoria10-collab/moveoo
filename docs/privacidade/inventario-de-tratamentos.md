# Inventário de tratamentos de dados pessoais

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano (encarregado e assessoria jurídica).
> **Bases legais: A CONFIRMAR** — as indicadas são apenas candidatas para análise; consentimento não deve ser usado como base automática para todas as operações (24.8). **Papéis das partes: hipóteses** — não presumir que a plataforma seja somente operadora (24.8). **Retenção: A DEFINIR** — não há descarte implementado. **País de hospedagem: não decidido.** Fontes: ANPD [24], [36] — **fonte a reverificar antes do lançamento**.
> Descreve o software local da branch `claude/plataforma`. Não há dados reais: somente dados fictícios de desenvolvimento.

## 1. Partes (hipóteses a confirmar — PE-10)

| Parte | Hipótese de papel |
| --- | --- |
| Profissional ou organização (espaço de atendimento) | Controlador dos dados do atendimento das pessoas que atende |
| Moveo (empresa da plataforma) | Operadora para os dados do atendimento; controladora para contas de profissionais, segurança, auditoria, verificação profissional e decisões de liberação — **a confirmar operação a operação** |
| Fornecedores (hospedagem, e-mail/SMS, CDN) | Suboperadores ou terceiros independentes — a definir por contrato |

## 2. Dados, origem e finalidade

| ID | Dados | Titular | Origem | Finalidade | Sensível? |
| --- | --- | --- | --- | --- | --- |
| T-01 | Nome, e-mail, hash de senha, falhas de acesso, bloqueio, sessões (hash), tokens de e-mail/senha (hash) | Profissional | Próprio titular | Conta, autenticação, segurança | Não |
| T-02 | Profissão, conselho, região, número de registro, UF; estado, fonte, nota, responsável e data da verificação | Profissional | Titular; administração | Conferir habilitação para atendimento real | Não (dado profissional) |
| T-03 | Nome do espaço, tipo, ambiente, cor, logotipo; membros e papéis | Profissional | Gestor | Organização do atendimento e controle de acesso | Não |
| T-04 | Nome, e-mail, telefone, canal preferido, cidade/UF (opcionais), marca de fictício, arquivamento | Pessoa atendida | Profissional ou assistente | Cadastro, contato, envio de convites | Não, mas vinculado a atendimento de saúde |
| T-05 | Título do episódio (objetivo ou motivo do acompanhamento), modalidade, nota de adequação do remoto | Pessoa atendida | Profissional | Registro do atendimento | **Pode conter dado de saúde** (texto livre) |
| T-06 | Vínculo profissional ↔ pessoa, datas | Pessoa / profissional | Gestor/profissional | Controle de acesso clínico | Não |
| T-07 | Aceites: documento, versão, decisão, nome digitado, convite, data | Pessoa atendida | Pessoa | Registro do aceite de teleatendimento e uso da câmera (documentação exigida por norma profissional [21]) — **não é, por si, a base legal LGPD** | Associado a saúde |
| T-08 | Convite: hash do token, canal, prazos, acesso, confirmação, revogação, hash do código, tentativas | Pessoa atendida | Sistema | Acesso seguro à atividade | Não |
| T-09 | Sessão da pessoa (hash, expiração) | Pessoa atendida | Sistema | Manter acesso com escopo | Não |
| T-10 | Solicitação: protocolo, instruções livres, prazo, supervisão, reavaliação | Pessoa atendida | Profissional | Organização do cuidado | **Sim** (instruções podem conter saúde) |
| T-11 | Sessão de avaliação: contexto relatado (dor inicial, lado dos sintomas, tempo de queixa, dor por movimento), resumo do módulo (ângulos máximos, durações e compensação por tentativa), `userAgent`, `videoWidth`, `videoHeight`, versões, motivo de interrupção | Pessoa atendida | Pessoa (via celular) | Avaliação de movimento e rastreabilidade | **Sim** |
| T-12 | Medidas: grandeza, lado, valor, unidade, método, tentativas, qualidade, motivo | Pessoa atendida | Servidor (recalculado) ou profissional | Avaliação e acompanhamento | **Sim** |
| T-13 | Revisões (decisão, valor corrigido, justificativa, revisor) e devolutivas (texto, versão, autor) | Pessoa atendida / profissional | Profissional | Registro profissional e orientação | **Sim** |
| T-14 | Eventos de auditoria: ator, ação, objeto, metadados (ids, estados, versões) | Todos | Sistema | Segurança, rastreabilidade, prova de conformidade | Não por desenho (sem conteúdo clínico) |
| T-15 | Caixa de saída: canal, destinatário (e-mail/telefone), assunto, corpo com link e código | Pessoa / profissional | Sistema | Envio de convites e códigos (hoje só local) | Não, mas **contém segredos** (RISCO-014) |
| T-16 | Imagem da câmera e pontos do corpo em tempo real | Pessoa atendida | Câmera | Cálculo no aparelho | **Imagem do corpo**; não persistida nem enviada |
| T-17 | Requisição ao CDN (IP, `User-Agent`) | Pessoa atendida | Navegador | Baixar modelo e runtime | Não |
| T-18 | Modo de validação: códigos de voluntário e examinador, medidas, valor de referência, confiança, pontos 2D/3D brutos, `userAgent` | Voluntário de pesquisa | Examinador | Validação analítica | Pseudonimizado; **relacionado à saúde** |
| T-19 | Decisões de liberação (responsável, escopo, evidências) | Administração | Administração | Controle de qualidade | Não |
| T-20 | Preferência de voz (localStorage) | Usuário do aparelho | Usuário | Conveniência | Não |
| T-21 | Avaliação livre `/assessment/*` | Qualquer pessoa | Pessoa | Autoavaliação (legado) | **Sim**, mas só em memória no navegador; nada enviado |

## 3. Base legal, destinatários, país, retenção, acesso e descarte

| ID | Base legal candidata (**A CONFIRMAR**) | Destinatários | País | Retenção (**A DEFINIR**) | Acesso no sistema | Descarte |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | Execução de contrato; legítimo interesse para segurança | Moveo; hospedagem | A definir | A definir | Titular; administração (sem tela de edição) | NI |
| T-02 | Execução de contrato; cumprimento de obrigação regulatória — a confirmar | Moveo (administração) | A definir | A definir | Administração; o próprio profissional | NI |
| T-03 | Execução de contrato | Membros do espaço | A definir | A definir | Membros ativos | NI |
| T-04 | Tutela da saúde em procedimento por profissional de saúde / execução de contrato — a confirmar; **verificar se a hipótese de tutela da saúde alcança profissionais de educação física** | Profissionais do espaço; fornecedor de mensagens (futuro) | A definir | A definir; considerar guarda de prontuário | Membros do espaço (cadastro); clínico só com vínculo | Arquivamento existe (`archived_at`); exclusão NI |
| T-05, T-10 a T-13 | Tutela da saúde (art. 11 da LGPD) — a confirmar por operação e profissão | Profissional com vínculo; gestor com vínculo | A definir | A definir — conciliar com obrigação de guarda do registro profissional (prazo a confirmar com conselhos) | Papel clínico + vínculo ativo | NI |
| T-06 | Execução de contrato / legítimo interesse do controlador | Membros | A definir | A definir | Gestor | NI |
| T-07 | Cumprimento de obrigação regulatória/profissional — a confirmar | Profissional; Moveo | A definir | A definir (prova do aceite) | Escopo da pessoa; profissional | NI |
| T-08, T-09 | Legítimo interesse / execução — a confirmar | Moveo | A definir | Curta; a definir | Sistema | NI (expiram, não são apagados) |
| T-14 | Legítimo interesse; cumprimento de obrigação — a confirmar | Moveo (administração) | A definir | A definir | Administração (`/admin/auditoria`) | NI |
| T-15 | Execução / legítimo interesse — a confirmar | Fornecedor de e-mail/SMS (futuro); WhatsApp quando o profissional usa o link | A definir | **Mínima** — corpo não deveria ser persistido | Página de desenvolvimento | NI |
| T-16 | Mesma do atendimento; aceite `uso_camera` documenta a informação dada à pessoa | Ninguém (no aparelho) | Aparelho da pessoa | Não persistido | — | Encerrado ao sair |
| T-17 | Legítimo interesse — a confirmar | jsDelivr; Google | A confirmar (CDN global) | Conforme o fornecedor | — | — |
| T-18 | Conforme protocolo de pesquisa e aprovação ética (PE-16) — **consentimento de pesquisa provavelmente necessário, a confirmar** | Equipe de validação | Aparelho do examinador; arquivos exportados | Definida no protocolo de pesquisa | Quem tem o aparelho/arquivo | Botão de limpeza local; arquivos exportados: procedimento a definir |
| T-19 | Legítimo interesse; obrigação regulatória — a confirmar | Moveo | A definir | Permanente enquanto o produto existir — a confirmar | Administração | NI |
| T-20 | Não aplicável (preferência técnica) | — | Aparelho | Até o usuário limpar | — | — |
| T-21 | A definir na decisão sobre o legado (PE-23) | Ninguém | Aparelho | Sessão do navegador | — | Ao fechar a página |

## 4. Princípios já implementados

- Coleta mínima no cadastro da pessoa (sem CPF, endereço ou documentos).
- Vídeo não gravado; quadros e pontos do corpo removidos antes do envio e descartados pelo servidor (TESTE-031).
- Acesso clínico só com vínculo ativo; outros espaços não descobrem a existência da pessoa (TESTE-002, 005).
- Mensagens externas sem dados clínicos.
- Auditoria sem conteúdo clínico (por convenção; sem teste).
- Nenhuma ferramenta de publicidade ou análise de uso; nenhum uso de dados para treinar modelos.

## 5. Lacunas

| Lacuna | Referência |
| --- | --- |
| Canal de solicitações do titular, exportação autenticada e fluxo de exclusão com análise de guarda | REQ-047 |
| Política de retenção por categoria, incluindo backups | REQ-046, PE-12 |
| Textos de aceite e aviso mencionam os dados técnicos desde 04/10/2026 (aceite `uso_camera` minuta-2); revisão jurídica pendente | PE-09 |
| Corpo da caixa de saída guarda contato e segredos | RISCO-014 |
| Hospedagem, subprocessadores e transferência internacional | PE-11 |
| Contrato de tratamento entre plataforma e profissionais | PE-09, PE-10 |
| Aceites separados para comunicação comercial, pesquisa e guarda opcional de vídeo (ainda não existem essas finalidades no software) | 24.8 |
| Revogação do aceite pela própria pessoa (modelo de dados suporta `revogado`; não há tela) | REQ-017 |
| Procedimento de incidentes de dados | PE-13 |
