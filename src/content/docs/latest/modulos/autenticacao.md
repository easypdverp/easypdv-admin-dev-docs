---
title: Autenticação
description: Fluxo de autenticação JWT no Despensinha ERP.
sidebar:
  order: 1
---

A autenticação usa JWT com renovação de sessão. O `AuthProvider` mantém o objeto `AuthModel`, e `AuthInit` carrega os dados do usuário para o `AuthContext`. A autorização usa as permissões de `currentUser` por meio do provider CASL.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/modules/auth/core/AuthContext.ts` | Instância estável do contexto, tipos e estado inicial |
| `src/app/modules/auth/core/Auth.tsx` | `AuthProvider`, `AuthInit`, `useAuth` e reexportação de `AuthContext` |
| `src/app/modules/auth/core/AuthHelpers.ts` | Persistência da autenticação no storage |
| `src/app/modules/auth/core/_requests.ts` | Login, refresh e consulta do perfil |
| `src/api/axios.ts` | Interceptors e renovação compartilhada de tokens |
| `src/app/casl/AbilityContext.tsx` | `AbilityProvider`, `useAbility`, `useCanAny` e `Can` |

## Fluxo de Login

1. O formulário envia `username` e `password` para `POST /auth/login`.
2. O envelope da API retorna um `AuthModel`, persistido por `saveAuth` e `AuthHelpers.setAuth`.
3. Com `auth.token` disponível, `AuthInit` consulta `GET /account/details` por `getUserPreferencesDetails()`.
4. A resposta `AccountDetailsDto` preenche `currentUser` por `setCurrentUser`.
5. `AbilityProvider` deriva as permissões de `currentUser.permissions` e os componentes consomem a sessão por `useAuth()`.

### Dados da sessão

| Campo | Tipo | Responsabilidade |
|-------|------|-----------------|
| `auth.token` | `string` | JWT enviado nas chamadas autenticadas |
| `auth.refresh_token` | `string`, opcional | Credencial usada para renovar a sessão |
| `auth.type` | `string` | Tipo de autenticação usado no header |
| `currentUser` | `AccountDetailsDto`, opcional | Perfil obtido de `/account/details` |

O perfil é carregado pela API. A leitura do claim `exp` do JWT serve à verificação de expiração do token.

## Interceptors e renovação

O interceptor de requisição lê `getAuth()` e monta `Authorization` com `auth.type` e `auth.token`. O interceptor de resposta verifica o envelope `ApiResponse`; uma falha semântica com `status: 401` pode iniciar a renovação mesmo quando o HTTP é `200`.

| Etapa | Comportamento |
|-------|---------------|
| Detecção | `success: false`, status semântico `401` e `refresh_token` disponível |
| Controle de repetição | `_retry` limita a repetição da requisição original |
| Renovação | `refreshToken()` envia `refresh_token` a `POST /auth/refresh-token` |
| Concorrência | `getRefreshedAuth()` compartilha `refreshPromise` entre chamadas simultâneas |
| Persistência | `setAuth()` grava o novo `AuthModel` |
| Reenvio | A requisição original recebe o novo token e é executada novamente |
| Falha | O payload de erro HTTP é rejeitado quando disponível; nos demais casos o auth é removido e o erro é propagado |

Respostas binárias retornam dados crus. Uma resposta JSON em uma chamada de streaming é lida como `ApiResponse` para preservar o tratamento de falhas e refresh. O código completo está em [API e Endpoints](/latest/arquitetura/api-endpoints/).

### SSE de notificações

`getFreshToken()` verifica a expiração com margem de 10 segundos e renova o token quando necessário. O módulo de notificações chama esse helper antes de abrir o `EventSource` com `?token=...`; o token enviado na URL não passa pelo interceptor de requisição do Axios.

## AuthHelpers

| Método | Responsabilidade |
|--------|-----------------|
| `getAuth()` | Lê o `AuthModel` persistido |
| `setAuth(auth)` | Persiste a autenticação e emite `AUTH_EVENT_KEY` |
| `removeAuth()` | Remove a autenticação e emite `AUTH_EVENT_KEY` |

O provider escuta `AUTH_EVENT_KEY` para atualizar seu estado quando a persistência muda.

## AuthContext e useAuth

`AuthContext.ts` concentra a instância do contexto para manter sua identidade durante HMR. `Auth.tsx` reexporta essa instância e implementa `useAuth()` com `useContext(AuthContext)`.

| Propriedade | Responsabilidade |
|-------------|-----------------|
| `auth` | Credenciais atuais ou `undefined` |
| `saveAuth` | Atualiza estado e persistência da autenticação |
| `currentUser` | Perfil do usuário ou `undefined` |
| `setCurrentUser` | Atualiza o perfil carregado |
| `logout` | Limpa autenticação, perfil e define a mensagem de erro opcional |
| `errorMessage` | Mensagem opcional da sessão |

```tsx
import { useAuth } from '@/app/modules/auth/core/Auth';

