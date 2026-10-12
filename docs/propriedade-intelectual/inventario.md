# Inventário de propriedade intelectual e licenças

> **RASCUNHO — 2026-10-04.** Gerado com apoio de IA; requer revisão por responsável humano (jurídico/PI).
> Licenças lidas do campo `license`/`licenses` de `node_modules/*/package.json` e de `package-lock.json` em 2026-10-04. O campo declarado no pacote **não substitui** a leitura do arquivo de licença nem a análise jurídica. A licença do código de uma biblioteca **não cobre automaticamente** pesos de modelo, dados de treinamento ou conteúdo audiovisual (24.10). Nenhuma afirmação de exclusividade, titularidade ou liberdade de operação é feita aqui.

## 1. Dependências diretas de execução (`dependencies`)

| Pacote | Declarado em `package.json` | Instalado | Licença declarada | Observações |
| --- | --- | --- | --- | --- |
| `@mediapipe/tasks-vision` | 0.10.35 | 0.10.35 | Apache-2.0 | O pacote instalado **não inclui arquivo LICENSE**; o runtime WASM efetivamente usado (0.10.17) vem do CDN e não está em `node_modules` |
| `@electric-sql/pglite` | 0.5.8 | 0.5.8 | Apache-2.0 | README declara licença dupla Apache-2.0 / PostgreSQL License; alterações no código-fonte do Postgres sob PostgreSQL License |
| `drizzle-orm` | 0.45.3 | 0.45.3 | Apache-2.0 | |
| `next` | 14.2.35 | 14.2.35 | MIT | |
| `react`, `react-dom` | ^18.3.1 | 18.3.1 | MIT | |
| `recharts` | ^2.12.7 | 2.15.4 | MIT | Depende de `victory-vendor` (MIT AND ISC) |
| `server-only` | ^0.0.1 | 0.0.1 | MIT | |
| `zod` | 4.6.5 | 4.6.5 | MIT | |
| `zustand` | ^4.5.4 | 4.5.7 | MIT | |

## 2. Dependências de desenvolvimento (`devDependencies`)

| Pacote | Instalado | Licença declarada |
| --- | --- | --- |
| `typescript` | 5.9.3 | Apache-2.0 |
| `vitest` | 2.1.9 | MIT |
| `drizzle-kit` | 0.31.11 | MIT |
| `tailwindcss` | 3.4.19 | MIT |
| `postcss` | 8.5.28 | MIT |
| `autoprefixer` | 10.6.1 | MIT |
| `tsx` | 4.23.15 | MIT |
| `@types/node`, `@types/react`, `@types/react-dom` | 20.19.43, 18.3.31, 18.3.7 | MIT |

## 3. Árvore completa (`package-lock.json`, lockfileVersion 3)

- 330 pacotes: 77 não marcados como desenvolvimento, 253 de desenvolvimento.
- Licenças declaradas: MIT 290; ISC 20; Apache-2.0 11; BSD-3-Clause 4; 0BSD 1; CC-BY-4.0 1; "MIT AND ISC" 1; sem campo `license` 2.

| Pacote | Licença | Ponto de atenção |
| --- | --- | --- |
| `caniuse-lite` 1.0.30001810 (via Next.js) | CC-BY-4.0 | Licença de conteúdo que exige atribuição — verificar se o dado é distribuído no build final e como atribuir |
| `victory-vendor` 36.9.2 | MIT AND ISC | Manter as duas notas de licença |
| `busboy` 1.6.0, `streamsearch` 1.1.0 | MIT (campo legado `licenses`) | Sem pendência aparente; arquivo LICENSE presente |
| `tslib` 2.8.1 | 0BSD | — |
| `d3-ease`, `react-transition-group`, `source-map`, `source-map-js` | BSD-3-Clause | Manter avisos de copyright |

Nenhuma licença com obrigação recíproca forte (por exemplo, GPL/AGPL) foi encontrada pelo campo declarado — **conferência por ferramenta de análise de licenças e por responsável jurídico ainda necessária**.

