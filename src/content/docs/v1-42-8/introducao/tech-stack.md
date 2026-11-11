---
title: Stack Tecnológica
description: Tecnologias e bibliotecas utilizadas no Despensinha ERP.
sidebar:
  order: 1
---

## Frontend

| Tecnologia | Versão | Função |
|-----------|--------|--------|
| React | 18.2 | UI framework |
| TypeScript | 6.0 | Tipagem estática |
| Vite | 8.1.4 | Build tool e dev server |
| React Router DOM | 7.18 | Roteamento client-side |

## UI e Estilo

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| React Bootstrap | 2.5 | Componentes UI baseados em Bootstrap 5.3 |
| Styled Components | 6.1 | CSS-in-JS |
| Metronic | — | Template de UI administrativo (base de layout) |
| Bootstrap Icons | 1.5 | Ícones |
| Font Awesome | 7.0 | Ícones |

## Estado e Dados

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| React Query (TanStack) | 5.101 | Server state, cache e sincronização |
| Axios | 1.16 | HTTP client com interceptors |
| nuqs | 2.7 | Estado em URL (query strings) |

## Formulários e Validação

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| Formik | 2.4 | Gerenciamento de formulários |
| Yup | 1.0 | Validação de schemas |

## Tabelas

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| TanStack React Table | 8.19 | Tabelas com paginação, sort e filtros |

## Permissões

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| @casl/ability | 6.8 | Definição de abilities (RBAC) |
| @casl/react | 5.0 | Integração com React |

## Autenticação

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| jwt-decode | 4.0 | Decodificação de tokens JWT |
| @react-oauth/google | 0.12 | Login com Google OAuth |

## Visualização e Mapas

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| ApexCharts + react-apexcharts | 5.3 | Gráficos interativos (herdado do Metronic) |
| Chart.js + react-chartjs-2 | 4.5 | Gráficos primários da aplicação |
| Leaflet + react-leaflet | 1.9 | Mapas interativos |
| @react-google-maps/api | 2.20 | Integração Google Maps |
| Fabric.js | 6.9 | Canvas 2D (planograma) |

Para detalhes de integração de cada biblioteca, veja [Integrações](/modulos/integracoes/).

## Exportação

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| jsPDF + jspdf-autotable | 3.0 | Geração de PDFs |
| XLSX | 0.18 | Exportação para Excel |

## Internacionalização

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| react-intl | 10.1 | i18n com mensagens formatadas |

## Utilitários

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| dayjs | 1.11 | Manipulação de datas |
| luxon | 3.7 | Timezone support |
| @dnd-kit | 6.3 | Drag-and-drop (reordenação de colunas no ExportModal) |
| jsbarcode | 3.12 | Geração de códigos de barras |
| react-toastify | 11.0 | Notificações toast |
| react-select | 5.8 | Select avançado com busca |
| react-number-format | 5.4 | Formatação de inputs numéricos |
| lz-string | 1.5 | Compressão de strings (cache de filtros) |

Para detalhes sobre hooks customizados que encapsulam essas bibliotecas, veja [Hooks Customizados](/modulos/hooks/).

## Testes

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| Vitest | 4.1 | Test runner, ambiente `happy-dom` |
| @vitest/coverage-v8 | 4.1 | Cobertura de testes |
| @testing-library/react | 16.3 | Renderização de componentes em teste |
| @testing-library/user-event | 14.6 | Simulação de interação do usuário |
| @testing-library/jest-dom | 6.6 | Matchers de DOM |
| MSW | 2.13 | Mock de requisições HTTP em teste |

`npm run test:run` roda a suíte uma vez (modo watch: `npm test`; com cobertura: `npm run test:coverage`).

## Qualidade de Código

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| ESLint | 9.39 | Lint, com configuração flat (`eslint.config.js`) |
| typescript-eslint | 8.67 | Regras de lint com tipos |
| eslint-plugin-react / react-hooks / react-refresh | 7.37 / 7.1 / 0.4 | Regras de React |
| eslint-plugin-unused-imports | 4.4 | Remove imports não usados |
| eslint-plugin-jsx-a11y | 6.10 | Regras de acessibilidade |
| eslint-plugin-sonarjs | 4.2 | Regras do Sonar replicadas no lint local |
| eslint-plugin-unicorn | 65.0 | Boas práticas gerais de JS/TS |

`npm run eslint` reprova com erro de regra e com uma supressão órfã em `eslint-suppressions.json` — o arquivo nativo do ESLint (desde a 9.24) que anistia as violações legadas das regras mais novas, com a garantia de que só encolhe: uma entrada sem violação correspondente reprova o lint. `npm run lint` roda o ESLint e o `tsc` (`npm run check-types`).
