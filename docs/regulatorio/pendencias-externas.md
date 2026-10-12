# Pendências externas (regulatórias, jurídicas, clínicas e de propriedade intelectual)

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano.
> Nenhum documento externo foi recebido até esta data. Nenhum número de registro, certificado, prazo legal ou aprovação é presumido. Fontes pelo número do plano (cap. 23 e 24.14) — **fonte a reverificar antes do lançamento**.

## Como usar

- Cada pendência bloqueia **apenas** o uso real do recurso indicado na última coluna; desenvolvimento e demonstração com dados fictícios continuam (24.1).
- "Situação" usa: **aberta** (nada recebido), **em andamento**, **recebida — aguardando conferência**, **conferida** (documento externo recebido e conferido por responsável identificado), **não aplicável** (com justificativa assinada).
- Pagamento de taxa, protocolo ou cadastro administrativo não muda automaticamente o recurso para liberado (24.3).
- Ao receber um documento, registrar: título, emissor, data, escopo, versão do produto a que se refere, local de guarda e quem conferiu.

## Tabela

| ID | Frente | Pendência | Responsável | Evidência esperada | Escopo | Situação | Data de revisão | Impedimento de lançamento relacionado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PE-01 | Produto | Enquadramento regulatório de cada função (SaMD ou não) [25, 30] | a definir | Parecer de especialista regulatório por função da matriz | F-11, F-13 a F-18 | aberta | a definir | Bloqueia uso real de mensuração por câmera e alegações comerciais |
| PE-02 | Empresa | Papel de fabricante/detentor, licença sanitária local, AFE, responsável técnico e boas práticas aplicáveis [25, 31, 32] | a definir | Lista de exigências confirmada; documentos da empresa e respectivas validades (sem presumir) | Empresa | aberta | a definir | Bloqueia comercialização de função enquadrada como SaMD |
| PE-03 | Produto | Classe e caminho de notificação ou registro; conteúdo do dossiê [31, 32] | a definir | Decisão documentada; protocolo e **evidência da regularização efetiva** com escopo | Funções enquadradas | aberta | a definir | Bloqueia registro de "liberado" para função enquadrada |
| PE-04 | Produto | Monitorar revisão da RDC 657/2022 prevista no PGA 2026 [26] | a definir | Registro de conferência das normas vigentes na data do lançamento | Todas | aberta | a definir | Bloqueia lançamento até a conferência |
| PE-05 | Serviço | Modelo operacional: licença de software apenas ou também prestação de atendimento; obrigações de pessoa jurídica e responsabilidade técnica perante conselhos | a definir | Descrição do modelo aprovada; parecer sobre obrigações | Empresa | aberta | a definir | Bloqueia contratação comercial |
| PE-06 | Profissionais | Aplicação da Resolução COFFITO 619/2025 (consentimento, prontuário, adequação, avaliação presencial) [21] | a definir | Parecer ou checklist conferido por fisioterapeuta responsável | Espaços de fisioterapia | aberta | a definir | Bloqueia atendimento real por fisioterapeutas |
| PE-07 | Profissionais | Aplicação da Resolução CONFEF 542/2024 e normas regionais [22, 23]; não estender regras da fisioterapia | a definir | Parecer ou checklist conferido por profissional de educação física responsável | Espaços de educação física | aberta | a definir | Bloqueia atendimento real por profissionais de educação física |
| PE-08 | Profissionais | Procedimento de verificação de registro (fonte oficial, periodicidade, recusa) | a definir | Procedimento escrito; fontes de consulta aceitas | F-02 | aberta | a definir | Bloqueia criação de espaços reais além de testes internos |
| PE-09 | Dados | Revisão jurídica das minutas de aceite (`teleatendimento`, `uso_camera` — versão `2026-10-minuta-1`), aviso de privacidade (`/privacidade`), termos de uso e contrato de tratamento de dados | a definir | Textos aprovados, com versão; nova versão publicada no banco | F-06 | aberta | a definir | Bloqueia uso com pessoas reais |
| PE-10 | Dados | Papéis LGPD (controlador/operador) por operação e bases legais [24] | a definir | Parecer; atualização de `docs/privacidade/inventario-de-tratamentos.md` | Todas | aberta | a definir | Bloqueia uso com pessoas reais |
| PE-11 | Dados | Hospedagem, subprocessadores, países e transferência internacional [36] | a definir | Decisão de fornecedor; contratos; mecanismo de transferência quando aplicável | Todas | aberta (hospedagem não decidida) | a definir | Bloqueia qualquer implantação fora do ambiente local |
| PE-12 | Dados | Política de retenção por categoria, inclusive guarda de prontuário exigida por conselhos e backups | a definir | Tabela de retenção aprovada | Todas | aberta | a definir | Bloqueia uso real (não há descarte implementado) |
| PE-13 | Dados / operação | Procedimento de incidentes de dados: avaliação, comunicação à ANPD e aos titulares — prazos a confirmar | a definir | Procedimento aprovado; contatos definidos (encarregado) | Todas | aberta | a definir | Bloqueia uso real |
| PE-14 | Clínica | Aprovação das perguntas de segurança, orientações de interrupção e instruções de execução por responsável clínico de cada profissão (24.6) | a definir | Protocolo clínico aprovado e versionado | F-13 a F-17 | aberta | a definir | Bloqueia uso real de mensuração |
| PE-15 | Clínica | Plano de validação analítica e clínica com apoio metodológico (tamanho de amostra, critérios de aceitação) | a definir | Plano aprovado; relatório por movimento e versão | F-13 a F-16 | aberta (rascunho em `docs/validacao/plano-analitico-e-clinico.md`) | a definir | Bloqueia "liberado" para cada medida |
| PE-16 | Clínica / ética | Avaliação ética e regulatória antes de recrutar ou coletar dados de pessoas, conforme o desenho do estudo | a definir | Aprovação ética e demais autorizações aplicáveis | F-19 e estudos de validação | aberta | a definir | Bloqueia coleta de validação com voluntários |
| PE-17 | Propriedade intelectual | Licença do modelo `pose_landmarker_full` (pesos) e do runtime WASM, separada da licença do código | a definir | Licença/termos do modelo conferidos e arquivados | F-13 a F-19 | aberta | a definir | Bloqueia uso comercial do motor |
| PE-18 | Propriedade intelectual | Busca e análise da marca "Moveo" no INPI [33] | a definir | Relatório de busca e parecer | Marca | aberta | a definir | Bloqueia uso comercial da marca |
| PE-19 | Propriedade intelectual | Titularidade do código: contribuições humanas, contratos, uso de IA; registro facultativo de programa [34] | a definir | Contratos e declaração de titularidade | Código | aberta | a definir | Bloqueia cessão/licenciamento a terceiros |
| PE-20 | Propriedade intelectual | Autorização de uso da identidade UORT (`public/brand/`, `config/app.ts`) | a definir | Autorização escrita do cliente | Telas `/assessment/*` | aberta | a definir | Bloqueia publicação com a marca UORT |
| PE-21 | Dados / jurídico | Atendimento de menores e representação legal | a definir | Definição jurídica e fluxo próprio | Fora do escopo | aberta | a definir | Mantém menores fora do escopo liberado |
| PE-22 | Operação | Fornecedor de envio de e-mail/SMS e uso do WhatsApp (contratos, dados, país) | a definir | Contrato e configuração; atualização do inventário | F-05 | aberta (envio real não implementado) | a definir | Bloqueia convites reais |
| PE-23 | Produto | Decisão sobre as telas públicas `/assessment/*` (manter, restringir ou retirar) | a definir | Decisão de produto + parecer (PE-01) | F-18 | aberta | a definir | Bloqueia lançamento público enquanto as telas exibirem números sem revisão |

## Itens internos que também bloqueiam liberação (não são externos, mas constam para visão única)

| ID | Item | Referência |
| --- | --- | --- |
| PI-01 | Correção de proporção da imagem no cálculo dos ângulos + nova `ALGORITHM_VERSION` + verificação | RISCO-001 |
| PI-02 | Alinhar versão do runtime WASM com o pacote e hospedar modelo/runtime com integridade verificável | RISCO-015 |
| PI-03 | MFA para administração e perfis clínicos | RISCO-013 |
| PI-04 | Remover segredos (tokens, códigos) do corpo persistido da caixa de saída | RISCO-014 |
| PI-05 | Backup e restauração testados; hospedagem | RISCO-010 |
| PI-06 | Corrigir telas legadas que podem exibir 0° ou `-Infinity` | RISCO-006 |
