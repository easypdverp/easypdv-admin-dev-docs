---
title: Camada API
description: Arquitetura da camada de comunicação com o backend no Despensinha ERP usando Axios.
sidebar:
  order: 4
---

A comunicação com o backend é centralizada em `src/api/`, usando **Axios** com interceptors para autenticação e tratamento de erros.

## Estrutura

```
src/api/
├── axios.ts              # Client Axios, interceptors, CRUD wrappers
├── core/
│   ├── _models.ts        # ApiResponse, ApiResponseError, FieldError
│   ├── axiosErrorMapper.ts  # Mapeamento de erros para mensagens amigáveis
│   ├── errorHandlers.ts  # (deprecated) Handler legado de erros
│   └── links.ts          # Constantes de rotas do frontend
└── endpoints/
    ├── AuthEndpoints.ts
    ├── ProductEndpoints.ts
    ├── ... (90+ arquivos)
    └── WarehouseEndpoints.ts
```

## Client Axios

```
src/api/axios.ts
```

O client é criado com configuração base e exporta funções CRUD tipadas:

```ts
const axiosConfig = {
  baseURL: projectEnvVariables.envVariables.VITE_APP_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,PATCH,OPTIONS',
  },
};

const client = axios.create(axiosConfig);
```

### Funções CRUD

Todas retornam `Promise<ApiResponse<R>>`, já extraindo `.data` da resposta Axios:

| Função | Método HTTP | Assinatura |
|--------|------------|------------|
| `get` | GET | `get<R>(url, config?)` |
| `post` | POST | `post<R, D>(url, data?, config?)` |
| `put` | PUT | `put<R, D>(url, data?, config?)` |
| `patch` | PATCH | `patch<R, D>(url, data?, config?)` |
| `destroy` | DELETE | `destroy<R>(url, config?)` |

```ts
import { get, post } from '@/api/axios';

// GET tipado
const response = await get<ProductDto[]>('/products');
// response.data -> ProductDto[]

// POST tipado
const created = await post<ProductDto, CreateProductDto>('/products', payload);
```

## Interceptors

### Request Interceptor

Adiciona automaticamente o token JWT no header `Authorization`:

```ts
const onRequest = (config) => {
  const auth = getAuth();
  if (auth?.token && !config.url?.includes('refreshtoken')) {
    config.headers.Authorization = auth.type + ' ' + auth.token;
  }
  return config;
};
```

### Response Interceptor

Trata erros da API e faz **refresh automático do token**:

1. Verifica `response.data.success` — se `false`, trata como erro
2. Se status `401` e existe `refresh_token`: tenta renovar o token
3. Se renovação sucede: reenvia a requisição original com novo token
4. Se renovação falha: remove auth e rejeita

```ts
const onResponse = async (response) => {
  if (!response.data.success) {
    const errorResult = new ApiResponseError(response.data);
    if (errorResult.status === 401 && auth?.refresh_token && !originalRequest._retry) {
      originalRequest._retry = true;
      const rs = await refreshToken(auth.refresh_token);
      setAuth(rs.data);
      originalRequest.headers['Authorization'] = 'Bearer ' + rs.data.token;
      return client(originalRequest);
    }
    return Promise.reject(errorResult);
  }
  return Promise.resolve(response);
};
```

## Interface ApiResponse

```
src/api/core/_models.ts
```

Todas as respostas da API seguem este formato:

```ts
interface ApiResponse<T = any> {
  success: boolean;
  status: number;
  message?: string;
  data: T;
  length: number;
  error?: Array<FieldError>;
}

interface FieldError {
  field: string;
  message: string;
}
```

A classe `ApiResponseError` encapsula erros com método `getErrorMessage()`:

```ts
class ApiResponseError {
  status: number;
  message?: string;
  error?: Array<FieldError>;

  getErrorMessage(): string | undefined;
}
```

## Padrão de Endpoints

Cada entidade tem seu próprio arquivo em `src/api/endpoints/` com constantes de URL da API:

```ts
// src/api/endpoints/AuthEndpoints.ts
export const AuthEndpoints = {
  refreshToken: '/auth/refresh-token',
  logout: '/auth/logout',
  login: '/auth/login',
  forgotPassword: '/auth/forgot-password',
  googleLogin: '/auth/google',
  resetPassword: '/auth/reset-password',
};
```

São mais de **90 arquivos de endpoints** cobrindo todos os módulos: `ProductEndpoints`, `SaleOrderEndpoints`, `InventoryEndpoints`, `BankAccountEndpoints`, etc.

### Uso com as funções CRUD

```ts
import { get, post } from '@/api/axios';
import { AuthEndpoints } from '@/api/endpoints/AuthEndpoints';

// Login
const result = await post(AuthEndpoints.login, { email, password });

// Refresh token
const refreshed = await post(AuthEndpoints.refreshToken, refreshToken);
```

## Constantes de Rotas (Links)

```
src/api/core/links.ts
```

Centraliza todas as URLs de rotas do **frontend** (não da API). Usado para navegação programática:

```ts
export const PRODUCT_PAGE_URL = '/cadastros/catalogo/produto';
export const PRODUCT_DETAIL_PAGE_URL = (id: string) => `/cadastros/catalogo/produto/${id}`;
export const PRODUCT_LIST_PAGE_URL = '/cadastros/catalogo/produto/lista';
export const PRODUCT_NEW_PAGE_URL = '/cadastros/catalogo/produto/novo';
export const PRODUCT_EDIT_PAGE_URL = (id: string) => `/cadastros/catalogo/produto/edita/${id}`;
```

O padrão segue a convenção:
- `{ENTITY}_PAGE_URL` — rota base
- `{ENTITY}_LIST_PAGE_URL` — listagem
- `{ENTITY}_NEW_PAGE_URL` — criação
- `{ENTITY}_EDIT_PAGE_URL(id)` — edição
- `{ENTITY}_DETAIL_PAGE_URL(id)` — detalhe
- `{ENTITY}_REMOVE_PAGE_URL(id)` — modal de remoção

## Adicionando um Novo Endpoint

1. Crie `src/api/endpoints/{Entity}Endpoints.ts` com as URLs da API
2. Use as funções CRUD (`get`, `post`, etc.) nos hooks ou services
3. Adicione as constantes de rotas do frontend em `links.ts`