function UserMenu() {
  const { currentUser, logout } = useAuth();
  return <button onClick={() => logout()}>{currentUser?.name}: Sair</button>;
}
```

`AuthInit` mantém a tela de carregamento enquanto existe token sem perfil carregado. Os componentes usam `currentUser` para identidade e a camada CASL para decidir acesso a recursos.

## Controle de acesso por permissões

| Componente / Hook | Responsabilidade |
|-------------------|------------------|
| `AbilityProtectedRoute` | Protege rotas por uma ou mais permissões |
| `Can` | Renderiza blocos condicionais no JSX |
| `useAbility()` | Acesso programático a `ability.can('access', permission)` |
| `useCanAny()` | Verifica se o usuário possui qualquer permissão de um grupo |

`permissionGroups.ts` reúne os grupos `DASHBOARD_*_PERMISSIONS`, `PICKLIST_PERMISSIONS`, `WAREHOUSE_TASK_PERMISSIONS` e `PURCHASE_INVOICE_READ_PERMISSIONS` usados por rotas, menus e componentes.

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
A rota `dashboard/*` aceita as permissões do grupo `DASHBOARD_PERMISSIONS`.

```tsx
<Route
  element={
    <AbilityProtectedRoute permissions={DASHBOARD_PERMISSIONS}>
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
    <AbilityProtectedRoute permission={PERMISSIONS.RELATORIOS_FINANCEIRO_BALANCETE}>
      <Routes>
        ...
      </Routes>
    </AbilityProtectedRoute>
  }
/>
```

## Permissões e integração com a sessão

A sessão autenticada alimenta a camada de autorização. O `currentUser` exposto pelo `AuthContext` serve como base para as decisões de acesso nas rotas protegidas e nos componentes que consultam permissões na interface.

## Autenticação em componentes de formulário

Componentes de tela consomem o estado global de autenticação para tomar decisões de acesso, personalização e exibição de informações do usuário. O `AuthContext` centraliza esse fluxo e evita leitura direta de storage nos componentes.

## Logout

O logout limpa o estado autenticado e remove os tokens armazenados, encerrando a sessão local.

### Efeitos do logout

| Ação | Resultado |
|------|-----------|
| Remoção de `auth.token` | Interceptores deixam de enviar autenticação |
| Remoção de `auth.refresh_token` | Renovação de sessão fica indisponível |
| Limpeza do `currentUser` | Interface volta ao estado anônimo |
| Redirecionamento | Usuário retorna para a tela de acesso |

## Configuração de News na Home

A Home consome a lista de notícias por meio do componente `NewsSection`, que usa `@tanstack/react-query` para buscar dados da API configurada em ambiente.

### Arquivo principal

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/pages/home/components/NewsSection.tsx` | Renderização da seção de notícias |
| `src/app/pages/home/core/_requests.ts` | Requisições HTTP da Home |

### Fluxo de dados

1. `NewsSection` executa `useQuery({ queryKey: ['home-news'], queryFn: () => getNews(), retry: false })`
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

## Permissões em telas e fluxos

A autenticação também governa:

- exibição de abas do dashboard por grupo de permissões;
- acesso a telas de Preferências, Relatórios, Suprimentos, Financeiro, Notificações e Espaço do Contador/Gestor;
- ações de formulário, como criação de marcadores, lotes, ajustes de estoque, importação de NFe e execução de operações de picklist;
- exibição de botões e menus contextuais em tabelas e modais.

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Tratamento centralizado de erros, incluindo erros de autenticação
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de autenticação (`/auth/login`, `/auth/refresh-token`)
- [Hooks Customizados](/modulos/hooks/) — Outros hooks do sistema