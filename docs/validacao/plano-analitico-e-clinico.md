# Plano de validação analítica e clínica (rascunho)

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano **e apoio metodológico/estatístico**.
> Nenhuma medida do Moveo está validada. Este documento não define tamanho de amostra nem critérios numéricos de aceitação: eles precisam ser fixados pelos responsáveis **antes** da coleta. Referências do plano: cap. 7, 8, 18 e 24.6; estudos [15], [16], [17] — **fonte a reverificar antes do lançamento**.

## 1. Separação das trilhas

| Trilha | Pergunta | Evidência | Situação |
| --- | --- | --- | --- |
| Verificação do cálculo | O código calcula o que foi especificado em exemplos conhecidos? | Testes com geometria sintética, incluindo proporção real de imagem | Parcial — falta TESTE-101 |
| Desempenho analítico | Quanto a estimativa difere de um método de referência, em quais condições, e com que taxa de rejeição? | Estudo de concordância por grandeza, lado e condição | Não iniciado |
| Usabilidade | A pessoa e o profissional conseguem usar com segurança? | Avaliação formativa e somativa | Não iniciado |
| Evidência clínica | A medida é adequada ao uso pretendido para a população pretendida? | Conforme enquadramento (PE-01) | Não iniciado |

Teste unitário correto não comprova utilidade clínica. Correlação alta sozinha não demonstra concordância.

## 2. Pré-requisitos antes de qualquer coleta com pessoas

1. **Corrigir a proporção da imagem no cálculo (RISCO-001)** e incrementar `ALGORITHM_VERSION`. Coletar com o cálculo atual mediria um erro já conhecido.
2. Gravar `videoWidth`/`videoHeight` também nos registros do modo de validação (hoje só o fluxo de acompanhamento grava), para permitir reprocessamento.
3. Alinhar o runtime WASM (0.10.17) com o pacote (0.10.35) e fixar modelo/runtime (RISCO-015).
4. Definir o protocolo do ombro (flexão em vista lateral prevista no passo 7 de `config/precision.ts`) antes de validar flexão do ombro.
5. Avaliação ética e demais autorizações aplicáveis conforme o desenho do estudo, **antes do recrutamento ou coleta** (PE-16). Avaliar com especialista a necessidade de submissão ao sistema de ética em pesquisa e de comunicações sanitárias para pesquisa com dispositivo — a confirmar.
6. Plano estatístico aprovado (tamanho de amostra com justificativa metodológica, critérios de aceitação por uso).

## 3. Ferramenta existente: modo de validação

- Ativação: `?modo=validacao` nas rotas de avaliação livre (ombro e joelho).
- Registro por repetição (CSV): `algorithmVersion`, códigos de voluntário e examinador (sem nome), região, teste, lado, repetição, situação (válida/cancelada), `stablePeakDeg` (valor exibido), `meanDeg`, `rawMaxDeg`, confiança média dos pontos, compensação do tronco, vista, instrumento (goniômetro ou inclinômetro), valor de referência, tempo até confirmação, `userAgent`, data.
- Pontos brutos (JSON): sequência quadro a quadro **antes** da suavização, 2D normalizado e 3D em metros, com a calibração do bloco — permite recalcular com versões futuras (`scripts/reprocess-validation.ts`).
- Detecção de até duas pessoas para identificar a entrada do examinador no quadro.
- Armazenamento no navegador do aparelho (localStorage/IndexedDB) até exportação manual.
- Limitações: sem dimensões do vídeo; sem tronco e postura; o script de reprocessamento resume erro médio, maior erro e correlação — **acrescentar viés e limites de concordância**; ativação por URL não é controle de acesso; arquivos exportados exigem guarda e descarte definidos (dados de pesquisa pseudonimizados).

## 4. Plano por grandeza

Para cada linha: definir exatamente a grandeza e a convenção de zero; posição, instruções, número de tentativas e critérios de exclusão; método de referência escolhido com especialista; critérios de aceitação fixados antes da coleta.

| Protocolo / grandeza | Lado | Referência candidata (a decidir) | Condições a cobrir | Pontos de atenção |
| --- | --- | --- | --- | --- |
| Ombro — elevação em "flexão" | D/E | Goniômetro ou inclinômetro por examinador treinado; sistema de captura laboratorial se disponível | Vista atual (frontal) **e** vista lateral proposta | Não distingue plano sagital e frontal hoje; inclinação do tronco |
| Ombro — elevação lateral | D/E | Idem | Vista frontal | Compensação de tronco; braço fora do plano |
| Joelho — flexão em pé | D/E | Goniômetro/inclinômetro | Vista lateral, roupas variadas | Segmentos escondidos; escolha do lado visível |
| Joelho — agachamento (flexão média, diferença entre joelhos) | Bilateral | A definir (projeção frontal não equivale a ângulo sagital) | Vista frontal | Não é reconstrução 3D; definir se a grandeza tem utilidade |
| Joelho — sentar e levantar (repetições, tempo, apoio das mãos) | Bilateral | Contagem e cronometragem por observador; vídeo de referência | Cadeiras e alturas diferentes | Não mede força; heurística de apoio das mãos |
| Tronco — flexão, extensão, inclinações | — / D/E | Inclinômetro no segmento definido | Lateral e frontal | Inclinação global ≠ coluna lombar; pelve |
| Postura sentada — tronco e cabeça | — | Inclinômetro/fotogrametria a definir | Cadeiras e posições habituais | Uso descritivo; não diagnóstico ergonômico |

## 5. Análise mínima por grandeza

- Erro absoluto médio e viés (diferença média) em relação à referência.
- Concordância com limites de concordância (por exemplo, Bland-Altman), avaliando se o erro varia com a amplitude.
- Repetibilidade e, quando aplicável, confiabilidade entre examinadores.
- **Taxa de falha e de rejeição** (capturas insuficientes, repetições canceladas), relatada junto com o erro nos casos aceitos — não publicar só os casos em que a câmera funcionou bem.
- Mudança mínima detectável e critério de aceitação por uso pretendido.
- Estratificação por aparelho, orientação/proporção do vídeo, iluminação, roupa, características corporais e lado.

O grau de confiança do rastreador (`avgLandmarkConfidence`) é qualidade da captura, não exatidão do ângulo.

## 6. População e condições

- Começar por adultos sem limitação que impeça a execução segura; incluir progressivamente a população pretendida definida pelo responsável clínico.
- Coletar em condição controlada **e** em condição real de uso (casa, celulares comuns).
- Incluir Safari/iPhone e Chrome/Android, retrato e paisagem.
- Dados sintéticos ou de demonstração **não** podem entrar em relatório de validação como participantes reais (24.4).

## 7. Piloto de produto não é validação

O piloto sugerido de 5 a 10 profissionais e 30 a 50 pessoas (cap. 18) serve para aprender sobre uso e operação. Ele **não** é estudo de validação, não define tamanho de amostra e não justifica alegação de precisão (24.6).

## 8. Saídas esperadas por grandeza e versão

Relatório com: versão do algoritmo, protocolo, modelo e runtime; população e condições; referência; análise; taxa de rejeição; desvios do plano; conclusão em relação aos critérios pré-definidos; responsáveis. O relatório é evidência para `docs/regulatorio/criterios-de-liberacao.md` (grupo B) e vale **somente** para a combinação de versões avaliada.

## 9. Revalidação

Toda mudança que altere o valor medido (cálculo, suavização, limiares, protocolo, modelo, runtime, população) exige análise de impacto e, em regra, nova validação da grandeza afetada antes de nova liberação (`docs/qualidade/controle-de-versoes-e-mudancas.md`).
