# Instruções de uso

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano, inclusive revisão clínica e jurídica.
> Versão do software: 0.2.0-dev; algoritmo `2026.09-smoothing-v1`; protocolos 1.0.0.
> **Situação atual:** as medidas por câmera **não estão validadas** e **não estão liberadas** para atendimento real. Use somente espaços de demonstração com pessoas e dados fictícios.

---

## Parte 1 — Para profissionais

### 1.1 O que o Moveo faz

Organiza o acompanhamento de pessoas atendidas: cadastro, vínculo, convite individual, registro de aceites, avaliação de movimento pelo celular da pessoa, medição presencial feita por você, revisão, orientação publicada (devolutiva) e reavaliação com o mesmo protocolo.

### 1.2 O que o Moveo não faz

- Não diagnostica, não indica tratamento e não interpreta resultados.
- Não substitui sua avaliação nem a avaliação presencial quando ela for necessária.
- Não grava vídeo. Você não verá a execução; verá apenas números estimados, qualidade da captura e respostas da pessoa.
- Não diz se houve melhora: mostra diferenças entre avaliações compatíveis.

### 1.3 Antes de começar

1. Crie a conta em `/cadastro` e confirme o e-mail (sem confirmação, não é possível enviar convites).
2. Sua conta começa num **espaço de demonstração**. Pessoas cadastradas ali são marcadas como fictícias. **Não cadastre pessoas reais em espaço de demonstração.**
3. O número de registro informado começa como **pendente**. A conferência é manual, feita pela administração. Espaço de atendimento real só pode ser criado com registro verificado — e, mesmo assim, as avaliações por câmera continuam bloqueadas até uma decisão de liberação para a versão em uso.

### 1.4 Fluxo de trabalho

| Etapa | Onde | Observações |
| --- | --- | --- |
| Cadastrar pessoa e objetivo | Painel → Pessoas → Nova | Peça só os dados necessários. Registre a modalidade e sua decisão sobre a adequação do acompanhamento a distância |
| Equipe e vínculos | Painel → Equipe; Pessoa → Vínculos | Só quem tem vínculo ativo vê os dados clínicos. Assistentes veem o cadastro, não o conteúdo clínico |
| Solicitar avaliação | Pessoa → Solicitar | Escolha protocolo, prazo (até 30 dias), canal e instruções. Use o mesmo protocolo na reavaliação |
| Enviar convite | Automático (e-mail/SMS) ou link do WhatsApp aberto por você | No ambiente local nada é enviado; as mensagens aparecem em `/dev/caixa-de-saida`. A mensagem não contém dados clínicos |
| Acompanhar | Painel → Avaliações | Estados: pendente, em andamento, aguardando revisão, revisada, cancelada. Você pode revogar o convite ou emitir novo link |
| Revisar | Avaliação → Revisar medidas | Obrigatório para **todas** as medidas antes de publicar |
| Publicar devolutiva | Avaliação → Devolutiva | Nova publicação cria nova versão; a anterior fica guardada. Escolha se as medidas revisadas aparecem para a pessoa |
| Reavaliar | Avaliação → Solicitar reavaliação | A comparação aparece quando as duas avaliações são compatíveis |
| Medição presencial | Pessoa → Medição presencial | Registra valor, unidade, lado e instrumento; aparece como medição do profissional |
| Relatório | Avaliação → Relatório | Impressão/PDF pelo navegador; mostra estado de revisão, método, versões e limitações |

### 1.5 Como revisar uma medida

Para cada medida, decida:

- **Aceitar** — só é possível quando há valor e a captura foi considerada apta.
- **Corrigir** — informe o valor e a justificativa (por exemplo, conferido em sessão ao vivo). O valor original continua guardado.
- **Descartar** — informe a justificativa. A medida deixa de ter valor para comparações e para a pessoa.

"Captura insuficiente" e "sem valor" significam que a imagem não sustentou o cálculo. Isso não é 0°.

Pergunte-se sempre: o valor é compatível com o que eu esperaria desta pessoa? Na dúvida, descarte e avalie de outra forma.

### 1.6 Limitações que você precisa conhecer

**Limitações gerais da câmera (todas as avaliações):**

