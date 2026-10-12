# Pendências de propriedade intelectual

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano (advogado ou agente da propriedade industrial).
> Este documento organiza trabalho a fazer. **Não** afirma disponibilidade de marca, titularidade, exclusividade, patenteabilidade nem liberdade de operação. Fontes: INPI marcas [33], INPI programas de computador [34], Lei 9.279/1996 [35], INPI condições de depósito e divulgação [37] — **fonte a reverificar antes do lançamento**.

## 1. Três proteções diferentes

| Tema | O que protege | O que não faz |
| --- | --- | --- |
| Marca | O sinal que identifica o produto ("Moveo") nas classes pertinentes | Domínio disponível não comprova disponibilidade da marca [33] |
| Registro de programa de computador | Registro **facultativo** que auxilia a comprovar autoria e titularidade do código [34] | Não concede exclusividade sobre a ideia, o método ou o modelo de negócio |
| Patente | Invenção que cumpra os requisitos legais [35] | Programa de computador em si não é patenteável; eventual solução técnica exige busca de anterioridade e análise especializada |

## 2. Pendências

| ID | Pendência | Responsável | Evidência esperada | Situação | Impedimento |
| --- | --- | --- | --- | --- | --- |
| PIP-01 | Busca e análise de anterioridade da marca "Moveo" no INPI, nas classes de interesse (software, serviços de saúde — a definir) | a definir | Relatório de busca + parecer de registrabilidade e de risco de conflito | aberta | Uso comercial e investimento na marca |
| PIP-02 | Decidir nome definitivo e, se aplicável, depositar pedido de marca | a definir | Protocolo do pedido (não usar "®" antes da concessão) | aberta | Depende de PIP-01 |
| PIP-03 | Definir titular do código (pessoa física ou jurídica) e formalizar cessões | a definir | Contratos com colaboradores e prestadores; declaração de titularidade | aberta | Licenciamento, investimento, registro de programa |
| PIP-04 | Documentar contribuições humanas e o uso de ferramentas de IA no desenvolvimento | a definir | Registro de quem especificou, revisou e aprovou cada parte; histórico do Git | aberta | Suporte à autoria em eventual registro ou disputa |
| PIP-05 | Avaliar registro facultativo de programa de computador no INPI | a definir | Decisão registrada; se aprovado, documentação técnica e hash do código conforme orientação do INPI | aberta | Não impede lançamento |
| PIP-06 | Verificar licença do modelo `pose_landmarker_full` e do runtime WASM para uso comercial | a definir | Termos arquivados com data | aberta | Uso comercial do motor (PE-17) |
| PIP-07 | Arquivo de avisos de terceiros (licenças das dependências, incluindo CC-BY-4.0 de `caniuse-lite`) | a definir | `THIRD_PARTY_NOTICES` ou equivalente no build | aberta | Distribuição |
| PIP-08 | Autorização de uso da marca e material UORT, ou remoção | a definir | Autorização escrita do cliente | aberta | Publicação das telas `/assessment/*` com a marca UORT (PE-20) |
| PIP-09 | Triagem de possível invenção (somente com especialista) | a definir | Parecer: existe solução técnica candidata? Qual o estado da técnica? | aberta | Nenhum — é decisão estratégica |
| PIP-10 | Levantamento do que já foi divulgado (site público, repositório, apresentações) | a definir | Lista datada de divulgações | aberta | Insumo para PIP-09 [37] |
| PIP-11 | Análise de liberdade de operação, se houver decisão de investir em patente ou em mercado específico | a definir | Parecer especializado | aberta | Decisão estratégica |
| PIP-12 | Licença de questionários padronizados, se forem incorporados no futuro | a definir | Licença de uso digital e comercial e versão brasileira validada [19, 20] | não aplicável hoje | Bloqueia a incorporação do instrumento |
| PIP-13 | Licença de vídeos e imagens de exercícios, se houver biblioteca | a definir | Contratos ou autoria própria documentada | não aplicável hoje | Bloqueia a biblioteca |

## 3. Regras até a conclusão das pendências

- Não usar "marca registrada", "®", "patenteado", "patente pendente" ou números de pedido sem documento correspondente.
- Não afirmar exclusividade de tecnologia, método ou modelo de negócio.
- Havendo possível invenção, **evitar divulgação técnica adicional** (artigos, posts, demonstrações detalhadas) até a avaliação especializada; o que já foi publicado precisa ser examinado, sem presumir perda automática de direitos [37].
- Busca de novidade para patente e análise de liberdade de operação são trabalhos diferentes; nenhum deles foi feito.
- O código atual combina componentes de terceiros (MediaPipe, Next.js e outros); qualquer proteção recai apenas sobre o que for de autoria própria e documentada.
