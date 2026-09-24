---
title: Autenticação
description: Fluxo de autenticação JWT no Despensinha ERP.
sidebar:
  order: 1
---

A autenticação usa **JWT** com `accessToken` e `refreshToken`. O estado do usuário autenticado é mantido no `AuthContext` e exposto pelos hooks `useAuth`, `useAbility` e `Can`, que são usados em rotas, menus e componentes para controle de acesso baseado em permissões.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/modules/auth/core/AuthContext.tsx` | Provider do usuário autenticado, acesso às permissões e helpers de sessão |
| `src/app/modules/auth/core/AuthHelpers.ts` | Leitura/escrita de tokens no storage |
| `src/api/axios.ts` | Interceptors de auth, refresh e renovação de sessão |

## Fluxo de Login

1. Usuário submete credenciais → `POST /auth/login`
2. API retorna `accessToken` e `refreshToken`
3. Tokens são armazenados via `AuthHelpers.saveTokens()`
4. `AuthContext` atualiza `currentUser` com os dados decodificados do JWT
5. As permissões do usuário passam a ser avaliadas por `ability.can('access', permission)` e pelos componentes `AbilityProtectedRoute` e `Can`

## Interceptors Axios

O interceptor em `src/api/axios.ts` injeta o `accessToken` em cada requisição:

```ts
axiosInstance.interceptors.request.use((config) => {
  const token = AuthHelpers.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Quando a API retorna `401`, o interceptor de resposta tenta renovar o token e repetir a requisição original com o novo `Authorization`.

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

O helper `getFreshToken()` é usado por fluxos que precisam de um token válido antes de abrir uma conexão persistente, como SSE.

### SSE de notificações

O módulo de notificações abre a stream com `EventSource` usando `?token=...` na URL. Antes de conectar, o contexto chama `getFreshToken()` para garantir um token válido. Em caso de falha, a conexão entra em rotina de reconexão com limite de tentativas.

## Controle de acesso por permissões

A navegação e a renderização de componentes usam permissões do `casl`:

| Componente / Hook | Responsabilidade |
|-------------------|------------------|
| `AbilityProtectedRoute` | Protege rotas por uma ou mais permissões |
| `Can` | Renderiza blocos condicionais no JSX |
| `useAbility()` | Acesso programático às permissões do usuário |
| `useCanAny()` | Verifica se o usuário possui qualquer permissão de um grupo |

Em várias áreas do sistema, as rotas e subrotas são protegidas por permissões como `PERMISSIONS.*` e grupos como `DASHBOARD_*_PERMISSIONS`, `PICKLIST_PERMISSIONS`, `WAREHOUSE_TASK_PERMISSIONS` e `PURCHASE_INVOICE_READ_PERMISSIONS`.

## useAuth Hook

```tsx
import { useAuth } from '../modules/auth';

function MyComponent() {
  const { currentUser, logout } = useAuth();
  // currentUser.role, currentUser.name, currentUser.permissions, etc.
}
```

## Permissões em telas e fluxos

A autenticação também governa:

- exibição de abas do dashboard por grupo de permissões;
- acesso a telas de Preferências, Relatórios, Suprimentos, Financeiro, Notificações e Espaço do Contador/Gestor;
- ações de formulário, como criação de marcadores, lotes, ajustes de estoque, importação de NFe e execução de operações de picklist;
- exibição de botões e menus contextuais em tabelas e modais.

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Tratamento centralizado de erros, incluindo erros de autenticação
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de autenticação (`/auth/login`, `/auth/refresh`)
- [Hooks Customizados](/modulos/hooks/) — Outros hooks do sistema