# Gestão de riscos (registro preliminar)

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano.
> Registro preliminar de engenharia. A escolha do processo formal de gestão de risco (por exemplo, normas técnicas aplicáveis a dispositivos médicos) é decisão do responsável regulatório (PE-01/PE-03). Severidade é qualitativa e preliminar; **probabilidade não foi estimada** por falta de dados de uso e de validação.

## 1. Escala preliminar de severidade

| Nível | Descrição |
| --- | --- |
| Alta | Pode levar a decisão clínica errada, dano físico, exposição de dado sensível ou uso de função não liberada em pessoa real |
| Média | Pode atrasar ou prejudicar o atendimento, ou expor dado não sensível |
| Baixa | Incômodo operacional sem efeito no atendimento |

## 2. Resumo

| ID | Risco | Severidade | Controle principal | Residual (preliminar) |
| --- | --- | --- | --- | --- |
| RISCO-001 | Erro de proporção da imagem no cálculo dos ângulos | Alta | **Nenhum no cálculo**; bloqueio de uso real | Alto — impede liberação |
| RISCO-002 | Erro de projeção/plano (câmera 2D, flexão do ombro em vista frontal) | Alta | Limitações no protocolo e no relatório | Alto |
| RISCO-003 | Lado anatômico trocado | Alta | Lado definido pelo bloco do módulo; espelhamento tratado na conversão | Médio — sem teste ponta a ponta |
| RISCO-004 | Oclusão e pontos estimados fora do quadro | Média/Alta | Checagens de visibilidade; nulos sem tentativa válida | Médio |
| RISCO-005 | Enquadramento inadequado | Média | Checagens de enquadramento e orientação | Médio |
| RISCO-006 | Medida falsa apresentada como válida | Alta | Nulos, faixa plausível, revisão obrigatória | Médio-alto (valores plausíveis errados não são detectáveis) |
| RISCO-007 | Recomendação inadequada | Alta | Sem recomendação automática; devolutiva humana | Depende do profissional |
| RISCO-008 | Falha de revisão | Alta | Revisão obrigatória por medida; justificativa; append-only | Alto — viés de automação |
| RISCO-009 | Indisponibilidade | Média | Alternativa e registro de interrupção | Alto para produção |
| RISCO-010 | Perda de dados | Alta | Transações, idempotência | Alto — sem backup |
| RISCO-011 | Acesso indevido entre espaços ou profissionais | Alta | Autorização em três camadas + FKs compostas | Baixo-médio |
| RISCO-012 | Acesso indevido pelo convite | Alta | Código ao contato cadastrado, escopo, prazo, revogação | Médio |
| RISCO-013 | Conta profissional ou administrativa comprometida | Alta | Bloqueio por tentativas; scrypt | Alto (sem MFA) |
| RISCO-014 | Segredos persistidos na caixa de saída | Alta | Parcial: mascarados fora do desenvolvimento (TESTE-117) | Médio até existir provedor de envio |
| RISCO-015 | Divergência de versão do runtime e dependência de CDN | Alta | Versões registradas por sessão | Médio-alto |
| RISCO-016 | Pessoa real atendida em espaço de demonstração | Alta | Rótulos e avisos | Médio — controle procedimental |
| RISCO-017 | Decisão de liberação indevida | Alta | Só administração; evidência obrigatória; auditoria | Alto — governança |
| RISCO-018 | Comparação entre avaliações não comparáveis | Média | Regras de compatibilidade | Médio |
| RISCO-019 | Modo de validação ativado indevidamente | Média | Ativação só por URL | Baixo-médio — a verificar |
| RISCO-020 | Relatório usado fora de contexto | Média | Estado, limitações e versões no relatório | Médio |
| RISCO-021 | Telas legadas públicas usadas como avaliação | Alta | Avisos de não diagnóstico | Alto — decisão pendente |
| RISCO-022 | Abuso de envio de código | Média | Um código por minuto; 5 tentativas erradas | Baixo-médio |
| RISCO-023 | Lesão ou queda durante a atividade | Alta | Perguntas de segurança, "até onde for confortável", interrupção | Depende de protocolo clínico aprovado |

## 3. Detalhamento

