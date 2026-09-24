---
title: Autenticação
description: Fluxo de autenticação JWT no Despensinha ERP.
sidebar:
  order: 1
---

A autenticação usa **JWT** com **refresh token**. O estado do usuário autenticado é mantido no `AuthContext`, e o acesso às informações do usuário é feito pelo hook `useAuth()`.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/modules/auth/core/AuthContext.tsx` | Provider do usuário autenticado |
| `src/app/modules/auth/core/AuthHelpers.ts` | Leitura e escrita dos tokens no storage |
| `src/api/axios.ts` | Interceptors de autenticação e renovação de token |
| `src/app/modules/auth/core/Auth.ts` | Exporta o hook `useAuth()` |

## Fluxo de Login

1. O usuário envia as credenciais para `POST /auth/login`
2. A API retorna `accessToken` e `refreshToken`
3. Os tokens são armazenados por `AuthHelpers.saveTokens()`
4. `AuthContext` decodifica o `accessToken` e atualiza `currentUser`
5. O hook `useAuth()` expõe `currentUser`, `logout` e os dados de sessão para os componentes da aplicação

## Interceptors Axios

O interceptor de requisição em `src/api/axios.ts` lê o `accessToken` salvo e injeta o cabeçalho `Authorization` em todas as chamadas autenticadas:

```ts
axiosInstance.interceptors.request.use((config) => {
  const token = AuthHelpers.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Quando a API responde com `401`, o interceptor de resposta tenta renovar a sessão com o `refreshToken` e repetir a requisição original:

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

### Fluxo de Renovação

| Etapa | Descrição |
|-------|-------------|
| 1 | Uma requisição retorna `401` |
| 2 | O interceptor marca a requisição com `_retry` |
| 3 | `refreshAccessToken()` chama o endpoint de renovação |
| 4 | Um novo `accessToken` é aplicado no cabeçalho `Authorization` |
| 5 | A requisição original é executada novamente |

## useAuth Hook

O hook `useAuth()` fornece acesso ao usuário autenticado e às ações de sessão.

```tsx
import { useAuth } from '../modules/auth';

function MyComponent() {
  const { currentUser, logout } = useAuth();
  // currentUser.role, currentUser.name, etc.
}
```

### Dados Expostos

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `currentUser` | objeto | Dados do usuário autenticado decodificados do JWT |
| `logout` | função | Encerra a sessão e limpa os tokens |
| `isAuthenticated` | boolean | Indica se existe sessão válida |
| `token` | string | `accessToken` carregado do storage |

## Contexto do Cliente no Módulo de Agente

O módulo de chat de agente usa o contexto autenticado para enriquecer chamadas ao backend com o contexto do usuário e da navegação atual.

### `AgentContextProvider`

| Componente / Hook | Responsabilidade |
|-------------------|-----------------|
| `AgentContextProvider` | Mantém o contexto de cliente para o módulo de agente |
| `useAgentSelectedEntities()` | Registra entidades selecionadas da tela atual |
| `useAgentClientContext()` | Retorna a função que monta o contexto do cliente |

O contexto enviado para o backend usa a estrutura `AgentClientContextDto`:

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `module` | string | Módulo derivado da rota atual |
| `screen` | string | Caminho normalizado da tela atual |
| `selected_entities` | `Record<string, unknown>` | Entidades selecionadas na interface |

### Derivação do Contexto de Tela

`deriveScreenContext(pathname)` converte a rota atual em um par `{ module, screen }`.

| Regra | Resultado |
|-------|-----------|
| `/cadastros/catalogo/...` | `module = "catalog"` |
| `cadastros`, `vendas`, `suprimentos`, `financas`, `relatorios`, `preferencias` | mapeados para nomes internos de módulo |
| UUIDs na rota | Substituídos por `:id` |
| Segmentos numéricos | Substituídos por `:id` |

## Integração com o Módulo de Agente

A autenticação é usada em fluxos que dependem do usuário logado, como o chat unificado do agente.

### Componentes Relacionados

| Componente | Responsabilidade |
|------------|-----------------|
| `AgentChatWidget` | Exibe o botão flutuante do assistente |
| `UnifiedChatContainer` | Carrega o painel de chat unificado |
| `ChatPanel` | Orquestra as abas do assistente, mensagens e encaminhamento humano |
| `useUnifiedChat()` | Une o fluxo de IA e o fluxo de atendimento humano |
| `useChatwootChat()` | Gerencia a conversa com Chatwoot |
| `useAgentChat()` | Gerencia o fluxo de IA interno |

### Fluxo de Dados

1. `useAuth()` disponibiliza `currentUser`
2. `useChatwootIdentity()` usa `currentUser.id`, `name`, `email` e `telephone` para identificar o contato no Chatwoot
3. `useAgentClientContext()` monta o contexto enviado nas requisições do assistente
4. `useUnifiedChat()` seleciona a origem da conversa entre IA e atendimento humano
5. `ChatPanel` renderiza `ThreadPrimitive.Messages`, `ComposerPrimitive.Input` e `ComposerPrimitive.Send`

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Tratamento centralizado de erros, incluindo erros de autenticação
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de autenticação (`/auth/login`, `/auth/refresh`)
- [Hooks Customizados](/modulos/hooks/) — Outros hooks do sistema