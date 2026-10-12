# Auditoria do código existente (etapa 0)

Data: 04/10/2026 · Base auditada: branch `claude/precisao-medicao` (commit `93e2e68`), antes da plataforma.
Método: leitura integral dos módulos, execução dos testes (`npm test`, 57 testes) e execução local.
Escopo do documento: o que existia, o que é real, simulado ou só do navegador, o que foi reaproveitado e os riscos encontrados.

> Este documento descreve software. Nenhum item aqui é evidência de validade clínica.

## 1. O que existia

| Item | Situação encontrada |
| --- | --- |
| Framework | Next.js 14.2.35 (App Router), React 18.3, TypeScript estrito, Tailwind 3, Zustand 4, Recharts 2 |
| Rotas | `/` (seleção de região), `/assessment/shoulder`, `/assessment/knee`, `/assessment/spine`, `/assessment/posture` |
| Marca | UORT em `config/app.ts` e `public/brand/` |
| Backend, banco, login | **Não havia.** Nenhuma rota de API, nenhuma persistência no servidor, nenhuma autenticação |
| Visão computacional | MediaPipe Pose Landmarker (`pose_landmarker_full`, float16), no navegador, modo VIDEO, `requestAnimationFrame` na thread principal |
| Câmera | `getUserMedia` (`hooks/useCamera.ts`), câmera frontal, sem áudio, sem gravação; encerra as trilhas ao desmontar |
| Persistência | Só em memória (Zustand) — fechar a página apaga o resultado. Modo de validação grava CSV e quadros brutos em IndexedDB **no próprio aparelho** |
| Modo demonstração | Resultados fictícios por módulo, sinalizados na tela de resultado |
| Modo de validação | `?modo=validacao`: compara com goniômetro/inclinômetro, exporta CSV e pontos brutos (2D e 3D) para reprocessamento (`scripts/reprocess-validation.ts`) |
| Testes | 57 testes unitários de cálculo (ângulos, suavização, detecção de repetição, métricas, enquadramento, CSV) |
| Implantação | Vercel (sem variáveis de ambiente) |

## 2. Real, simulado ou só do navegador

| Função | Classificação | Observação |
| --- | --- | --- |
| Rastreamento corporal | Real, no aparelho | Modelo e runtime baixados de CDNs públicas em cada aparelho |
| Ângulos, repetições, compensação | Real, no aparelho | Estimativas 2D; ver achados A1–A4 |
| Perguntas de segurança e contexto | Real, no aparelho | Respostas ficavam só na memória |
| Resultado e relatório do ombro | Real, efêmero | Sem histórico, sem autoria, sem revisão |
| Índice de Movimento (ombro) | Experimental | Combinação arbitrária de fatores; não usado na plataforma |
| Resultados de demonstração | Simulado | Valores fixos por módulo |
| Voz | Real, no aparelho | Web Speech API |
| Validação com goniômetro | Real, local | Dados ficam no aparelho do examinador |

## 3. Achados

Severidade: **crítica** (pode produzir número errado apresentado como válido), **alta**, **média**, **baixa**.