### RISCO-001 — Erro de projeção por proporção da imagem
- **Situação:** `lib/geometry.ts`, `lib/angles.ts` e `modules/*/angles.ts` calculam ângulos com coordenadas normalizadas do MediaPipe (x dividido pela largura, y pela altura) sem corrigir a proporção. Com vídeo retrato 720×1280, um segmento real a 45° resulta em ~60,6°. O erro depende da orientação do segmento e afeta ombro, joelho, tronco e postura.
- **Consequência:** valores sistematicamente errados, plausíveis e não detectáveis pelo profissional; comparações entre aparelhos com proporções diferentes.
- **Controles implementados:** nenhum no cálculo. Mitigações: todos os recursos em `desenvolvimento`; espaço real bloqueado (TESTE-021); `device.videoWidth/videoHeight` gravados em cada sessão para reprocessamento futuro; comparação recusa versões de algoritmo diferentes (TESTE-038).
- **Verificação:** TESTE-101 (não existe). Os testes de ângulo atuais (TESTE-041 a 044) usam coordenadas sem proporção e **não detectam** o problema.
- **Pendente:** corrigir; incrementar `ALGORITHM_VERSION`; revalidar; registrar dimensões também no modo de validação.
- **Residual:** alto até a correção.

### RISCO-002 — Erro de projeção por plano de movimento
- **Situação:** câmera única 2D; a "flexão" do ombro é captada de frente e usa o mesmo cálculo da elevação lateral (`docs/auditoria.md` A4); movimento fora do plano e inclinação do tronco alteram a estimativa [17].
- **Consequência:** rótulo "flexão" sugere grandeza que não é medida isoladamente.
- **Controles:** limitações em `lib/care/protocols.ts`, exibidas no relatório; método "estimativa 2D" visível.
- **Pendente:** protocolo do ombro com flexão em vista lateral (passo 7 de `config/precision.ts`) → protocolo 2.0.0; validação por plano.
- **Residual:** alto para flexão do ombro; médio para os demais.

### RISCO-003 — Lado anatômico trocado
- **Situação:** a prévia é espelhada; o eixo X é espelhado na conversão. O lado da medida vem do bloco do módulo (o módulo instrui qual braço/perna mover).
- **Consequência:** valor atribuído ao lado errado; assimetria invertida.
- **Controles:** mapeamento lado → medida no adaptador (TESTE-035); lado visível em cada medida e no relatório. A auditoria de código (`docs/auditoria.md` A10) concluiu que os nomes esquerdo/direito do MediaPipe são anatômicos e preservados após o espelhamento — conclusão por leitura de código, ainda sem teste com câmera real.
- **Verificação pendente:** TESTE-102 (ponta a ponta com movimento de lado conhecido, câmera frontal real, iOS e Android).
- **Residual:** médio; o profissional pode corrigir na revisão se perceber.

### RISCO-004 — Oclusão e pontos estimados
- **Situação:** segmentos escondidos por roupa, objetos ou o próprio corpo; o modelo pode estimar pontos fora do quadro.
- **Controles:** checagens de visibilidade por módulo; tentativa sem valor válido vira nulo (TESTE-028, 029).
- **Limite:** confiança do rastreador não equivale a exatidão do ângulo.
- **Residual:** médio; requer dados de validação com condições variadas.

### RISCO-005 — Enquadramento inadequado
- **Situação:** distância, orientação frontal/lateral, celular inclinado, luz.
- **Controles:** `lib/framing.ts` (TESTE-045); instruções na preparação.
- **Pendente:** checagem de inclinação do celular e luz (passo 4, `preCheck` vazio); mudança de orientação durante a captura (TESTE-112).
- **Residual:** médio.

### RISCO-006 — Medida falsa apresentada como válida
- **Situação:** módulos legados usam `average([]) = 0` e `Math.max(...[]) = -Infinity` (`docs/auditoria.md` A2).
- **Controles:** no acompanhamento, o adaptador recalcula e gera nulo + motivo (TESTE-013, 028 a 030, 034, 036); medida nula não pode ser aceita (TESTE-015); faixa plausível 0–180° (postura −90° a 90°).
- **Limite:** um valor plausível porém errado (RISCO-001) passa por todas as barreiras. As telas legadas `/assessment/*` ainda podem exibir 0° ou `-Infinity` (TESTE-103 inexistente).
- **Residual:** médio-alto.

