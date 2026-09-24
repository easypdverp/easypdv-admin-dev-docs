---
title: Autenticação
description: Fluxo de autenticação JWT no Despensinha ERP.
sidebar:
  order: 1
---

A autenticação usa **JWT** com **refresh token**. O estado do usuário autenticado é mantido no `AuthContext`, que expõe os dados de sessão para a aplicação por meio do hook `useAuth`.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/modules/auth/core/AuthContext.tsx` | Provider do usuário autenticado e da sessão |
| `src/app/modules/auth/core/AuthHelpers.ts` | Leitura e escrita dos tokens no storage |
| `src/api/axios.ts` | Interceptors de autenticação e renovação de token |

## Fluxo de Login

1. O usuário submete credenciais para `POST /auth/login`
2. A API retorna `accessToken` e `refreshToken`
3. Os tokens são armazenados via `AuthHelpers.saveTokens()`
4. O `AuthContext` atualiza `currentUser` com os dados decodificados do JWT

### Estrutura de dados da sessão

| Campo | Origem | Descrição |
|-------|--------|-----------|
| `accessToken` | Resposta de login / refresh | Token usado nas requisições autenticadas |
| `refreshToken` | Resposta de login | Token usado para renovação da sessão |
| `currentUser` | JWT decodificado | Dados do usuário autenticado expostos pelo contexto |

## Interceptors Axios

O interceptor em `src/api/axios.ts` injeta o `accessToken` em cada requisição autenticada.

```ts
axiosInstance.interceptors.request.use((config) => {
  const token = AuthHelpers.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### Renovação de token

Quando a API retorna `401`, o interceptor de resposta tenta renovar o token antes de repetir a requisição original.

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

### Comportamento dos interceptors

| Interceptor | Função | Entrada | Saída |
|-------------|--------|---------|-------|
| Request | Inclui `Authorization: Bearer <token>` | Configuração da requisição | Requisição autenticada |
| Response | Trata `401` e executa refresh | Resposta com erro | Requisição reenviada com novo token |

## useAuth Hook

O hook `useAuth` fornece acesso aos dados de autenticação e às ações de sessão consumidas pelos componentes.

```tsx
import { useAuth } from '../modules/auth';

function MyComponent() {
  const { currentUser, logout } = useAuth();
  // currentUser.role, currentUser.name, etc.
}
```

### Dados expostos pelo hook

| Propriedade | Tipo | Descrição |
|-------------|------|-------------|
| `currentUser` | Objeto autenticado | Dados do usuário carregados no contexto |
| `logout` | Função | Remove a sessão autenticada |
| `isAuthenticated` | Booleano | Indica se existe sessão válida |

## Configuração de News na Home

A Home consome a lista de notícias por meio do componente `NewsSection`, que usa `react-query` para buscar dados da API configurada em ambiente.

### Arquivo principal

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/pages/home/components/NewsSection.tsx` | Renderização da seção de notícias |
| `src/app/pages/home/core/_requests.ts` | Requisições HTTP da Home |

### Fluxo de dados

1. `NewsSection` executa `useQuery(['home-news'], () => getNews(), { retry: false })`
2. `getNews()` lê `VITE_APP_NEWS_API_URL` via `getProjectEnvVariables()`
3. A requisição é feita com `axios.get<NewsDto[]>(VITE_APP_NEWS_API_URL)`
4. A resposta é normalizada com `useMemo`
5. Se a resposta não for um array, a tela usa uma lista vazia

### Detalhes do componente `NewsSection`

| Item | Valor |
|------|-------|
| Hook de consulta | `useQuery` |
| Chave da query | `['home-news']` |
| Retry | `false` |
| Normalização dos dados | `useMemo` |
| Tipo esperado | `NewsDto[]` |

### Configuração de ambiente

| Variável | Descrição |
|----------|-------------|
| `VITE_APP_NEWS_API_URL` | Endpoint completo da API de notícias exibidas na Home |

### Implementação da requisição

```ts
import axios from 'axios'
import { get } from '../../../../api/axios'
import { HomeEndpoints } from '../../../../api/endpoints/HomeEndpoints'
import { getProjectEnvVariables } from '../../../../shared/projectEnvVariables'
import type {
  SetupLevelDto,
  AnnouncementDto,
  NewsDto,
} from '../types'

export const getNews = () => {
  const { VITE_APP_NEWS_API_URL } = getProjectEnvVariables().envVariables
  return axios.get<NewsDto[]>(VITE_APP_NEWS_API_URL).then(res => res.data)
}
```

### Normalização da resposta

```ts
const news = useMemo(() => {
  if (!response || !(response instanceof Array)) return []
  return response;
}, [response])
```

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Tratamento centralizado de erros, incluindo erros de autenticação
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de autenticação (`/auth/login`, `/auth/refresh`)
- [Hooks Customizados](/modulos/hooks/) — Outros hooks do sistema