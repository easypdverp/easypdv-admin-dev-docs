---
title: Release Notes v1.27.1
description: Estado da arquitetura na versao 1.27.1 do Despensinha ERP
sidebar:
  order: 2
---

## Visao Geral

Esta e a primeira versao com snapshot da documentacao tecnica do Despensinha ERP. A v1.27.1 serve como baseline para acompanhar mudancas arquiteturais ao longo do tempo.

A partir desta versao, cada release do ERP gera um snapshot congelado da documentacao, permitindo consultar o estado exato da arquitetura em qualquer versao historica.

## Stack Principal

| Tecnologia | Versao | Funcao |
|-----------|--------|--------|
| React | 18.x | Framework UI |
| TypeScript | 5.x | Tipagem estatica |
| Vite | 5.x | Build tool e dev server |
| Metronic | 8.x | UI Kit e tema base |
| Axios | 1.x | Cliente HTTP |
| React Query | 5.x | Cache e estado de servidor |
| React Hook Form | 7.x | Gerenciamento de formularios |
| Zod | 3.x | Validacao de schemas |

## Arquitetura Documentada

### API e Endpoints

- **90 arquivos de endpoint** distribuidos em 11 dominios
- **571 endpoints totais** catalogados
- Dominios: Autenticacao, Catalogo, Clientes, Configuracoes, Dashboard, Financeiro, Fiscal, Relatorios, Suprimentos, Vendas, Diversos

### Modelos e DTOs

- **210 modelos/DTOs** catalogados
- Organizados por dominio com tipagem TypeScript completa
- Padroes: interfaces para responses, types para enums, classes para DTOs complexos

### RBAC (Controle de Acesso)

- **8 niveis de perfil**: Super Admin, Admin, Franqueado, Gerente, Supervisor, Operador Fiscal, Vendedor, Estoquista
- Roteamento condicional por perfil de usuario
- Guards de rota verificando permissoes antes da renderizacao

### Error Handling

- `axiosErrorMapper` como handler centralizado de erros HTTP
- Interceptors de request/response no Axios
- Tratamento especifico por codigo de status (401, 403, 404, 500)
- Integracao com sistema de notificacoes para feedback ao usuario

### Roteamento

- Roteamento baseado em perfil de usuario (profile-based routing)
- Lazy loading de modulos com React.lazy e Suspense
- Guards de autenticacao e autorizacao em cada rota

## Modulos Documentados

### Autenticacao

- JWT com refresh token rotation
- Login com email/senha e login social (Google)
- Interceptor automatico para refresh de token expirado
- Logout com limpeza de estado e redirecionamento

### Tabelas

- Baseado em `react-table` (TanStack Table)
- Paginacao server-side com React Query
- Ordenacao, filtros e busca por URL params
- Selecao de linhas e acoes em lote

### Formularios

- `react-hook-form` com resolvers Zod para validacao
- Formularios dinamicos com campos condicionais
- Masks de input (CPF, CNPJ, telefone, CEP)
- Upload de arquivos com preview

### Exportacao

- Exportacao XLSX via biblioteca `xlsx`
- Exportacao PDF via `jsPDF` e `html2canvas`
- `ExportModal` com reordenacao de colunas via `dnd-kit`
- Configuracao de colunas visiveis e ordem de exportacao

### Hooks Customizados

- `useVersionCheck` — Verifica versao do app contra version.json do servidor
- `useNavigationBlocker` — Bloqueia navegacao quando ha alteracoes nao salvas
- `useSearchHotkeys` — Atalhos de teclado para busca (Ctrl+K)
- `useDebounce` — Debounce de valores para inputs de busca
- `useLocalStorage` — Estado persistido em localStorage

### Integracoes

- **ApexCharts** — Graficos herdados do tema Metronic (dashboard)
- **Chart.js** — Graficos customizados do aplicativo (relatorios)
- **Leaflet** — Mapas interativos para localizacao de clientes
- **Fabric.js** — Editor de canvas para planogramas de loja
- **dnd-kit** — Drag-and-drop para reordenacao de colunas em exportacao

## Infraestrutura

### CI/CD

- **4 workflows** GitHub Actions:
  - `ci.yml` — Lint, type-check e build em PRs
  - `deploy-dev.yml` — Deploy automatico para ambiente dev
  - `deploy-prod.yml` — Deploy para producao com aprovacao manual
  - `dispatch-docs.yml` — Notifica repos de docs sobre nova release

### Docker e Deploy

- **Dockerfile multi-stage** (build + Nginx)
- Configuracao Nginx com SPA fallback, gzip, e cache headers
- Ambientes: dev (deploy automatico) e prod (deploy com gate manual)
- Cloudflare Pages para hospedagem das docs

### Versionamento Runtime

- `version.json` gerado no build com numero da versao e timestamp
- `useVersionCheck` hook que compara versao local vs servidor
- Notificacao automatica quando nova versao esta disponivel
- Recarregamento automatico ou manual conforme configuracao

## O Que Esta Documentado Nesta Versao

| Secao | Paginas | Conteudo |
|-------|---------|----------|
| Introducao | 2 | Stack tecnologica, estrutura do projeto |
| Arquitetura | 7 | Roteamento, RBAC, variaveis de ambiente, camada API, endpoints, modelos/DTOs, error handling |
| Modulos | 6 | Autenticacao, tabelas, formularios, exportacao, hooks, integracoes |
| Funcionalidades | 4 | Filtros por URL, permissoes, internacionalizacao, notificacoes |
| Infraestrutura | 3 | CI/CD, deploy, versionamento runtime |
| Changelog | 1 | Historico de versoes |
| Versionamento | 2 | Versionamento tecnico, release notes |
| **Total** | **25** | **Documentacao tecnica completa** |
