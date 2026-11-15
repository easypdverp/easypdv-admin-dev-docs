---
title: Variáveis de Ambiente
description: Como as variáveis de ambiente são gerenciadas no Despensinha ERP com Vite.
sidebar:
  order: 3
---

O ERP usa **Vite** com variáveis prefixadas por `VITE_`, acessíveis via `import.meta.env`. Um wrapper centralizado em `projectEnvVariables.ts` adiciona suporte a substituição em runtime (deploy sem rebuild).

## Variáveis Disponíveis

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `VITE_APP_API_URL` | URL base da API backend | `https://api.despensinha.com.br` |
| `VITE_GENERATE_SOURCEMAP` | Habilita sourcemaps no build | `true` / `false` |

## Arquivo Central

```
src/shared/projectEnvVariables.ts
```

```ts
type ProjectEnvVariablesType = {
  VITE_GENERATE_SOURCEMAP: string;
  VITE_APP_API_URL: string;
}

const projectEnvVariables: ProjectEnvVariablesType = {
  VITE_GENERATE_SOURCEMAP: "${VITE_GENERATE_SOURCEMAP}",
  VITE_APP_API_URL: "${VITE_APP_API_URL}",
}

export const getProjectEnvVariables = () => ({
  envVariables: {
    VITE_GENERATE_SOURCEMAP: !projectEnvVariables.VITE_GENERATE_SOURCEMAP.includes("VITE_")
      ? projectEnvVariables.VITE_GENERATE_SOURCEMAP
      : import.meta.env.VITE_GENERATE_SOURCEMAP as string,
    VITE_APP_API_URL: !projectEnvVariables.VITE_APP_API_URL.includes("VITE_")
      ? projectEnvVariables.VITE_APP_API_URL
      : import.meta.env.VITE_APP_API_URL as string,
  }
})
```

## Padrão Dual-Source

O sistema usa um padrão de **duas fontes** para cada variável:

1. **Template literal** (`"${VITE_APP_API_URL}"`) — placeholder substituído em runtime pelo servidor (ex.: script de deploy que faz `envsubst` no bundle)
2. **Fallback Vite** (`import.meta.env.VITE_APP_API_URL`) — valor injetado em build time pelo Vite

A lógica verifica se o template literal ainda contém `"VITE_"` (não foi substituído). Se sim, usa o valor do Vite. Se não, usa o valor substituído em runtime.

### Quando cada fonte é usada

| Cenário | Fonte | Motivo |
|---------|-------|--------|
| Desenvolvimento local (`npm run dev`) | `import.meta.env` | Templates não são substituídos |
| Build + deploy com `envsubst` | Template literal | Valores substituídos no bundle estático |
| Build sem substituição | `import.meta.env` | Fallback automático |

## Como Consumir

Sempre use `getProjectEnvVariables()` — nunca acesse `import.meta.env` diretamente:

```ts
import { getProjectEnvVariables } from '@/shared/projectEnvVariables';

const { envVariables } = getProjectEnvVariables();
const apiUrl = envVariables.VITE_APP_API_URL;
```

O client Axios já consome essa função para definir a `baseURL`:

```ts
// src/api/axios.ts
const projectEnvVariables = getProjectEnvVariables();
const axiosConfig = {
  baseURL: projectEnvVariables.envVariables.VITE_APP_API_URL,
};
```

## Adicionando uma Nova Variável

1. Adicione o campo em `ProjectEnvVariablesType`
2. Adicione o template literal no objeto `projectEnvVariables`
3. Adicione a lógica dual-source no retorno de `getProjectEnvVariables()`
4. Crie o `.env` local com o valor para desenvolvimento