| # | Severidade | Achado | Situação após este trabalho |
| --- | --- | --- | --- |
| A1 | Crítica | **Ângulos calculados sem corrigir a proporção da imagem.** O MediaPipe entrega x normalizado pela largura e y pela altura; `lib/geometry.ts`, `lib/angles.ts` e `modules/*/angles.ts` usam esses valores diretamente. Num vídeo 720×1280 (retrato), um segmento a 45° real é calculado como ≈60,6°; ângulos de 0°, 90° e 180° não mudam, os intermediários sim. | **Não corrigido** (muda os valores medidos; exige nova `ALGORITHM_VERSION` e revalidação). A plataforma agora grava `videoWidth/videoHeight` em cada sessão para permitir reprocessar. Prioridade 1 do próximo ciclo. |
| A2 | Alta | Bloco sem tentativas vira número: `average([])` retorna 0 e `Math.max(...[])` retorna `-Infinity` (`lib/movementMetrics.ts`, stores dos módulos). | Corrigido **no caminho da plataforma**: `lib/care/resultAdapters.ts` recalcula no servidor e grava `value = null` + motivo. As telas públicas antigas (`/assessment/*`) ainda podem exibir 0°. |
| A3 | Alta | Versões divergentes: pacote npm `@mediapipe/tasks-vision` 0.10.35 com runtime wasm 0.10.17 da CDN. | Registrado (`lib/pose/modelInfo.ts`) e gravado em cada sessão; versão npm fixada (sem `^`). Unificar e revalidar. |
| A4 | Alta | "Flexão" do ombro é capturada de frente; flexão e abdução usam o mesmo cálculo — a câmera 2D não separa os planos. | Documentado como limitação do protocolo `ombro-camera 1.0.0`, exibida ao profissional e no relatório. O passo 7 da iniciativa de precisão (flexão de perfil) resolve. |
| A5 | Média | Modelo e runtime carregados de terceiros (jsdelivr, storage.googleapis.com) a cada uso. | Pendente: servir os arquivos da própria origem com hash conferido (rastreabilidade e privacidade). |
| A6 | Média | `tailwind.config.ts` não incluía `modules/**`: classes usadas só nos módulos podiam faltar no build de produção. | Corrigido. |
| A7 | Média | Viewport sem zoom em todas as páginas (acessibilidade). | Restrito às telas de câmera; o restante da plataforma permite zoom. |
| A8 | Média | Detecção síncrona na thread principal (o guia oficial recomenda Web Worker). | Pendente; medir desempenho em aparelhos modestos antes de mudar. |
| A9 | Baixa | O "modo de validação" é ativado só por parâmetro de URL. | Aceitável para coleta local; dados não saem do aparelho. Na plataforma, a validação deve ganhar papel e registro próprios. |
| A10 | Baixa | Taxa de quadros variável é tratada com `performance.now()` real — correto. Espelhamento: x é espelhado para exibição, mas os nomes `left/right` do MediaPipe são anatômicos e preservados — lado anatômico correto. | Sem ação; manter teste de regressão quando o motor for refeito. |

## 4. Decisão de reaproveitamento

| Módulo | Decisão | Protocolo na plataforma | Limitações registradas |
| --- | --- | --- | --- |
| Ombro | Reaproveitado sem mudar cálculos | `ombro-camera 1.0.0` | A1, A4; não isola glenoumeral |
| Joelho | Reaproveitado sem mudar cálculos | `joelho-camera 1.0.0` | A1; agachamento só frontal; apoio das mãos heurístico |
| Coluna | Reaproveitado, descrito como **inclinação global do tronco** | `coluna-camera 1.0.0` | A1; não é amplitude lombar |
| Postura sentada | Reaproveitado como **observação descritiva** | `postura-sentada-camera 1.0.0` | Não conclui diagnóstico ergonômico |

Mudanças feitas nos módulos (mínimas, sem tocar em cálculo): marca e "voltar" configuráveis (`components/shared/FlowShell.tsx`), alternativa quando a câmera falha (avisar o profissional; demonstração só em espaço fictício) e constantes do modelo extraídas para `lib/pose/modelInfo.ts`. As rotas `/assessment/*` continuam funcionando como avaliação livre com a marca UORT; a seleção de região passou de `/` para `/assessment`.

## 5. Recomendações em ordem

1. Corrigir A1 numa versão nova do algoritmo, reprocessar os dados de validação já coletados (quando houver dimensões do vídeo) e comparar com a linha de base.
2. Unificar versões do MediaPipe (A3) e servir modelo/runtime da própria origem (A5).
3. Aplicar a mesma regra "sem tentativa = sem valor" às telas públicas (A2).
4. Protocolo de ombro com flexão de perfil (A4) como `ombro-camera 2.0.0` (nova versão = sem comparação automática com a 1.x).
5. Medir desempenho e avaliar Web Worker (A8).
