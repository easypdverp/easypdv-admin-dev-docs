---
title: Autenticação
description: Fluxo de autenticação JWT no Despensinha ERP.
sidebar:
  order: 1
---

A autenticação usa **JWT** com refresh token. O estado do usuário autenticado é mantido no `AuthContext`, e os dados de sessão são consumidos por componentes e hooks via `useAuth()`.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/modules/auth/core/AuthContext.tsx` | Provider do usuário autenticado e da sessão ativa |
| `src/app/modules/auth/core/AuthHelpers.ts` | Leitura, escrita e remoção dos tokens no storage |
| `src/api/axios.ts` | Interceptors de autenticação, renovação de token e retentativa de requisição |

## Estrutura de Sessão

A autenticação trabalha com os seguintes elementos:

| Campo | Tipo | Responsabilidade |
|-------|------|-----------------|
| `accessToken` | `string` | Token usado em requisições autenticadas |
| `refreshToken` | `string` | Token usado para renovação do `accessToken` |
| `currentUser` | objeto derivado do JWT | Dados do usuário autenticado expostos pelo contexto |
| `Authorization` | header HTTP | Transporte do `accessToken` no formato `Bearer` |

O `AuthContext` centraliza:

- leitura do estado inicial da sessão;
- persistência dos tokens;
- exposição do usuário autenticado para a árvore React;
- operação de logout;
- renovação da sessão quando o `accessToken` expira.

## Fluxo de Login

1. O usuário submete as credenciais.
2. A aplicação envia `POST /auth/login`.
3. A API retorna `accessToken` e `refreshToken`.
4. `AuthHelpers.saveTokens()` persiste os tokens no storage.
5. O `AuthContext` decodifica o `accessToken` e atualiza `currentUser`.
6. A interface passa a consumir os dados autenticados via `useAuth()`.

## Fluxo de Renovação de Token

Quando uma requisição autenticada responde com `401`, o interceptor de resposta executa a renovação:

1. A requisição original é marcada com `_retry` para evitar loop infinito.
2. A aplicação chama o fluxo de refresh, normalmente em `POST /auth/refresh`.
3. A API retorna um novo `accessToken`.
4. O novo token substitui o anterior no storage.
5. A requisição original é reenviada com o novo `Authorization: Bearer <token>`.

### Interceptor de Requisição

O interceptor em `src/api/axios.ts` injeta o `accessToken` automaticamente em cada chamada autenticada:

```ts
axiosInstance.interceptors.request.use((config) => {
  const token = AuthHelpers.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### Interceptor de Resposta

Quando a API responde com `401`, o interceptor tenta renovar a sessão e refazer a operação original:

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

## AuthHelpers

O módulo `AuthHelpers` encapsula o acesso ao storage da sessão.

| Método | Responsabilidade |
|--------|-----------------|
| `getAccessToken()` | Lê o `accessToken` persistido |
| `getRefreshToken()` | Lê o `refreshToken` persistido |
| `saveTokens()` | Persiste os tokens recebidos da API |
| `clearTokens()` | Remove os tokens do storage |
| `hasAuthTokens()` | Verifica se existe sessão persistida |

Esse helper mantém a lógica de storage isolada do restante da aplicação, permitindo que o `AuthContext` e os interceptors dependam apenas da API pública do módulo.

## AuthContext

O `AuthContext` expõe o estado autenticado e operações de sessão para toda a aplicação.

| Propriedade / método | Tipo | Uso |
|----------------------|------|-----|
| `currentUser` | objeto \| `null` | Dados do usuário autenticado |
| `isAuthenticated` | `boolean` | Indica se existe sessão válida |
| `login()` | função | Executa o fluxo de autenticação |
| `logout()` | função | Encerra a sessão e limpa tokens |
| `refreshUser()` | função | Recarrega os dados do usuário a partir do token atual |

O contexto mantém a fonte de verdade da autenticação para telas, guards e componentes que precisam de informações como:

- `currentUser.role`
- `currentUser.name`
- `currentUser.email`
- permissões ou escopos vinculados ao usuário

## useAuth Hook

O hook `useAuth()` é a interface de consumo do estado autenticado.

```tsx
import { useAuth } from '../modules/auth';

function MyComponent() {
  const { currentUser, logout } = useAuth();
  // currentUser.role, currentUser.name, etc.
}
```

### Retorno do Hook

| Campo | Tipo | Descrição |
|------|------|-------------|
| `currentUser` | objeto \| `null` | Usuário autenticado disponível no contexto |
| `isAuthenticated` | `boolean` | Indica presença de sessão |
| `login` | função | Inicia autenticação com credenciais |
| `logout` | função | Encerra a sessão corrente |

## Decodificação do JWT

Após o login, o `accessToken` é decodificado para obtenção dos dados do usuário. Esse processo alimenta o `currentUser` com os claims relevantes do JWT, permitindo que a interface use as informações de sessão sem chamadas adicionais para dados básicos do usuário.

Campos comuns consumidos do token:

| Claim | Uso |
|------|-----|
| `sub` | Identificador do usuário |
| `name` | Nome de exibição |
| `email` | E-mail do usuário |
| `role` | Perfil ou nível de acesso |

## Logout

O logout encerra a sessão local:

1. Tokens são removidos do storage.
2. `currentUser` é limpo no `AuthContext`.
3. A aplicação passa a tratar o usuário como não autenticado.
4. Rotas protegidas deixam de estar disponíveis.

## Integração com Rotas Protegidas

A autenticação é usada em conjunto com proteções de rota para liberar páginas internas apenas quando `isAuthenticated` é verdadeiro. O fluxo padrão combina:

- `AuthContext` para estado global;
- `useAuth()` para consumo em componentes;
- interceptors do Axios para chamadas autenticadas;
- refresh token para continuidade da sessão.

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Tratamento centralizado de erros, incluindo erros de autenticação
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de autenticação (`/auth/login`, `/auth/refresh`)
- [Hooks Customizados](/modulos/hooks/) — Outros hooks do sistema