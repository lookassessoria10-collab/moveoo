# Finalidade pretendida do Moveo

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano.
> Este documento **não** declara aprovação, isenção, classe de risco, validação clínica ou patenteabilidade. Onde aparece "hipótese", "a confirmar" ou "pendente", a decisão cabe ao responsável competente.
> Base: código local da branch `claude/plataforma` (alterações ainda não commitadas), `package.json` 0.2.0-dev, `ALGORITHM_VERSION` = `2026.09-smoothing-v1`, protocolos 1.0.0. Fontes citadas pelo número usado em `moveo-pesquisa-e-plano-claude-code.md` (cap. 23 e 24.14) — **fonte a reverificar antes do lançamento**.

## Legenda de situação (usada em todo o conjunto `docs/`)

| Código | Significado |
| --- | --- |
| **SW-V** | Implementado e verificado em software por teste automatizado aprovado (`npm test`) |
| **SW** | Implementado, sem teste automatizado específico |
| **NI** | Não implementado |
| **CLIN** | Evidência analítica ou clínica ainda necessária |
| **REG/JUR** | Decisão regulatória ou jurídica pendente |
| **EXT** | Documento externo recebido e conferido por responsável identificado — **nenhum até 2026-10-04** |
| **AUT** | Função autorizada para escopo e versão específicos — **nenhuma até 2026-10-04** |

Testes automatizados aprovados verificam comportamento do software. Não equivalem a validação clínica, autorização sanitária nem parecer jurídico.

## 1. Identificação

| Item | Valor atual |
| --- | --- |
| Nome de trabalho | Moveo (disponibilidade da marca não verificada — ver `docs/propriedade-intelectual/pendencias.md`) |
| Versão do aplicativo | `0.2.0-dev` (`package.json`, registrada em cada sessão como `app_version`) |
| Versão do algoritmo de medição | `2026.09-smoothing-v1` (`config/precision.ts`) |
| Modelo de rastreamento | `pose_landmarker_full/float16/1` (MediaPipe), runtime `tasks-vision js 0.10.35 / wasm 0.10.17` (`lib/pose/modelInfo.ts`) |
| Protocolos | `ombro-camera`, `joelho-camera`, `coluna-camera`, `postura-sentada-camera`, `registro-presencial` — todos 1.0.0 (`lib/care/protocols.ts`) |
| Ambiente | Somente desenvolvimento local (banco PGlite em `.data/pglite`). Hospedagem de produção **não decidida** |
| Estado de liberação | Todas as funções de mensuração em **desenvolvimento** (nenhuma decisão "liberado" registrada) |

## 2. Declaração de finalidade (proposta para revisão)

> O Moveo é uma plataforma web, acessada pelo navegador do celular ou computador, que apoia fisioterapeutas e profissionais de educação física a organizar o acompanhamento de pessoas atendidas: cadastro, vínculo de atendimento, convites individuais, registro de aceites, solicitação de avaliações de movimento, registro de medições presenciais, revisão profissional, publicação de orientações e histórico com reavaliação.
>
> A plataforma inclui funções **em desenvolvimento** que estimam grandezas do movimento (ângulos, inclinações, contagens e tempos) a partir da câmera do celular, com processamento de imagem no próprio aparelho. Esses resultados são **provisórios**, identificados por método, protocolo e versão, e só chegam à pessoa atendida depois de revisados pelo profissional. A plataforma **não** realiza diagnóstico, não define conduta nem prescreve exercícios.

A redação acima é proposta de engenharia. A redação final depende do enquadramento regulatório (PE-01 em `pendencias-externas.md`) e não pode ser ampliada em materiais comerciais sem nova revisão.

## 3. Usuários pretendidos

| Perfil | Descrição | Situação no software |
| --- | --- | --- |
| Profissional de fisioterapia | Inscrito em CREFITO, com registro conferido manualmente | Cadastro com conselho, região, número e UF; verificação manual (SW) |
| Profissional de educação física | Inscrito em CREF, com registro conferido manualmente | Idem (SW). Regras de teleatendimento próprias da categoria pendentes (REG/JUR) |
| Gestor de espaço | Profissional com papel `gestor` | Gerencia equipe, vínculos e configurações (SW) |
| Assistente | Papel `assistente` | Vê cadastro, sem acesso clínico (SW-V) |
| Pessoa atendida | **Adulta**, convidada por profissional com vínculo ativo | Acesso por convite + código; sessão restrita à atividade (SW-V) |
| Administração da plataforma | Equipe Moveo (`is_platform_admin`) | Verificação profissional e registro de decisões de liberação (SW-V) |