### RISCO-007 — Recomendação inadequada
- **Situação:** profissional orienta com base em medida errada ou interpreta diferença como melhora; perguntas de segurança insuficientes.
- **Controles:** nenhuma recomendação automática; nenhum modelo de linguagem; diferença sem rótulo de melhora (TESTE-017, 037); limitações no relatório.
- **Pendente:** aprovação clínica das perguntas e orientações (PE-14); instruções de uso.
- **Residual:** depende de avaliação humana.

### RISCO-008 — Falha de revisão
- **Situação:** profissional aceita todas as medidas sem conferir (viés de automação) ou publica com comparação provisória.
- **Controles:** revisão de todas as medidas antes de publicar (TESTE-014); justificativa para corrigir/descartar; original preservado (TESTE-015); comparação marca "inclui valor não revisado".
- **Limite:** o sistema não verifica se a revisão foi criteriosa.
- **Residual:** alto, dependente de treinamento e das instruções de uso.

### RISCO-009 — Indisponibilidade
- **Situação:** CDN do modelo/WASM indisponível; navegador incompatível; servidor fora do ar; navegador interno do WhatsApp.
- **Controles:** alternativa de avisar o profissional; interrupção `camera_indisponivel` registrada; medição presencial como alternativa.
- **Pendente:** hospedar modelo e runtime; monitoramento; hospedagem definida.
- **Residual:** alto para uso real.

### RISCO-010 — Perda de dados
- **Situação:** banco PGlite em diretório local, sem backup; falha durante envio.
- **Controles:** transações nas operações compostas; envio idempotente (TESTE-013); proteção contra abrir o banco duas vezes no mesmo processo.
- **Pendente:** banco hospedado, backup e restauração testados (TESTE-108).
- **Residual:** alto; o ambiente atual não é adequado a dados reais.

### RISCO-011 — Acesso indevido entre espaços ou profissionais
- **Controles:** participação ativa + espaço + vínculo (`services/authz.ts`); FKs compostas; mesmo erro para negado e inexistente (TESTE-001 a 006).
- **Limite:** sem RLS; toda nova consulta precisa filtrar por espaço.
- **Residual:** baixo-médio; exige revisão de código em cada mudança.

### RISCO-012 — Acesso indevido pelo convite
- **Situação:** link encaminhado, interceptado ou aberto por pré-visualização.
- **Controles:** link sozinho não autentica (TESTE-008); código ao contato cadastrado, 10 min, 5 tentativas (TESTE-009); escopo restrito à atividade (TESTE-011); expiração e revogação derrubam a sessão (TESTE-010); `Referrer-Policy: no-referrer` no link.
- **Limite:** quem controla o e-mail ou o telefone da pessoa obtém o código; no canal WhatsApp, o link passa pelo aplicativo de terceiro.
- **Residual:** médio.

### RISCO-013 — Conta profissional ou administrativa comprometida
- **Controles:** scrypt; bloqueio após 5 falhas por 15 min (TESTE-025); resposta indistinguível (TESTE-026); redefinição encerra sessões.
- **Pendente:** MFA (REQ-004), limite por origem, alerta de acesso.
- **Residual:** alto; a conta administrativa pode registrar "liberado".

### RISCO-014 — Segredos persistidos na caixa de saída
- **Situação:** `outbox_messages.body` guarda em texto o link do convite (com token), o código de 6 dígitos e os links de confirmação de e-mail e redefinição de senha, além do contato do destinatário.
- **Consequência:** quem ler essa tabela (backup, acesso ao banco) pode usar convites e redefinir senhas ainda válidos.
- **Controle (04/10/2026):** fora do ambiente de desenvolvimento, `sendMessage` grava o corpo com links e códigos mascarados (`redactSecrets`, TESTE-117). Em desenvolvimento continuam em texto aberto de propósito (substituem o provedor em `/dev/caixa-de-saida`).
- **Pendente:** provedor de envio que entregue sem persistir o corpo; expurgo da tabela; hoje, fora do desenvolvimento, convites por e-mail/SMS não chegam a ser entregues.
- **Residual:** médio; aceitável apenas no desenvolvimento local com dados fictícios.

