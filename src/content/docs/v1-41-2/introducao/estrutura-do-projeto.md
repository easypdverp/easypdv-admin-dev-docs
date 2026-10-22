---
title: Estrutura do Projeto
description: Organização de arquivos e diretórios do Despensinha ERP.
sidebar:
  order: 2
---

O projeto está em `/despensinha-admin-app/` (ou no diretório raiz conforme o ambiente).

## Estrutura Principal

```
src/
├── _metronic/          # Template Metronic: layout, assets SCSS, i18n base
├── api/
│   ├── axios.ts        # Instância axios com interceptors de auth
│   ├── core/           # Configuração base (interceptors, error handling)
│   └── endpoints/      # ~90 arquivos de endpoints por feature
├── app/
│   ├── App.tsx         # Root: providers (QueryClient, Auth, CASL, i18n)
│   ├── pages/          # Páginas por módulo de negócio
│   ├── modules/        # Módulos compartilhados (auth, table, export)
│   ├── components/     # Componentes reutilizáveis
│   ├── models/         # ~200 DTOs TypeScript
│   ├── casl/           # AbilityContext e definição de permissões
│   ├── enums/          # Enums de domínio fiscal e de negócio
│   ├── helpers/        # Utilitários de API, tabelas e formatação
│   ├── hooks/          # Custom hooks (useDataTable, useUrlFilter)
│   ├── utils/          # Utilitários (exportação, datas, impostos)
│   └── routing/        # AppRoutes e rotas por perfil de usuário
├── shared/
│   └── projectEnvVariables.ts  # Variáveis de ambiente tipadas
.github/
└── workflows/          # CI/CD GitHub Actions
```

### Referências detalhadas

- **`api/endpoints/`** — Catálogo completo dos ~90 arquivos em [API e Endpoints](/arquitetura/api-endpoints/)
- **`app/models/`** — Documentação dos ~200 DTOs em [Modelos e DTOs](/arquitetura/modelos-dtos/)
- **`app/hooks/`** — Hooks customizados documentados em [Hooks Customizados](/modulos/hooks/)
- **`shared/projectEnvVariables.ts`** — Configuração detalhada em [Variáveis de Ambiente](/arquitetura/variaveis-ambiente/)
- **`.github/workflows/`** — Pipelines de CI/CD documentadas em [CI/CD](/infraestrutura/ci-cd/)

## Convenção de Páginas

Cada módulo em `src/app/pages/` segue a estrutura:

```
pages/[modulo]/
├── [Modulo]Page.tsx          # Página principal (listagem)
├── components/               # Componentes específicos do módulo
│   ├── [Modulo]Table.tsx     # Tabela principal
│   ├── [Modulo]Modal.tsx     # Modal de criação/edição
│   └── [Modulo]Filters.tsx   # Offcanvas de filtros
└── hooks/
    └── use[Modulo]Data.ts    # Hook de React Query para o módulo
```

## Pontos de Entrada

- `src/app/App.tsx` — providers globais
- `src/app/routing/AppRoutes.tsx` — roteamento principal
- `src/api/axios.ts` — cliente HTTP global