## 4. Ambiente e condições de uso pretendidos

- Uso assíncrono e remoto: a pessoa realiza a atividade sozinha, em casa, com o celular apoiado. Sessão ao vivo está prevista no modelo de dados (`supervision = sessao_ao_vivo`), mas **não há chamada de vídeo implementada**.
- Navegador com contexto seguro (HTTPS ou `localhost`) e permissão de câmera; câmera frontal, resolução solicitada 720×1280, **sem áudio**.
- Processamento de pose no aparelho (MediaPipe Tasks Vision, WebAssembly/GPU). Modelo e runtime baixados de CDN de terceiros na primeira execução.
- Avaliação presencial pode ser registrada manualmente pelo profissional, identificada como `manual_profissional`.

## 5. População, exclusões e situações fora do escopo

| Tema | Definição atual | Situação |
| --- | --- | --- |
| Idade | Somente adultos capazes | Bloqueio apenas informativo no formulário de aceite; **sem controle técnico** (SW parcial; REG/JUR) |
| Menores e representação legal | Fora do escopo liberado | Pendente de definição jurídica (24.7) |
| Indicações clínicas | **Não definidas** | Dependem do responsável clínico e do plano de validação (CLIN) |
| Sinais de alerta | Perguntas de segurança por módulo; qualquer "sim" interrompe | Conteúdo clínico **não aprovado formalmente** por responsável clínico (PE-14) |
| Uso de dispositivos de apoio, limitação que prejudique o rastreamento | Fora do escopo automático; usar medição presencial | Sem detecção automática |
| Urgência, dor intensa, risco de queda | Fora do escopo; texto de aceite orienta interromper e procurar atendimento | Minuta pendente de revisão jurídica |
| Pessoas reais em espaço de demonstração | Proibido por política | **Sem bloqueio técnico** (ver RISCO-016) |

## 6. O que o Moveo não faz

- Não diagnostica lesão, doença ou causa de dor; não classifica gravidade; não faz triagem de urgência.
- Não prescreve nem altera conduta automaticamente; não gera devolutiva automática.
- Não usa modelo de linguagem para medir, interpretar quadros ou orientar a pessoa.
- Não grava nem envia vídeo (recurso de vídeo **não implementado**).
- Não oferece correção de exercício em tempo real nem contagem automática fora dos protocolos de avaliação listados.
- Não rotula diferença entre avaliações como "melhora" ou "piora".

## 7. Funções e categorias

O detalhamento por função (itens 1 a 10 do cap. 24.2) está em `docs/regulatorio/matriz-de-funcionalidades.md`. Resumo:

| Grupo | Funções | Hipótese de natureza |
| --- | --- | --- |
| Administrativas e documentais | Contas, verificação, espaços, pessoas, vínculos, convites, aceites, solicitação, medição presencial, revisão, devolutiva, histórico, relatório, auditoria | Hipótese: apoio administrativo/documental — **a confirmar**; a separação na arquitetura não garante isenção |
| Cálculo sobre dados existentes | Comparação entre avaliações | Hipótese a confirmar; depende da alegação |
| Mensuração por câmera | Ombro, joelho, tronco, postura sentada | Hipótese: pode configurar software como dispositivo médico (SaMD) quando destinada a avaliação ou reabilitação |
| Ferramentas internas | Modo de validação (`?modo=validacao`) | Ferramenta de pesquisa/engenharia; não destinada ao atendimento |
| Legado público | Avaliação livre `/assessment/*` (marca UORT) | Uso direto pela pessoa, sem profissional — **requer decisão de produto e regulatória** |

## 8. Hipótese de enquadramento regulatório

