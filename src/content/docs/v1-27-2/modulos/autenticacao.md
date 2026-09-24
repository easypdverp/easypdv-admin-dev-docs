---
title: Autenticação
description: Fluxo de autenticação JWT no Despensinha ERP.
sidebar:
  order: 1
---

A autenticação usa **JWT** com refresh token. O estado do usuário autenticado é mantido no `AuthContext`.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/modules/auth/core/AuthContext.tsx` | Provider do usuário autenticado |
| `src/app/modules/auth/core/AuthHelpers.ts` | Leitura/escrita do token no storage |
| `src/api/axios.ts` | Interceptors de auth e refresh |

## Fluxo de Login

1. Usuário submete credenciais → `POST /auth/login`
2. API retorna `accessToken` e `refreshToken`
3. Tokens são armazenados via `AuthHelpers.saveTokens()`
4. `AuthContext` atualiza `currentUser` com dados decodificados do JWT

## Interceptors Axios

O interceptor em `src/api/axios.ts` injeta o `accessToken` em cada requisição:

```ts
axiosInstance.interceptors.request.use((config) => {
  const token = AuthHelpers.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Quando a API retorna `401`, o interceptor de resposta tenta renovar o token:

```ts
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newToken = await refreshAccessToken();
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return axiosInstance(error.config);
    }
    return Promise.reject(error);
  }
);
```

## useAuth Hook

```tsx
import { useAuth } from '../modules/auth';

function MyComponent() {
  const { currentUser, logout } = useAuth();
  // currentUser.role, currentUser.name, etc.
}
```

## Permissões de Acesso

O módulo de autenticação também participa do controle de acesso por permissões por meio de `AbilityProtectedRoute`. A navegação e a renderização de páginas protegidas dependem do conjunto de permissões disponível no usuário autenticado.

### Componentes e responsabilidades

| Componente | Responsabilidade |
|------------|-----------------|
| `AbilityProtectedRoute` | Valida se o usuário possui a permissão exigida para renderizar a rota |
| `PERMISSIONS` | Constantes de autorização usadas nas rotas protegidas |
| `AuthContext` | Disponibiliza o usuário atual para regras de acesso e hooks consumidores |

### Fluxo de autorização

1. A aplicação lê o usuário autenticado a partir do `AuthContext`.
2. As rotas protegidas recebem a permissão esperada em `permission`.
3. `AbilityProtectedRoute` verifica se o usuário possui a permissão.
4. Se a permissão existir, o componente filho é renderizado; caso contrário, a navegação é bloqueada pela regra de acesso da aplicação.

### Exemplos de uso

#### Dashboard
A rota `dashboard/*` é encapsulada por `AbilityProtectedRoute` com a permissão `PERMISSIONS.DASHBOARD`.

```tsx
<Route
  element={
    <AbilityProtectedRoute permission={PERMISSIONS.DASHBOARD}>
      <DashboardWrapper />
    </AbilityProtectedRoute>
  }
  path="dashboard/*"
/>
```

#### Relatórios
O módulo de relatórios usa permissões específicas para cada grupo de páginas e subrotas. Cada rota recebe uma permissão do objeto `PERMISSIONS`, como:

| Rota | Permissão |
|------|------------|
| `/relatorios/vendas/geral` | `PERMISSIONS.RELATORIOS_VENDAS_VENDAS` |
| `/relatorios/vendas/produtos-nao-encontrados` | `PERMISSIONS.RELATORIOS_VENDAS_PRODUTOS_NAO_ENCONTRADOS` |
| `/relatorios/vendas/venda-financa` | `PERMISSIONS.RELATORIOS_VENDAS_VENDA_E_FINANCA` |
| `/relatorios/suprimentos/estoque/entrada-saida` | `PERMISSIONS.RELATORIOS_SUPRIMENTOS_ESTOQUE_ENTRADA_SAIDA` |
| `/relatorios/financeiro/geral/balancete` | `PERMISSIONS.RELATORIOS_FINANCEIRO_BALANCETE` |

### Estrutura de rota protegida

```tsx
<Route
  element={
    <AbilityProtectedRoute permission={PERMISSIONS.RELATORIOS_FINANCEIRO}>
      <Routes>
        ...
      </Routes>
    </AbilityProtectedRoute>
  }
/>
```

## Permissões e integração com a sessão

A sessão autenticada alimenta a camada de autorização. O `currentUser` exposto pelo `AuthContext` serve como base para as decisões de acesso nas rotas protegidas e nos componentes que consultam permissões na interface.

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Tratamento centralizado de erros, incluindo erros de autenticação
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de autenticação (`/auth/login`, `/auth/refresh`)
- [Hooks Customizados](/modulos/hooks/) — Outros hooks do sistema