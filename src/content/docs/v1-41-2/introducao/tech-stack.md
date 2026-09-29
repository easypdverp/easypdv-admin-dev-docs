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
| TypeScript | 5.7 | Tipagem estática |
| Vite | 4.4.5 | Build tool e dev server |
| React Router DOM | 6.3 | Roteamento client-side |

## UI e Estilo

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| React Bootstrap | 2.5 | Componentes UI baseados em Bootstrap 5.3 |
| Styled Components | 6.1 | CSS-in-JS |
| Metronic | — | Template de UI administrativo (base de layout) |
| Bootstrap Icons | — | Ícones |
| Font Awesome | 7.0 | Ícones |

## Estado e Dados

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| React Query (TanStack) | 3.38 | Server state, cache e sincronização |
| Axios | 1.7 | HTTP client com interceptors |
| nuqs | 2.7 | Estado em URL (query strings) |

## Formulários e Validação

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| Formik | 2.2 | Gerenciamento de formulários |
| Yup | — | Validação de schemas |

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
| ApexCharts + react-apexcharts | 3.35 | Gráficos interativos (herdado do Metronic) |
| Chart.js + react-chartjs-2 | 4.5 | Gráficos primários da aplicação |
| Leaflet + react-leaflet | 1.9 | Mapas interativos |
| @react-google-maps/api | 2.20 | Integração Google Maps |
| Fabric.js | 6.9 | Canvas 2D (planograma) |

Para detalhes de integração de cada biblioteca, veja [Integrações](/modulos/integracoes/).

## Exportação

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| jsPDF + jspdf-autotable | — | Geração de PDFs |
| XLSX | 0.18 | Exportação para Excel |

## Internacionalização

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| react-intl | 6.4 | i18n com mensagens formatadas |

## Utilitários

| Biblioteca | Versão | Função |
|-----------|--------|--------|
| dayjs | 1.11 | Manipulação de datas |
| luxon | 3.7 | Timezone support |
| @dnd-kit | 6.3 | Drag-and-drop (reordenação de colunas no ExportModal) |
| jsbarcode | 3.12 | Geração de códigos de barras |
| react-toastify | 11.0 | Notificações toast |
| react-dropzone | 14.2 | Upload de arquivos via drag-and-drop |
| react-select | 5.8 | Select avançado com busca |
| react-number-format | 5.4 | Formatação de inputs numéricos |
| lz-string | 1.5 | Compressão de strings (cache de filtros) |

Para detalhes sobre hooks customizados que encapsulam essas bibliotecas, veja [Hooks Customizados](/modulos/hooks/).
