---
title: Autenticação
description: Fluxo de autenticação JWT no Despensinha ERP.
sidebar:
  order: 1
---

A autenticação usa **JWT** com `accessToken` e `refreshToken`. O estado do usuário autenticado fica centralizado no `AuthContext`, e os interceptors do Axios tratam a inclusão automática do token nas requisições e a renovação do `accessToken` quando a API retorna `401`.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/modules/auth/core/AuthContext.tsx` | Provider do usuário autenticado, expõe `currentUser`, `login` e `logout` |
| `src/app/modules/auth/core/AuthHelpers.ts` | Leitura, escrita e remoção dos tokens no storage |
| `src/api/axios.ts` | Interceptors de autenticação, refresh token e retry de requisições |
| `src/app/modules/auth/index.ts` | Exportação do hook `useAuth` e do contexto de autenticação |

## Fluxo de Login

1. O usuário submete as credenciais no formulário de autenticação.
2. A aplicação executa `POST /auth/login`.
3. A API retorna `accessToken`, `refreshToken` e os dados do usuário autenticado.
4. `AuthHelpers.saveTokens()` persiste os tokens no storage.
5. O `AuthContext` decodifica o `accessToken` e atualiza `currentUser`.
6. Os componentes consumem os dados via `useAuth()`.

### Campos do payload de autenticação

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `accessToken` | `string` | Token usado nas requisições autenticadas |
| `refreshToken` | `string` | Token usado na renovação da sessão |
| `currentUser` | objeto | Dados derivados do JWT e expostos pelo contexto |

## Interceptors Axios

O interceptor de requisição em `src/api/axios.ts` injeta o `accessToken` no header `Authorization` de todas as chamadas autenticadas.

```ts
axiosInstance.interceptors.request.use((config) => {
  const token = AuthHelpers.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### Responsabilidade do interceptor de requisição

| Etapa | Comportamento |
|-------|---------------|
| Leitura do token | Recupera o `accessToken` do storage via `AuthHelpers.getAccessToken()` |
| Montagem do header | Inclui `Authorization: Bearer <token>` |
| Encaminhamento | Mantém a requisição original sem alterar o restante do `config` |

Quando a API responde com `401`, o interceptor de resposta tenta renovar o token usando o `refreshToken` e reexecuta a requisição original.

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

### Responsabilidade do interceptor de resposta

| Etapa | Comportamento |
|-------|---------------|
| Detecção do `401` | Identifica falha de autenticação na resposta da API |
| Controle de repetição | Usa `error.config._retry` para evitar loop infinito |
| Renovação | Chama `refreshAccessToken()` para obter novo `accessToken` |
| Retry | Reenvia a requisição original com o novo token |

## Refresh Token

O fluxo de renovação usa o endpoint de refresh da API e mantém a sessão sem intervenção do usuário enquanto o `refreshToken` permanece válido.

### Endpoint utilizado

| Endpoint | Finalidade |
|----------|------------|
| `POST /auth/refresh` | Gera um novo `accessToken` a partir do `refreshToken` |

### Fluxo de renovação

1. A requisição retorna `401`.
2. O interceptor de resposta executa `refreshAccessToken()`.
3. O novo `accessToken` é salvo no storage.
4. O header `Authorization` da requisição original é atualizado.
5. A requisição é executada novamente.

## AuthContext

O `AuthContext` concentra o estado da sessão autenticada e fornece as operações de autenticação para a aplicação.

### Estado exposto

| Propriedade | Tipo | Descrição |
|-------------|------|-------------|
| `currentUser` | objeto \| `null` | Usuário autenticado, derivado do JWT |
| `isAuthenticated` | `boolean` | Indica se existe usuário carregado no contexto |
| `login()` | função | Executa autenticação e persistência dos tokens |
| `logout()` | função | Remove os tokens e limpa o estado autenticado |

### Fluxo de dados

| Origem | Destino | Papel |
|--------|---------|------|
| Resposta do login | `AuthHelpers` | Persistência dos tokens |
| `accessToken` | `AuthContext` | Decodificação dos dados do usuário |
| `AuthContext` | componentes | Distribuição de `currentUser` e ações de sessão |
| `logout()` | storage + contexto | Limpeza dos tokens e do estado autenticado |

## useAuth Hook

O hook `useAuth` entrega acesso direto ao contexto de autenticação em qualquer componente funcional.

```tsx
import { useAuth } from '../modules/auth';

function MyComponent() {
  const { currentUser, logout } = useAuth();
  // currentUser.role, currentUser.name, etc.
}
```

### Uso típico

| Valor | Uso |
|-------|-----|
| `currentUser.name` | Exibição do nome do usuário na interface |
| `currentUser.role` | Controle de permissões e visibilidade de componentes |
| `logout()` | Encerramento da sessão |
| `isAuthenticated` | Proteção de rotas e renderização condicional |

## Integração com Autorização

A autenticação trabalha em conjunto com o sistema de permissões da aplicação. O `currentUser` alimenta as regras de acesso usadas por componentes como `AbilityProtectedRoute`.

### Componentes relacionados

| Componente | Responsabilidade |
|------------|-----------------|
| `AbilityProtectedRoute` | Bloqueia acesso conforme permissão do usuário |
| `PERMISSIONS` | Catálogo central de permissões da aplicação |
| `AuthContext` | Fonte da identidade autenticada |

## Logout

O logout limpa o estado autenticado e remove os tokens armazenados, encerrando a sessão local.

### Efeitos do logout

| Ação | Resultado |
|------|-----------|
| Remoção de `accessToken` | Interceptores deixam de enviar autenticação |
| Remoção de `refreshToken` | Renovação de sessão fica indisponível |
| Limpeza do `currentUser` | Interface volta ao estado anônimo |
| Redirecionamento | Usuário retorna para a tela de acesso |

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Tratamento centralizado de erros, incluindo erros de autenticação
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de autenticação (`/auth/login`, `/auth/refresh`)
- [Hooks Customizados](/modulos/hooks/) — Outros hooks do sistema