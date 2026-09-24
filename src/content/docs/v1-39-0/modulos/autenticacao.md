---
title: Autenticação
description: Fluxo de autenticação JWT no Despensinha ERP.
sidebar:
  order: 1
---

A autenticação usa **JWT** com **refresh token**. O estado do usuário autenticado é mantido no `AuthContext`, e os fluxos de requisição usam `src/api/axios.ts` para injeção automática do token e renovação de sessão.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/modules/auth/core/AuthContext.tsx` | Provider do usuário autenticado e estado global de sessão |
| `src/app/modules/auth/core/AuthHelpers.ts` | Leitura e escrita dos tokens no storage |
| `src/api/axios.ts` | Instância HTTP com interceptors de autenticação e refresh |
| `src/app/modules/auth/index.ts` | Exportação do hook `useAuth` e dos componentes de autenticação |

## Fluxo de Login

1. O usuário submete credenciais e o formulário envia `POST /auth/login`
2. A API retorna `accessToken` e `refreshToken`
3. `AuthHelpers.saveTokens()` persiste os tokens no storage
4. `AuthContext` decodifica o `accessToken` e atualiza `currentUser`
5. O hook `useAuth` disponibiliza `currentUser`, `logout` e estados derivados para os componentes

### Dados mantidos no contexto

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `currentUser` | objeto | Dados do usuário autenticado decodificados do JWT |
| `isAuthenticated` | boolean | Indica se há sessão válida em memória |
| `logout` | função | Limpa tokens e encerra a sessão local |
| `refreshToken` | string | Token de renovação armazenado no backend/storage, conforme a estratégia do app |

## Interceptors Axios

O interceptor em `src/api/axios.ts` injeta o `accessToken` em cada requisição autenticada.

```ts
axiosInstance.interceptors.request.use((config) => {
  const token = AuthHelpers.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Quando a API retorna `401`, o interceptor de resposta tenta renovar o token com o fluxo de refresh e reexecuta a requisição original:

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

### Comportamento do refresh

| Situação | Resultado |
|----------|-----------|
| `accessToken` válido | Requisição segue com `Authorization: Bearer <token>` |
| `401` na resposta | O interceptor tenta renovar a sessão |
| Refresh bem-sucedido | A requisição original é repetida com o novo `accessToken` |
| Refresh indisponível ou inválido | A promise é rejeitada e o fluxo de erro é tratado pelo sistema |

## useAuth Hook

O hook `useAuth` é consumido pelos componentes que precisam do estado da sessão.

```tsx
import { useAuth } from '../modules/auth';

function MyComponent() {
  const { currentUser, logout } = useAuth();
  // currentUser.role, currentUser.name, etc.
}
```

### Contrato do hook

| Propriedade | Tipo | Uso |
|-------------|------|-----|
| `currentUser` | objeto \| null | Dados do usuário logado |
| `logout` | função | Encerra a sessão corrente |
| `isAuthenticated` | boolean | Controle de exibição condicional |
| `loading` | boolean | Indica leitura inicial do contexto |

## Estrutura de componentes

| Componente | Responsabilidade |
|------------|-----------------|
| `AuthProvider` | Disponibiliza o contexto de autenticação para a árvore React |
| `LoginForm` | Captura credenciais e dispara a autenticação |
| `ProtectedRoute` | Bloqueia rotas sem sessão válida |
| `UnauthorizedPage` | Exibe acesso negado ou sessão inválida |

## Storage de autenticação

`AuthHelpers` centraliza a leitura e a escrita dos tokens e mantém a interface de persistência usada pela camada HTTP e pelo contexto.

| Função | Responsabilidade |
|--------|-----------------|
| `saveTokens()` | Persiste `accessToken` e `refreshToken` |
| `getAccessToken()` | Retorna o `accessToken` atual |
| `getRefreshToken()` | Retorna o `refreshToken` atual |
| `clearTokens()` | Remove tokens do storage |
| `decodeToken()` | Extrai os dados do usuário a partir do JWT |

## Integração com módulos protegidos

Os módulos protegidos usam `useAuth` para acessar dados do usuário e permissões derivadas do JWT, como `name`, `role` e outros atributos do payload autenticado. Esse estado alimenta componentes de navegação, permissões de rota e exibição condicional de ações.

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Tratamento centralizado de erros, incluindo erros de autenticação
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de autenticação (`/auth/login`, `/auth/refresh`)
- [Hooks Customizados](/modulos/hooks/) — Outros hooks do sistema