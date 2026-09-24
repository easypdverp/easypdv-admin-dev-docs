---
title: Autenticação
description: Fluxo de autenticação JWT no Despensinha ERP.
sidebar:
  order: 1
---

A autenticação usa **JWT** com **refresh token**. O estado do usuário autenticado é mantido no `AuthContext`.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/modules/auth/core/AuthContext.tsx` | Provider do usuário autenticado e do estado global de sessão |
| `src/app/modules/auth/core/AuthHelpers.ts` | Leitura e escrita dos tokens no storage |
| `src/api/axios.ts` | Interceptors de auth, injeção de token e renovação de sessão |

## Fluxo de Login

1. Usuário submete credenciais → `POST /auth/login`
2. A API retorna `accessToken` e `refreshToken`
3. Os tokens são armazenados via `AuthHelpers.saveTokens()`
4. `AuthContext` atualiza `currentUser` com os dados decodificados do JWT
5. O estado de autenticação fica disponível para componentes e páginas via `useAuth`

## Interceptors Axios

O interceptor em `src/api/axios.ts` injeta o `accessToken` em cada requisição autenticada:

```ts
axiosInstance.interceptors.request.use((config) => {
  const token = AuthHelpers.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Quando a API retorna `401`, o interceptor de resposta tenta renovar o token com o `refreshToken` e repetir a requisição original:

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

### Fluxo de renovação

| Etapa | Descrição |
|------|-------------|
| 1 | Uma requisição autenticada retorna `401` |
| 2 | O interceptor marca a requisição com `_retry` |
| 3 | `refreshAccessToken()` consulta o endpoint de refresh |
| 4 | Um novo `accessToken` é retornado e reaplicado no `Authorization` |
| 5 | A requisição original é reenviada com o novo token |

## useAuth Hook

O hook `useAuth` expõe os dados da sessão e as ações relacionadas à autenticação.

```tsx
import { useAuth } from '../modules/auth';

function MyComponent() {
  const { currentUser, logout } = useAuth();
  // currentUser.role, currentUser.name, etc.
}
```

### Contrato do hook

| Propriedade | Tipo | Responsabilidade |
|------------|------|-----------------|
| `currentUser` | objeto | Representa o usuário autenticado disponível no contexto |
| `logout` | função | Finaliza a sessão e limpa os dados de autenticação |

## Autenticação em componentes de formulário

Componentes de tela consomem o estado global de autenticação para tomar decisões de acesso, personalização e exibição de informações do usuário. O `AuthContext` centraliza esse fluxo e evita leitura direta de storage nos componentes.

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Tratamento centralizado de erros, incluindo erros de autenticação
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de autenticação (`/auth/login`, `/auth/refresh`)
- [Hooks Customizados](/modulos/hooks/) — Outros hooks do sistema