### RISCO-015 — Runtime divergente e dependência de CDN
- **Situação:** pacote `@mediapipe/tasks-vision` 0.10.35 com WASM 0.10.17 baixado do jsDelivr; modelo baixado do Google Storage; sem verificação de integridade (`docs/auditoria.md` A3).
- **Consequência:** comportamento não testado; mudança ou indisponibilidade externa altera resultados; risco de cadeia de suprimentos.
- **Controles:** versões fixas nas URLs; `model_id` e `runtime_version` gravados por sessão.
- **Controle (04/10/2026):** modelo + runtime fazem parte da chave de liberação (`feature_releases.model_version`, TESTE-118).
- **Pendente:** alinhar versões, hospedar arquivos com hash verificado.
- **Residual:** médio-alto.

### RISCO-016 — Pessoa real em espaço de demonstração
- **Situação:** espaço de demonstração permite mensuração em `desenvolvimento`; nada impede cadastrar uma pessoa real.
- **Controles:** `is_fictitious = true` e rótulos de demonstração (TESTE-007); aviso no aceite ("não usar com pessoas reais"); envio real de mensagens não implementado.
- **Pendente:** termos de uso; monitoramento; ambiente de produção sem modo demonstração ou com contatos restritos.
- **Residual:** médio, procedimental.

### RISCO-017 — Decisão de liberação indevida
- **Controles:** só administração (TESTE-023); evidência e escopo obrigatórios; auditoria.
- **Limites:** escopo não é aplicado; uma pessoa decide; administração sem MFA. (Modelo/runtime entraram na chave em 04/10/2026 — TESTE-118.)
- **Pendente:** ver `docs/regulatorio/criterios-de-liberacao.md` §3.
- **Residual:** alto, dependente de governança.

### RISCO-018 — Comparação entre avaliações não comparáveis
- **Controles:** mesma grandeza, lado, unidade, método, versão principal do protocolo e algoritmo (TESTE-037 a 040).
- **Limite:** aparelho, orientação, resolução e condições de captura não entram na regra; mudança de versão secundária do protocolo é tratada como compatível.
- **Residual:** médio.

### RISCO-019 — Modo de validação ativado indevidamente
- **Situação:** `?modo=validacao` ativa gravação local de pontos brutos e detecção de duas pessoas. Desde 04/10/2026 o acompanhamento desliga esse modo (`FlowShell.allowValidation = false`, lido por `useValidationMode`); TESTE-110 (verificação automatizada) ainda não executado.
- **Residual:** baixo-médio.

### RISCO-020 — Relatório fora de contexto
- **Controles:** relatório mostra provisório/revisado, método, versões e limitações; acesso auditado.
- **Limite:** PDF gerado pelo navegador sai do controle da plataforma.
- **Residual:** médio.

### RISCO-021 — Telas legadas públicas
- **Situação:** `/assessment/*` entrega números, índice experimental e resumo "para o médico" diretamente a qualquer pessoa, sem revisão, com marca UORT.
- **Residual:** alto; decisão pendente (PE-23).

### RISCO-022 — Abuso de envio de código
- **Situação:** cada "Continuar" gera e envia novo código.
- **Controles:** no máximo um código por minuto por convite (`codeResendSeconds`, TESTE-052); convite bloqueia após 5 códigos errados (TESTE-009).
- **Limite:** sem limite total de envios por convite e sem limite por IP (TESTE-111).
- **Residual:** baixo-médio (custo e incômodo quando houver envio real).

### RISCO-023 — Lesão ou queda durante a atividade
- **Situação:** agachamento e sentar-levantar sem supervisão; dor durante movimento.
- **Controles:** perguntas de segurança; instrução "até onde for confortável"; interrupção acessível e registrada; aceite orienta parar e procurar atendimento.
- **Pendente:** aprovação clínica (PE-14); critérios de supervisão por tarefa.
- **Residual:** depende da indicação feita pelo profissional.

## 4. Revisão

Revisar este registro a cada mudança de `ALGORITHM_VERSION`, protocolo, modelo/runtime, fluxo de acesso ou hospedagem, e após cada incidente (`docs/operacao/incidentes-e-reclamacoes.md`).
