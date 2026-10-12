# Usabilidade e acessibilidade

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano.
> Nenhuma avaliação com usuários foi realizada. Nenhuma auditoria de acessibilidade foi executada. O que segue descreve o que existe no código e o plano de avaliação. Referências do plano: cap. 5, 12 e 18.

## 1. Usuários e contexto

| Usuário | Contexto | Características a considerar |
| --- | --- | --- |
| Pessoa atendida | Sozinha, em casa, celular apoiado, link recebido por e-mail, SMS ou WhatsApp | Baixa familiaridade digital, dor ou limitação de movimento, aparelhos lentos, navegador interno de aplicativos, pouca luz e pouco espaço |
| Profissional | Computador ou celular, entre atendimentos | Pressa (risco de revisar sem conferir), conhecimento variável sobre limitações de câmera 2D |
| Administração | Computador | Decisões de alto impacto (liberação, verificação) |

## 2. Tarefas críticas

Uma tarefa é crítica quando o erro de uso pode levar a dano, decisão errada ou exposição de dados.

| ID | Tarefa | Erro de uso previsível | Controle existente | Risco |
| --- | --- | --- | --- | --- |
| UT-01 | Pessoa confirma o acesso com o código | Digitar código errado, código expirado, abrir link em outro aparelho | Mensagens específicas; máscara do contato; novo código em "Continuar" (no máximo um por minuto) | RISCO-012 |
| UT-02 | Pessoa lê e registra os aceites | Aceitar sem ler; responsável por menor continuar | Texto curto com versão; aviso sobre menores (sem bloqueio técnico) | RISCO-023 |
| UT-03 | Pessoa posiciona o celular | Vista errada (frente × lado), corpo fora do quadro, celular inclinado | Checagem de enquadramento e orientação; instruções visuais e por voz opcional | RISCO-004, 005 |
| UT-04 | Pessoa executa movimento do lado pedido | Mover o lado contrário (efeito espelho) | Instrução por lado; lado registrado pelo módulo | RISCO-003 |
| UT-05 | Pessoa interrompe por dor ou mal-estar | Não encontrar como parar | Botão "Interromper" visível durante a atividade; perguntas de segurança antes | RISCO-023 |
| UT-06 | Profissional revisa cada medida | Aceitar tudo sem conferir; não perceber "captura insuficiente" | Revisão obrigatória de todas; nulo não pode ser aceito; justificativa para corrigir/descartar | RISCO-008 |
| UT-07 | Profissional interpreta comparação | Ler diferença como melhora; ignorar motivo de incompatibilidade | Diferença sem rótulo; motivos explícitos; marca de valor não revisado | RISCO-007, 018 |
| UT-08 | Profissional escolhe o canal do convite | Enviar a contato errado | Contato do cadastro; sem campo livre de destinatário | RISCO-012 |
| UT-09 | Profissional usa espaço de demonstração | Cadastrar pessoa real | Rótulos "fictício" e avisos | RISCO-016 |
| UT-10 | Administração registra decisão de liberação | Escolher versão ou estado errado | Formulário com escopo e evidência obrigatórios | RISCO-017 |

## 3. Recursos existentes (verificados por leitura de código, não por teste com usuários)

- Layout mobile-first; `lang="pt-BR"` no documento.
- Orientação por voz opcional (síntese do navegador), com botão para silenciar; preferência guardada no aparelho; instruções visuais equivalentes na tela.
- Câmera solicitada só ao iniciar a atividade; sem microfone.
- Alternativa quando a câmera é recusada ou não existe: avisar o profissional (interrupção registrada) ou, em demonstração, seguir com dados fictícios.
- Mensagens de erro de envio com nova tentativa; envio idempotente.
- Mensagens externas discretas, sem dado clínico.
- Estados de convite, solicitação e revisão escritos por extenso (não só por cor) — **a verificar** em todas as telas.
- Uso limitado de atributos de acessibilidade (17 `aria-label` em todo o código) — cobertura não avaliada.

## 4. Lacunas conhecidas

- Sem auditoria de acessibilidade (contraste, foco, leitor de tela, tamanho de alvo, zoom). Referência sugerida para a auditoria: WCAG na versão vigente — a confirmar.
- Fluxo não testado em Safari/iPhone, Chrome/Android nem no navegador interno do WhatsApp neste ambiente (TESTE-105).
- Sem tratamento de mudança de orientação durante a captura (TESTE-112).
- Sem orientação para abrir o link em navegador compatível quando o navegador interno falhar.
- Sem modo de alto contraste ou fonte ampliada próprios.
- Zoom desabilitado nas telas de câmera (`docs/auditoria.md` A7) e detecção na thread principal, que pode deixar aparelhos modestos lentos (A8).
- Telas legadas `/assessment/*` mostram números diretamente à pessoa (fora do fluxo revisado).

## 5. Plano de avaliação

| Etapa | Participantes | Método | Saída |
| --- | --- | --- | --- |
| Avaliação heurística e de acessibilidade | Especialistas | Checklist + leitor de tela + aparelhos reais | Lista de problemas priorizada |
| Formativa — pessoa atendida | Pessoas com perfis diversos (idade, familiaridade digital), dados fictícios | Tarefas UT-01 a UT-05 observadas; tempo, ajuda necessária, erros | Ajustes de texto e fluxo |
| Formativa — profissional | Fisioterapeutas e profissionais de educação física | Tarefas UT-06 a UT-09 com casos fictícios que incluem medidas erradas plantadas | Medir se erros plantados são detectados na revisão |
| Somativa | Conforme exigência do enquadramento (PE-01) | Tarefas críticas no escopo da liberação | Evidência para o grupo C de `criterios-de-liberacao.md` |

Indicadores do cap. 18: tempo de realização, compreensão das instruções, necessidade de ajuda e tempo de revisão. Avaliações com pessoas reais exigem os mesmos cuidados éticos do plano de validação (PE-16).