1. **Hipótese registrada:** as funções de mensuração por câmera destinadas a apoiar avaliação ou reabilitação podem configurar software como dispositivo médico nos termos da RDC 657/2022 [30]. O material de perguntas e respostas da Anvisa (questão 50) descreve análise de postura e movimento por imagem destinada a fisioterapeutas e profissionais de educação física com enquadramento como software médico naquele exemplo [25].
2. **Nenhuma classe é atribuída ao Moveo** neste documento. Classes e caminhos (notificação ou registro) seguem a RDC 751/2022 e alterações vigentes [31, 32] e dependem de análise especializada.
3. A Anvisa incluiu revisão da RDC 657/2022 no Plano de Gestão Anual 2026 [26]: as regras precisam ser conferidas na data do lançamento.
4. Aviso de "não realiza diagnóstico", presença de profissional, título de tela ou separação arquitetural **não determinam** sozinhos a situação regulatória (24.2). O produto clínico não será apresentado como "bem-estar" para contornar exigências.

## 9. Alegações

### Alegações atualmente presentes no software (a revisar)

| Local | Alegação | Observação |
| --- | --- | --- |
| `app/page.tsx` | "Captura ruim não vira número", "Vídeo fica no aparelho", "Revisão humana sempre", "Sem diagnóstico automático", "Acesso por vínculo" | Coerentes com o fluxo de acompanhamento verificado. "Vídeo fica no aparelho" omite que `userAgent` e dimensões do vídeo são enviados (ver inventário de tratamentos) |
| `app/page.tsx` | Aviso "As estimativas por câmera ainda não passaram por validação clínica e não estão liberadas para atendimento real" | Manter enquanto não houver liberação |
| `app/page.tsx` | Exemplo "Elevação lateral · direito 88° → 101° (+13°)" | Rotulado como exemplo fictício; manter o rótulo |
| `/assessment/*` (legado UORT) | "medir características funcionais", "Índice de Movimento" experimental, resumo para o médico | Exibe números diretamente à pessoa leiga; telas podem mostrar 0° ou `-Infinity` com bloco vazio (`docs/auditoria.md` A2). Ver F-18 da matriz |

### Alegações proibidas até haver evidência e autorização correspondentes

- "Validado clinicamente", "precisão de X%", "equivalente a goniômetro", "goniômetro digital".
- "Aprovado/registrado/notificado na Anvisa", "isento de registro", "classe I/II".
- "Detecta lesão", "diagnóstico", "triagem", "indica tratamento".
- Qualquer número de registro, certificado, selo de verificação de conselho ou patente sem documento correspondente.

## 10. Estado em 2026-10-04 (separação exigida pelo cap. 24.1)

| Categoria | Situação |
| --- | --- |
| Implementado e verificado em software | Ciclo de atendimento (cadastro → convite → aceite → avaliação → revisão → devolutiva → reavaliação), isolamento, liberação por versão, nulos em captura insuficiente — 98 testes aprovados em 2026-10-04 |
| Evidência clínica necessária | Todas as grandezas medidas por câmera. **Achado crítico:** os ângulos são calculados sem correção de proporção da imagem (ver RISCO-001) — nenhuma medida pode ser liberada antes da correção e de nova verificação |
| Decisão jurídica ou regulatória pendente | Enquadramento, classe, papel da empresa, bases legais, papéis LGPD, textos de aceite (minutas `pendente_revisao_juridica`), hospedagem, retenção |
| Documento externo recebido | Nenhum |
| Função autorizada | Nenhuma. Espaços reais bloqueiam mensuração por câmera |

## 11. Questões que exigem parecer

1. As funções de mensuração, tal como descritas, configuram SaMD? Qual classe e caminho de regularização? (PE-01, PE-03)
2. A comparação entre avaliações e o relatório impresso, por si, alteram o enquadramento?
3. As telas legadas `/assessment/*` (uso direto pela pessoa, sem profissional) podem permanecer públicas? Com qual finalidade e alegação?
4. A empresa atua como fabricante/detentora e também prestará serviço profissional? (PE-02, PE-05)
5. O uso por profissionais de educação física tem tratamento diferente do uso por fisioterapeutas para fins regulatórios e de conselho? (PE-06, PE-07)