## 4. Modelos, runtime e serviços externos

| Componente | Origem | Versão | Licença | Situação |
| --- | --- | --- | --- | --- |
| Modelo `pose_landmarker_full` (float16, versão 1) | `storage.googleapis.com/mediapipe-models/...` | `pose_landmarker_full/float16/1` | **A verificar separadamente** (cartão do modelo e termos do Google; não presumir que seja a mesma do código) | PE-17 |
| Runtime WASM do MediaPipe | `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm` | 0.10.17 (diverge do pacote 0.10.35) | Presumivelmente a do pacote — **a verificar** | PE-17; alinhar versões |
| Dados de treinamento do modelo | Google | — | Desconhecida; não há uso de dados próprios para treinamento | Registrar o que o fornecedor declara |
| Síntese de voz | API do navegador (`speechSynthesis`) | — | Do sistema/navegador do usuário | Sem distribuição pelo Moveo |

## 5. Ativos de marca e conteúdo

| Ativo | Local | Titular presumido | Situação |
| --- | --- | --- | --- |
| Logotipo UORT (`uort-logo.jpg`, 530×280) e marca (`uort-mark.jpg`, 447×447) | `public/brand/` | **Cliente UORT — Unidade Ortopédica Traumatológica** (material do cliente) | Autorização de uso a documentar (PE-20); não usar como marca do Moveo |
| Identidade, textos e cores UORT | `config/app.ts` | Cliente UORT (marca) / autoria do texto a confirmar | Restrito às telas `/assessment/*` |
| Nome e logotipo "Moveo" | `components/platform/ui.tsx` (`MoveoLogo`) | A definir | Busca de marca pendente (PE-18) |
| Textos de protocolos, instruções, minutas de aceite e aviso de privacidade | `lib/care/protocols.ts`, `services/core.ts`, `app/privacidade` | Produzidos no projeto (autoria humana + apoio de IA) | Revisão jurídica pendente; registrar autoria |
| Questionários padronizados | — | — | **Nenhum incorporado.** Escala de dor 0–10 e perguntas são formulários próprios; não usar nomes de instrumentos validados (DASH, PROMIS etc.) sem licença [19, 20] |
| Vídeos e imagens de exercícios | — | — | Nenhum no projeto |
| Conjuntos de dados | — | — | Nenhum; dados de validação futuros pertencerão ao protocolo de pesquisa |

## 6. Código-fonte e autoria

| Item | Situação em 2026-10-04 |
| --- | --- |
| Repositório | `github.com/lookassessoria10-collab/moveo` (visibilidade pública ou privada **a verificar**) |
| Histórico | 22 commits desde 2026-09-17; autor registrado "Look Assessoria" (21) e "MOVEO" (1), mesmo e-mail |
| Apoio de IA | Todos os 22 commits trazem a linha `Co-Authored-By` de um modelo de IA; o trabalho da plataforma (branch `claude/plataforma`) foi produzido com Claude Code e ainda não foi commitado |
| Contribuições humanas | A documentar: quem definiu requisitos, revisou, aprovou e decidiu (relevante para autoria e titularidade) |
| Contratos | Contratos com colaboradores/prestadores e cessão de direitos **não localizados** no repositório (PE-19) |
| Publicação prévia | Aplicação legada publicada em `moveo-omega.vercel.app` (citada no plano); considerar o que já foi divulgado antes de qualquer avaliação de patente [37] |

O uso do Claude Code não substitui a conferência de licenças nem resolve questões de autoria (24.10). Não adicionar selo de patente, número de registro ou afirmação de propriedade sem documento correspondente.

## 7. Obrigações práticas já identificadas

1. Gerar arquivo de avisos de terceiros (licenças e copyrights) para distribuição do build.
2. Verificar licença do modelo e do runtime WASM antes de uso comercial.
3. Documentar autorização da UORT ou remover a marca das rotas públicas.
4. Fixar e registrar versões de modelo e runtime servidos (também por rastreabilidade).