- **Erro conhecido não corrigido:** a versão atual calcula ângulos sem corrigir a proporção entre largura e altura da imagem. Em celular na vertical, ângulos podem sair sistematicamente diferentes do real (exemplo: um segmento a 45° pode aparecer como cerca de 60°). **Não use estes valores para decisão clínica.**
- Estimativa em duas dimensões com uma câmera: não mede profundidade nem separa bem planos de movimento.
- Roupas largas, pouca luz, objetos na frente, corpo fora do quadro ou celular inclinado prejudicam a estimativa.
- A "qualidade da captura" indica se havia dados suficientes, não a exatidão do ângulo.
- Valores de aparelhos, posições ou versões diferentes podem não ser comparáveis.

**Por protocolo:**

| Protocolo | Limitações |
| --- | --- |
| Ombro (vista frontal) | Elevação do braço em relação ao tronco; não isola a articulação glenoumeral. A flexão é captada de frente: a câmera não separa bem flexão de elevação lateral (o cálculo é o mesmo). Inclinação do tronco altera a estimativa |
| Joelho | Roupa, posição da câmera e segmentos escondidos afetam a medida. Agachamento só de frente (não é 3D). Sentar e levantar não mede força. O apoio das mãos é um indício heurístico |
| Tronco | Inclinação global entre ombros e quadril; não corresponde à amplitude lombar nem a segmentos da coluna. Movimento da pelve confunde a leitura |
| Postura sentada | Descreve a posição observada durante a captura; não conclui doença, causa de dor nem diagnóstico ergonômico |
| Medição presencial | Valor informado por você; método e instrumento ficam registrados |

### 1.7 Comparações

A comparação só mostra diferença quando grandeza, lado, unidade, método, protocolo (versão principal) e versão do algoritmo são iguais e os dois valores existem. Caso contrário, o sistema explica o motivo. A marca "inclui valor não revisado" indica que uma das avaliações ainda é provisória. A relevância clínica da diferença depende do erro de medida e da sua interpretação.

### 1.8 Segurança da pessoa

- Indique a avaliação a distância só quando for adequada à pessoa; avaliação presencial continua necessária quando indispensável.
- As perguntas de segurança de cada módulo interrompem a atividade quando qualquer resposta é "sim"; o conteúdo ainda **não foi aprovado formalmente** por responsável clínico.
- Agachamento e sentar-levantar envolvem risco de queda: avalie se a pessoa pode realizar sem supervisão.
- Menores de idade e pessoas representadas legalmente estão fora do escopo.

---

## Parte 2 — Para a pessoa atendida

> Texto em linguagem simples, para revisão antes de ser exibido.

### O que é

Um profissional que acompanha você pediu uma atividade de movimento. Você faz pelo celular, sem instalar aplicativo. Quem decide o que fazer com o resultado é o profissional.

### Antes de começar

- O link é pessoal. Ao abrir, toque em **Continuar** para receber um código no seu e-mail ou telefone cadastrado. O código vale por 10 minutos.
- Leia os textos de aceite. A permissão de câmera do navegador é só técnica e não substitui o seu aceite.
- Se você é responsável por outra pessoa (por exemplo, um menor de idade), **não continue**: este acompanhamento ainda não está disponível nessa situação.

### Preparação

- Apoie o celular em um lugar firme, na posição indicada na tela (de frente ou de lado).
- Deixe o corpo inteiro visível, com boa luz e roupa que mostre o contorno do corpo.
- Para sentar e levantar, use uma cadeira estável, sem rodinhas.

### Durante a atividade

- Faça os movimentos **só até onde for confortável**.
- Se sentir dor forte, tontura, falta de ar ou qualquer sintoma que preocupe, toque em **Interromper** e procure atendimento. Avise o profissional.
- Se a câmera não funcionar, use a opção de avisar o profissional; ele vai indicar outra forma de avaliação.

### O que acontece com seus dados

- A imagem da câmera é processada no próprio celular. **O vídeo não é gravado nem enviado.**
- São enviados ao profissional: os números estimados, a qualidade da captura, suas respostas, o tipo de navegador e o tamanho da imagem da câmera.
- Só o profissional que atende você e a equipe autorizada do espaço veem esses dados.

### Depois

Você não vê números logo após a atividade. O profissional revisa e publica uma orientação; você a encontra em **Retorno do profissional**, abrindo o link novamente. Os valores mostrados ali são estimativas revisadas pelo profissional e não são diagnóstico.
