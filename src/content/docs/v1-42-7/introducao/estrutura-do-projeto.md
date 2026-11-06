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

## Executar o Projeto

**Pré-requisito:** a versão do Node em `.nvmrc`, a mesma usada no CI (com nvm: `nvm install`). Para consumir a API local, o backend do [easypdv-main-api-modular](https://github.com/easypdverp/easypdv-main-api-modular) precisa estar no ar em `http://localhost:8080` — é ele que cria o admin de exemplo usado para login.

**Primeira vez:** `./scripts/setup` confere a versão do Node, instala as dependências (`npm ci`), cria o `.env.development.local` (porta 3000 e API no backend local) se ele ainda não existir e avisa se o backend local não responde. Pode ser executado de novo quando quiser.

**Rodar:** `npm run dev` sobe o front em `http://localhost:3000` (outra porta: `VITE_PORT=3001 npm run dev`).

**Testar:** `npm run lint` (ESLint e `tsc`), `npm run test:run` (Vitest) e `npm run build`.

Para rodar via Docker Compose, sem instalar Node ou npm na máquina, veja [Deploy](/infraestrutura/deploy/).
