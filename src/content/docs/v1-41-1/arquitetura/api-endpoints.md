---
title: API e Endpoints
description: Padroes de comunicacao com a API e catalogo completo de endpoints do Despensinha ERP.
sidebar:
  order: 5
---

O Despensinha ERP utiliza uma camada de API centralizada baseada no **axios**, com wrappers tipados que garantem respostas consistentes via `ApiResponse<T>`. Toda comunicação com o backend segue um padrão uniforme: uma instância de axios configurada com interceptors de autenticação e tratamento de erros, e arquivos de endpoints organizados por domínio que exportam objetos constantes com paths estáticos e funções para paths dinâmicos.

A camada também trata respostas binárias e fluxos de streaming de forma diferenciada, permitindo que requisições com `responseType` `blob`, `arraybuffer` ou `stream` retornem dados crus sem validação do envelope `ApiResponse`.

## Configuração do Axios

A instância do axios é criada em `src/api/axios.ts` com a seguinte configuração base:

```typescript
import axios from 'axios';
import { getProjectEnvVariables } from '../shared/projectEnvVariables';

const projectEnvVariables = getProjectEnvVariables();

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

A `baseURL` vem da variavel de ambiente `VITE_APP_API_URL`, configurada em `.env.development` para desenvolvimento e injetada pelo CI/CD em producao. O carregamento das variaveis de ambiente passa pela funcao `getProjectEnvVariables()` em `src/shared/projectEnvVariables.ts`, que resolve valores vindos de placeholders de container ou de `import.meta.env`.

### Variaveis de Ambiente

A camada de ambiente usa o tipo `ProjectEnvVariablesType` e expoe os valores por meio de `getProjectEnvVariables()`.

| Variavel | Descricao | Origem tipica |
|----------|-----------|---------------|
| `VITE_GENERATE_SOURCEMAP` | Controla a geracao de sourcemaps | Build ou container |
| `VITE_APP_API_URL` | URL base da API | Build ou container |
| `VITE_APP_NEWS_API_URL` | URL base da API de noticias | Build ou container |
| `VITE_APP_CHATWOOT_BASE_URL` | URL base do Chatwoot | Build ou container |
| `VITE_APP_CHATWOOT_INBOX_IDENTIFIER` | Identificador da inbox do Chatwoot | Build ou container |
| `VITE_APP_GOOGLE_CLIENT_ID` | Client ID do Google OAuth | Build ou container |

A resolucao usa a logica de placeholder: quando o valor ainda contem `VITE_`, a aplicacao le de `import.meta.env`; quando o valor ja foi substituido, o valor injetado e usado diretamente.

### Wrappers Tipados

O arquivo exporta cinco funções wrapper que encapsulam os métodos HTTP do axios, todas retornando `Promise<ApiResponse<R>>`:

```typescript
const get = <R = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<R>> => {
  return client.get<ApiResponse<R>>(url, config).then(response => response.data);
};

const post = <R = any, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<ApiResponse<R>> => {
  return client.post<ApiResponse<R>>(url, data, config).then(response => response.data);
};

const put = <R = any, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<ApiResponse<R>> => {
  return client.put<ApiResponse<R>>(url, data, config).then(response => response.data);
};

const patch = <R = any, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<ApiResponse<R>> => {
  return client.patch<ApiResponse<R>>(url, data, config).then(response => response.data);
};

const destroy = <R = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<R>> => {
  return client.delete<ApiResponse<R>>(url, config).then(response => response.data);
};
```

| Wrapper   | Método HTTP | Aceita Body | Uso Típico                  |
|-----------|-------------|-------------|-----------------------------|
| `get`     | GET         | Não         | Listagens, detalhes         |
| `post`    | POST        | Sim         | Criação de recursos         |
| `put`     | PUT         | Sim         | Atualização completa        |
| `patch`   | PATCH       | Sim         | Atualização parcial         |
| `destroy` | DELETE      | Não         | Remoção de recursos         |

### Tipo ApiResponse

Todas as respostas da API seguem a interface `ApiResponse<T>` definida em `src/api/core/_models.ts`:

```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  status: number;
  message?: string;
  data: T;
  length: number;
  error?: Array<FieldError>;
}

export interface FieldError {
  field: string;
  message: string;
}
```

## Interceptors

Os interceptors são configurados pela função `setupAxios()` e gerenciam autenticação, tratamento de erros e fluxo de respostas especiais automaticamente.

### Request Interceptor

Adiciona o header `Authorization` com o token do usuário autenticado em todas as requisições, exceto refresh token:

```typescript
const onRequest = (config: CustomAxiosRequestConfig): CustomAxiosRequestConfig => {
  const auth = getAuth();
  if (auth?.token && !config.url?.includes('refreshtoken')) {
    config.headers.Authorization = auth.type + ' ' + auth.token;
  }
  return config;
};
```

O formato do header é `{type} {token}`, onde `type` é tipicamente `"Bearer"`.

### Validação de expiração do token

O módulo de API usa `jwt-decode` para inspecionar o claim `exp` do token e identificar proximidade de expiração antes de disparar chamadas que dependem de credenciais válidas.

```typescript
const isExpiring = (token: string): boolean => {
  try {
    return (jwtDecode(token).exp ?? Infinity) * 1000 < Date.now() + 10_000;
  } catch {
    return true;
  }
};

const getFreshToken = async (): Promise<string | undefined> => {
  const auth = getAuth();
  if (!auth?.refresh_token || !isExpiring(auth.token)) return auth?.token;
  return (await getRefreshedAuth(auth.refresh_token)).token;
};
```

Essa leitura considera uma margem de 10 segundos para tolerar variações de relógio entre cliente e servidor.


### Response Interceptor

Trata respostas com `success: false`, renova o token quando recebe status 401 e libera respostas binárias ou de streaming sem validar o envelope da API.

O fluxo de renovacao usa uma promessa compartilhada em memoria para centralizar requisicoes concorrentes de refresh. A funcao auxiliar `getRefreshedAuth(refreshTokenValue)` guarda a operacao em `refreshPromise`, faz a chamada para `refreshToken`, persiste o novo `AuthModel` com `setAuth()` e libera a promise ao finalizar.

```typescript
let refreshPromise: Promise<AuthModel> | null = null;

const getRefreshedAuth = (refreshTokenValue: string): Promise<AuthModel> => {
    if (!refreshPromise) {
        refreshPromise = refreshToken(refreshTokenValue)
            .then(rs => {
                setAuth(rs.data)
                return rs.data
            })
            .finally(() => {
                refreshPromise = null
            })
    }
    return refreshPromise
}
```

O interceptor de resposta utiliza esse fluxo para reenviar a requisicao original com o novo token:

```typescript
const onResponse = async (response: AxiosResponse<ApiResponse>): Promise<AxiosResponse<any, any>> => {
  const responseType = response.config?.responseType;
  if (responseType === 'stream' && String(response.headers['content-type'] ?? '').includes('application/json')) {
    response.data = (await new Response(response.data as unknown as ReadableStream).json()) as ApiResponse;
  } else if (responseType === 'blob' || responseType === 'arraybuffer' || responseType === 'stream') {
    return Promise.resolve(response);
  }

  if (!response.data.success) {
    const originalRequest = response.config as CustomAxiosRequestConfig;
    const auth = getAuth();
    const errorResult = new ApiResponseError(response.data);
    if (errorResult.status === 401 && auth?.refresh_token && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newAuth = await getRefreshedAuth(auth.refresh_token);
        originalRequest.headers['Authorization'] = 'Bearer ' + newAuth.token;
        return client(originalRequest);
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.data) {
          return Promise.reject(error.response.data);
        }
        removeAuth();
        return Promise.reject(error);
      }
    }
    return Promise.reject(errorResult);
  }
  return Promise.resolve(response);
};
```

O fluxo também contempla respostas binárias e streaming:

- `blob`
- `arraybuffer`
- `stream`

Para essas respostas, o interceptor preserva o payload bruto e não aplica a validação do envelope `ApiResponse<T>`. Em endpoints `stream`, quando o servidor devolve JSON no lugar do stream, o conteúdo é convertido e tratado como resposta da API.

**Fluxo de refresh:**

1. Requisicao retorna `success: false` com status 401
2. Se existe `refresh_token` e a requisicao nao e uma retry, a renovacao e solicitada
3. Requisicoes concorrentes compartilham a mesma promise de refresh
4. Em caso de sucesso, a autenticacao e atualizada e a requisicao original e reenviada
5. Em caso de falha no refresh, o payload de erro HTTP e rejeitado quando disponivel; caso contrario, a autenticacao e removida e a promise e rejeitada

**Fluxo de respostas binárias e streaming:**

1. A requisição define `responseType` como `blob`, `arraybuffer` ou `stream`
2. Respostas de stream com `content-type` JSON são lidas como `ApiResponse` e seguem o tratamento de erro e refresh
3. Nos demais casos, o interceptor retorna a resposta sem interpretar `response.data.success`
4. O consumidor recebe os dados crus e processa o conteúdo conforme o tipo esperado

### Mapeamento de erros HTTP

O arquivo `src/api/core/axiosErrorMapper.ts` traduz erros da API para mensagens amigáveis de interface. O status `403` usa a mensagem consistente exibida ao usuário final quando o acesso ao recurso não está disponível.

| Status | Título | Mensagem padrão |
|--------|--------|-----------------|
| 403 | Acesso negado | Você não tem permissão para acessar este recurso. Peça acesso ao administrador. |

## Padrao de Endpoints

Cada domínio do ERP possui um arquivo `{Domain}Endpoints.ts` em `src/api/endpoints/` que exporta um objeto constante com todos os paths daquele domínio. O padrão segue duas convenções:

- **Paths estáticos**: propriedades string para rotas sem parâmetros (listagens, criação)
- **Paths dinâmicos**: arrow functions que recebem parâmetros e retornam a string do path

### Exemplo: ProductEndpoints

```typescript
export const ProductEndpoints = {
  edit: (id: string) => `/catalog/product/edit/${id}`,
  toggleStatus: (id: string) => `/catalog/product/status/${id}`,
  list: "/catalog/product/list",
  add: "/catalog/product/add",
  searchByGtinEan: (gtinEan: string) => `/catalog/product/lookup/${gtinEan}`,
  delete: (id: string) => `/catalog/product/del/${id}`,
  details: (id: string) => `/catalog/product/${id}`,
  listByGtin: '/catalog/product/list-gtin',
  listBatch: '/catalog/product/list/batch',
  listBySku: '/catalog/product/list-sku',
  deleteBatch: '/catalog/product/del-batch',
  toggleStatusBatch: '/catalog/product/status-batch',
  addBatch: '/catalog/product/add-batch',
};
```

### Convenções Comuns

| Propriedade         | Tipo   | Descricao                               |
|--------------------|--------|------------------------------------------|
| `list`             | string | Listagem paginada do recurso             |
| `add`              | string | Criacao de novo recurso                  |
| `edit(id)`         | funcao | Atualizacao de recurso por ID            |
| `details(id)`      | funcao | Detalhes de recurso por ID               |
| `delete(id)`       | funcao | Remocao de recurso por ID                |
| `toggleStatus(id)`  | funcao | Ativar/desativar recurso por ID          |
| `deleteBatch`       | string | Remocao em lote                          |
| `toggleStatusBatch` | string | Ativar/desativar em lote                 |

### Rotas de Navegacao

O arquivo `src/api/core/links.ts` centraliza as rotas usadas na interface e na navegacao interna do ERP. Ele agrupa URLs por dominio e expõe constantes para telas de listagem, detalhe, edicao e configuracao.

#### Paginas de CRM e Feedback

| Constante | Valor | Descricao |
|-----------|-------|-----------|
| `CLIENT_FEEDBACK_PAGE_URL` | `/crm/pesquisa-satisfacao` | Tela principal de pesquisa de satisfacao |
| `CLIENT_FEEDBACK_LIST_PAGE_URL` | `/crm/pesquisa-satisfacao/lista` | Listagem de pesquisas de satisfacao |
| `CLIENT_FEEDBACK_NEW_PAGE_URL` | `/crm/pesquisa-satisfacao/lista/novo` | Cadastro de pesquisa de satisfacao |
| `CLIENT_FEEDBACK_EDIT_PAGE_URL(id)` | `/crm/pesquisa-satisfacao/lista/edita/{id}` | Edicao de pesquisa de satisfacao |

#### Configuracoes de Preferencias

| Constante | Valor | Descricao |
|-----------|-------|-----------|
| `TAX_SCENARIO_SETTINGS_PAGE_URL` | `/preferencias/cenario-fiscal` | Tela de configuracao de cenario fiscal |
| `PAYMENT_GATEWAYS_LIST_PAGE_URL` | `/preferencias/financas/gateways-pagamento/lista` | Listagem de gateways de pagamento |

## Catalogo de Endpoints

O catálogo documentado reúne **100 arquivos de endpoints** organizados em 11 domínios. A seguir, as propriedades de cada arquivo.

### Auth (1 arquivo)

| Arquivo | Propriedade | Path | Descrição |
|---------|-------------|------|-----------|
| AuthEndpoints | `login` | `/auth/login` | Login do usuário |
| AuthEndpoints | `logout` | `/auth/logout` | Logout do usuário |
| AuthEndpoints | `refreshToken` | `/auth/refresh-token` | Renovação de token |
| AuthEndpoints | `forgotPassword` | `/auth/forgot-password` | Recuperação de senha |
| AuthEndpoints | `resetPassword` | `/auth/reset-password` | Redefinição de senha |
| AuthEndpoints | `googleLogin` | `/auth/google` | Login via Google |

### Conta/Usuarios (5 arquivos)

| Arquivo | Propriedade | Path | Descrição |
|---------|-------------|------|-----------|
| AccountEndpoints | `save` | `/account/save` | Salvar dados da conta |
| AccountEndpoints | `changePassword` | `/account/change-password` | Alterar senha |
| AccountEndpoints | `changeEmail` | `/account/change-email` | Alterar e-mail |
| AccountEndpoints | `details` | `/account/details` | Detalhes da conta |
| AccountEndpoints | `notificationsPreferencesAvailableList` | `/account/notification-preferences/available/list` | Preferências de notificação disponíveis |
| AccountEndpoints | `notificationsPreferencesDisabledList` | `/account/notification-preferences/disabled/list` | Preferências de notificação desabilitadas |
| AccountEndpoints | `notificationsPreferencesDisabledSave` | `/account/notification-preferences/disabled/save` | Salvar preferências de notificação desabilitadas |
| AccountEndpoints | `loginSessionList` | `/account/sessions` | Listar sessões de login |
| AccountEndpoints | `loginSessionExport` | `/account/sessions/export` | Exportar sessões de login |
| AccountEndpoints | `notificationList` | `/account/notifications` | Listar notificações da conta |
| AccountEndpoints | `linkGoogleAccount` | `/account/google-account` | Vincular conta Google |
| AccountEndpoints | `unlinkGoogleAccount` | `/account/google-account` | Desvincular conta Google |
| AccountEndpoints | `permissionsAvailableList` | `/account/permissions/available/list` | Listar permissões disponíveis |
| AccountantManagementEndpoints | `listAccess` | `/accountant-management/access/list` | Listar acessos do contador |
| AccountantManagementEndpoints | `dashboardMetrics` | `/accountant-management/dashboard/invoice/metrics` | Métricas do dashboard do contador |
| AccountantManagementEndpoints | `listInvoices` | `/accountant-management/dashboard/invoice/list` | Listar notas fiscais |
| AccountantManagementEndpoints | `generateInvoicesPdf` | `/accountant-management/dashboard/invoice/generate/pdf` | Gerar PDF de notas fiscais |
| AccountantManagementEndpoints | `generateSpedFiscal` | `/accountant-management/dashboard/invoice/generate/sped-fiscal` | Gerar SPED Fiscal |
| AccountantManagementEndpoints | `toggleAccessStatus(id)` | `/accountant-management/access/status/{id}` | Ativar/desativar acesso do contador |
| AccountantManagementEndpoints | `removeAccess(id)` | `/accountant-management/access/del/{id}` | Remover acesso do contador |
| AccountantManagementEndpoints | `changePassword(id)` | `/accountant-management/access/change-password/{id}` | Alterar senha do contador |
| ManagerManagementEndpoints | `listCommunities` | `/manager-management/communities/list` | Listar comunidades do gestor |
| ManagerManagementEndpoints | `listPointsOfSale` | `/manager-management/pos/list` | Listar pontos de venda |
| ManagerManagementEndpoints | `dashboardMetrics` | `/manager-management/dashboard/metrics` | Métricas do dashboard do gestor |
| ManagerManagementEndpoints | `dashboardChart` | `/manager-management/dashboard/chart` | Gráfico do dashboard do gestor |
| ManagerManagementEndpoints | `listBillsToPay` | `/manager-management/dashboard/bills-to-pay/list` | Listar contas a pagar |
| ManagerManagementEndpoints | `listBillsToReceive` | `/manager-management/dashboard/bills-to-receive/list` | Listar contas a receber |
| ManagerManagementEndpoints | `uploadPaymentDoc(installmentId)` | `/manager-management/installment/{installmentId}/upload` | Upload de comprovante de pagamento |
| ManagerManagementEndpoints | `installmentDetails(installmentId)` | `/manager-management/installment/{installmentId}/details` | Detalhes da parcela |
| ManagerManagementEndpoints | `exportReport` | `/manager-management/dashboard/export` | Exportar relatório |
| InvitationEndpoints | `list` | `/invitation/list` | Listar convites |
| InvitationEndpoints | `find(id)` | `/invitation/{id}` | Buscar convite por ID |
| InvitationEndpoints | `add` | `/invitation/add` | Criar convite |
| InvitationEndpoints | `resend(id)` | `/invitation/resend/{id}` | Reenviar convite |
| InvitationEndpoints | `cancel(id)` | `/invitation/cancel/{id}` | Cancelar convite |
| InvitationEndpoints | `delete(id)` | `/invitation/del/{id}` | Excluir convite |
| InvitationEndpoints | `validate(inviteId)` | `/public/invitations/{inviteId}` | Validar convite (público) |
| InvitationEndpoints | `accept(inviteId)` | `/public/invitations/accept/{inviteId}` | Aceitar convite (público) |
| UserRoleEndpoints | `list` | `/preferences/user-role/list` | Listar perfis de usuário |
| UserRoleEndpoints | `add` | `/preferences/user-role/add` | Criar perfil de usuário |
| UserRoleEndpoints | `edit(id)` | `/preferences/user-role/edit/{id}` | Editar perfil de usuário |
| UserRoleEndpoints | `details(id)` | `/preferences/user-role/{id}` | Detalhes do perfil |
| UserRoleEndpoints | `delete(id)` | `/preferences/user-role/del/{id}` | Excluir perfil de usuário |
| UserRoleEndpoints | `deleteBatch` | `/preferences/user-role/del/batch` | Excluir perfis em lote |

### Catalogo (5 arquivos)

| Arquivo | Propriedade | Path | Descrição |
|---------|-------------|------|-----------|
| ProductEndpoints | `list` | `/catalog/product/list` | Listar produtos |
| ProductEndpoints | `add` | `/catalog/product/add` | Adicionar produto |
| ProductEndpoints | `edit(id)` | `/catalog/product/edit/{id}` | Editar produto |
| ProductEndpoints | `details(id)` | `/catalog/product/{id}` | Detalhes do produto |
| ProductEndpoints | `delete(id)` | `/catalog/product/del/{id}` | Excluir produto |
| ProductEndpoints | `toggleStatus(id)` | `/catalog/product/status/{id}` | Ativar/desativar produto |
| ProductEndpoints | `searchByGtinEan(gtinEan)` | `/catalog/product/lookup/{gtinEan}` | Buscar produto por GTIN/EAN |
| ProductEndpoints | `listByGtin` | `/catalog/product/list-gtin` | Listar produtos por GTIN |
| ProductEndpoints | `listBatch` | `/catalog/product/list/batch` | Listar produtos em lote |
| ProductEndpoints | `listBySku` | `/catalog/product/list-sku` | Listar produtos por SKU |
| ProductEndpoints | `deleteBatch` | `/catalog/product/del-batch` | Excluir produtos em lote |
| ProductEndpoints | `toggleStatusBatch` | `/catalog/product/status-batch` | Ativar/desativar em lote |
| ProductEndpoints | `addBatch` | `/catalog/product/add-batch` | Adicionar produtos em lote |
| CategoryEndpoints | `list` | `/catalog/category/list` | Listar categorias |
| CategoryEndpoints | `add` | `/catalog/category/add` | Adicionar categoria |
| CategoryEndpoints | `edit(id)` | `/catalog/category/edit/{id}` | Editar categoria |
| CategoryEndpoints | `details(id)` | `/catalog/category/{id}` | Detalhes da categoria |
| CategoryEndpoints | `delete(id)` | `/catalog/category/del/{id}` | Excluir categoria |
| CategoryEndpoints | `toggleStatus(id)` | `/catalog/category/status/{id}` | Ativar/desativar categoria |
| CategoryEndpoints | `parentChange(id)` | `/catalog/category/parent/{id}` | Alterar categoria pai |
| CategoryEndpoints | `deleteBatch` | `/catalog/category/del-batch` | Excluir categorias em lote |
| CategoryEndpoints | `toggleStatusBatch` | `/catalog/category/status-batch` | Ativar/desativar em lote |
| BrandsEndpoints | `list` | `/preferences/brand/list` | Listar marcas |
| BrandsEndpoints | `add` | `/preferences/brand/add` | Adicionar marca |
| BrandsEndpoints | `edit(id)` | `/preferences/brand/edit/{id}` | Editar marca |
| BrandsEndpoints | `details(id)` | `/preferences/brand/{id}` | Detalhes da marca |
| BrandsEndpoints | `delete(id)` | `/preferences/brand/del/{id}` | Excluir marca |
| BrandsEndpoints | `toggleStatus(id)` | `/preferences/brand/status/{id}` | Ativar/desativar marca |
| BrandsEndpoints | `deleteBatch` | `/preferences/brand/del/batch` | Excluir marcas em lote |
| BrandsEndpoints | `toggleStatusBatch` | `/preferences/brand/status/batch` | Ativar/desativar em lote |
| PriceListEndpoints | `list` | `/catalog/price-list/list` | Listar listas de preço |
| PriceListEndpoints | `add` | `/catalog/price-list/add` | Adicionar lista de preço |
| PriceListEndpoints | `edit(id)` | `/catalog/price-list/edit/{id}` | Editar lista de preço |
| PriceListEndpoints | `details(id)` | `/catalog/price-list/{id}` | Detalhes da lista de preço |
| PriceListEndpoints | `delete(id)` | `/catalog/price-list/del/{id}` | Excluir lista de preço |
| PriceListEndpoints | `toggleStatus(id)` | `/catalog/price-list/status/{id}` | Ativar/desativar lista de preço |
| PriceListEndpoints | `deleteBatch` | `/catalog/price-list/del-batch` | Excluir em lote |
| PriceListEndpoints | `toggleStatusBatch` | `/catalog/price-list/status-batch` | Ativar/desativar em lote |
| ConversionUnitEndpoints | `list` | `/preferences/conversion-unit/list` | Listar unidades de conversão |
| ConversionUnitEndpoints | `add` | `/preferences/conversion-unit/add` | Adicionar unidade de conversão |
| ConversionUnitEndpoints | `edit(id)` | `/preferences/conversion-unit/edit/{id}` | Editar unidade de conversão |
| ConversionUnitEndpoints | `details(id)` | `/preferences/conversion-unit/{id}` | Detalhes da unidade |
| ConversionUnitEndpoints | `delete(id)` | `/preferences/conversion-unit/del/{id}` | Excluir unidade de conversão |
| ConversionUnitEndpoints | `toggleStatus(id)` | `/preferences/conversion-unit/status/{id}` | Ativar/desativar unidade |
| ConversionUnitEndpoints | `deleteBatch` | `/preferences/conversion-unit/del/batch` | Excluir em lote |
| ConversionUnitEndpoints | `toggleStatusBatch` | `/preferences/conversion-unit/status/batch` | Ativar/desativar em lote |

### Vendas (8 arquivos)

| Arquivo | Propriedade | Path | Descrição |
|---------|-------------|------|-----------|
| SaleOrderEndpoints | `list` | `/sales/sale-order/list` | Listar pedidos de venda |
| SaleOrderEndpoints | `add` | `/sales/sale-order/add` | Criar pedido de venda |
| SaleOrderEndpoints | `edit(id)` | `/sales/sale-order/edit/{id}` | Editar pedido de venda |
| SaleOrderEndpoints | `details(id)` | `/sales/sale-order/{id}` | Detalhes do pedido |
| SaleOrderEndpoints | `delete(id)` | `/sales/sale-order/del/{id}` | Excluir pedido |
| SaleOrderEndpoints | `cancel(id)` | `/sales/sale-order/{id}/cancel` | Cancelar pedido |
| SaleOrderEndpoints | `changeStatus(id)` | `/sales/sale-order/{id}/change-status` | Alterar status do pedido |
| SaleOrderEndpoints | `nextSequenceNumber` | `/sales/sale-order/next-sequence` | Próximo número sequencial |
| SaleOrderConfigEndpoints | `edit` | `/preferences/config/sale-order` | Editar configuração de pedidos |
| SaleOrderConfigEndpoints | `details` | `/preferences/config/sale-order` | Detalhes da configuração |
| SalesOrderReportEndpoints | `generateReport` | `/sales/reports/general` | Gerar relatório geral de pedidos |
| SalesReportEndpoints | `financeReport` | `/sales/reports/finance` | Relatório financeiro de vendas |
| SalesReportEndpoints | `cashierReport` | `/sales/reports/cashier` | Relatório de caixa |
| SalesReportEndpoints | `transactions` | `/sales/reports/transactions` | Relatório de transações |
| SalesReportEndpoints | `invoiceProductQuery` | `/sales/reports/invoice/product-query` | Consulta de produtos por nota |
| SalesReportEndpoints | `invoiceOperation` | `/sales/reports/invoice/operation` | Relatorio de operacoes fiscais |
| SalesReportEndpoints | `invoiceCustomer` | `/sales/reports/invoice/customer` | Relatorio por cliente |
| SalesReportEndpoints | `invoiceProduct` | `/sales/reports/invoice/product` | Relatorio por produto |
| SalesReportEndpoints | `invoiceProgress` | `/sales/reports/invoice/progress` | Relatorio de progresso fiscal |
| SalesReportEndpoints | `invoiceIcms` | `/sales/reports/invoice/icms` | Relatorio de ICMS |
| SalesOccurrenceEndpoints | `list` | `/sales/occurrence/list` | Listar ocorrencias de venda |
| SalesOccurrenceEndpoints | `add` | `/sales/occurrence/add` | Criar ocorrencia de venda |
| SalesOccurrenceEndpoints | `edit(id)` | `/sales/occurrence/edit/{id}` | Editar ocorrencia de venda |
| SalesOccurrenceEndpoints | `details(id)` | `/sales/occurrence/{id}` | Detalhes da ocorrencia |
| SalesOccurrenceEndpoints | `changeStatus(id)` | `/sales/occurrence/{id}/status` | Alterar status da ocorrencia |
| SalesOccurrenceEndpoints | `delete(id)` | `/sales/occurrence/{id}` | Excluir ocorrencia |
| SalesOccurrenceEndpoints | `addEvidence(id)` | `/sales/occurrence/{id}/evidence/add` | Adicionar evidencia |
| SalesOccurrenceEndpoints | `addItem(id)` | `/sales/occurrence/{id}/item/add` | Adicionar item |
| SalesOccurrenceEndpoints | `addComment(id)` | `/sales/occurrence/{id}/comment/add` | Adicionar comentario |
| SalesOccurrenceEndpoints | `updateEvidence(id, evidenceId)` | `/sales/occurrence/{id}/evidence/{evidenceId}` | Atualizar evidencia |
| SalesOccurrenceEndpoints | `deleteEvidence(id, evidenceId)` | `/sales/occurrence/{id}/evidence/{evidenceId}` | Excluir evidencia |
| SalesOccurrenceEndpoints | `updateItem(id, itemId)` | `/sales/occurrence/{id}/item/{itemId}` | Atualizar item |
| SalesOccurrenceEndpoints | `deleteItem(id, itemId)` | `/sales/occurrence/{id}/item/{itemId}` | Excluir item |
| PlanogramEndpoints | `list` | `/sales/planogram/list` | Listar planogramas |
| PlanogramEndpoints | `add` | `/sales/planogram/add` | Criar planograma |
| PlanogramEndpoints | `details(id)` | `/sales/planogram/{id}` | Detalhes do planograma |
| PlanogramEndpoints | `delete(id)` | `/sales/planogram/del/{id}` | Excluir planograma |
| PlanogramEndpoints | `finishDraft(id)` | `/sales/planogram/finish-draft/{id}` | Finalizar rascunho |
| PlanogramEndpoints | `activate(id)` | `/sales/planogram/activate/{id}` | Ativar planograma |
| PlanogramEndpoints | `itemList(planogramId)` | `/sales/planogram/{planogramId}/item/list` | Listar itens do planograma |
| PlanogramEndpoints | `addItem(planogramId)` | `/sales/planogram/{planogramId}/add-item` | Adicionar item ao planograma |
| PlanogramEndpoints | `editItem(id)` | `/sales/planogram/edit-item/{id}` | Editar item do planograma |
| PlanogramEndpoints | `editItemsBatch` | `/sales/planogram/edit-items-batch` | Editar itens em lote |
| PlanogramEndpoints | `deleteItem(id)` | `/sales/planogram/del-item/{id}` | Excluir item do planograma |
| PlanogramEndpoints | `itemDetails(id)` | `/sales/planogram/item/{id}` | Detalhes do item |
| PlanogramEndpoints | `productPlanogramSummary(productId)` | `/sales/planogram/product-summary/{productId}` | Resumo do produto no planograma |
| PromotionEndpoints | `list` | `/sales/promotion/list` | Listar promoções |
| PromotionEndpoints | `add` | `/sales/promotion/add` | Criar promoção |
| PromotionEndpoints | `edit(id)` | `/sales/promotion/edit/{id}` | Editar promoção |
| PromotionEndpoints | `details(id)` | `/sales/promotion/{id}` | Detalhes da promoção |
| PromotionEndpoints | `delete(id)` | `/sales/promotion/del/{id}` | Excluir promoção |
| PromotionEndpoints | `toggleStatus(id)` | `/sales/promotion/status/{id}` | Ativar/desativar promoção |
| CouponListEndpoints | `list` | `/sales/coupon/list` | Listar cupons |
| CouponListEndpoints | `add` | `/sales/coupon/add` | Criar cupom |
| CouponListEndpoints | `edit(id)` | `/sales/coupon/edit/{id}` | Editar cupom |
| CouponListEndpoints | `details(id)` | `/sales/coupon/{id}` | Detalhes do cupom |
| CouponListEndpoints | `delete(id)` | `/sales/coupon/del/{id}` | Excluir cupom |
| CouponListEndpoints | `toggleStatus(id)` | `/sales/coupon/status/{id}` | Ativar/desativar cupom |
| CouponListEndpoints | `usage(id)` | `/sales/coupon/usage/{id}` | Uso do cupom |

### Financeiro (14 arquivos)

| Arquivo | Propriedade | Path | Descrição |
|---------|-------------|------|-----------|
| BillsToPayEndpoints | `list` | `/finance/bills-to-pay/list` | Listar contas a pagar |
| BillsToPayEndpoints | `add` | `/finance/bills-to-pay/add` | Adicionar conta a pagar |
| BillsToPayEndpoints | `edit(id)` | `/finance/bills-to-pay/edit/{id}` | Editar conta a pagar |
| BillsToPayEndpoints | `details(id)` | `/finance/bills-to-pay/{id}` | Detalhes da conta a pagar |
| BillsToPayEndpoints | `dueToday` | `/finance/bills-to-pay/due-today` | Contas vencendo hoje |
| BillsToPayEndpoints | `allToPay` | `/finance/bills-to-pay/all-to-pay` | Todas as contas pendentes |
| BillsToReceiveEndpoints | `list` | `/finance/bills-to-receive/list` | Listar contas a receber |
| BillsToReceiveEndpoints | `add` | `/finance/bills-to-receive/add` | Adicionar conta a receber |
| BillsToReceiveEndpoints | `edit(id)` | `/finance/bills-to-receive/edit/{id}` | Editar conta a receber |
| BillsToReceiveEndpoints | `details(id)` | `/finance/bills-to-receive/{id}` | Detalhes da conta a receber |
| BillsToReceiveEndpoints | `allToGet` | `/finance/bills-to-receive/all-to-get` | Todas as contas a receber pendentes |
| CashFlowEndpoints | `list` | `/finance/cash-flow/list` | Listar fluxo de caixa |
| CashFlowEndpoints | `edit(id)` | `/finance/cash-flow/edit/{id}` | Editar lançamento |
| CashFlowEndpoints | `details(id)` | `/finance/cash-flow/{id}` | Detalhes do lançamento |
| CashFlowEndpoints | `delete(id)` | `/finance/cash-flow/del/{id}` | Excluir lançamento |
| CashFlowEndpoints | `addCashFlowOut` | `/finance/cash-flow/out` | Lançamento de saída |
| CashFlowEndpoints | `addCashFlowIn` | `/finance/cash-flow/in` | Lançamento de entrada |
| CashFlowEndpoints | `addCashFlowBalance` | `/finance/cash-flow/balance` | Lançamento de saldo |
| CompetenceEndpoints | `list` | `/finance/competence/list` | Listar competências |
| CompetenceEndpoints | `details(id)` | `/finance/competence/{id}` | Detalhes da competência |
| CompetenceEndpoints | `delete(id)` | `/finance/competence/del/{id}` | Excluir competência |
| BankAccountEndpoints | `list` | `/preferences/bank-account/list` | Listar contas bancárias |
| BankAccountEndpoints | `add` | `/preferences/bank-account/add` | Adicionar conta bancária |
| BankAccountEndpoints | `edit(id)` | `/preferences/bank-account/edit/{id}` | Editar conta bancária |
| BankAccountEndpoints | `details(id)` | `/preferences/bank-account/{id}` | Detalhes da conta bancária |
| BankAccountEndpoints | `delete(id)` | `/preferences/bank-account/del/{id}` | Excluir conta bancária |
| BankAccountEndpoints | `toggleStatus(id)` | `/preferences/bank-account/status/{id}` | Ativar/desativar conta bancária |
| BankAccountEndpoints | `deleteBatch` | `/preferences/bank-account/del/batch` | Excluir em lote |
| BankAccountEndpoints | `toggleStatusBatch` | `/preferences/bank-account/status/batch` | Ativar/desativar em lote |
| BankEndpoints | `list` | `/preferences/bank/list` | Listar bancos |
| BankEndpoints | `add` | `/preferences/bank/add` | Adicionar banco |
| BankEndpoints | `edit(id)` | `/preferences/bank/edit/{id}` | Editar banco |
| BankEndpoints | `details(id)` | `/preferences/bank/{id}` | Detalhes do banco |
| BankEndpoints | `delete(id)` | `/preferences/bank/del/{id}` | Excluir banco |
| BankEndpoints | `toggleStatus(id)` | `/preferences/bank/status/{id}` | Ativar/desativar banco |
| BankEndpoints | `deleteBatch` | `/preferences/bank/del/batch` | Excluir em lote |
| BankEndpoints | `toggleStatusBatch` | `/preferences/bank/status/batch` | Ativar/desativar em lote |
| FinancialAccountEndpoints | `list` | `/preferences/financial-account/list` | Listar contas financeiras |
| FinancialAccountEndpoints | `add` | `/preferences/financial-account/add` | Adicionar conta financeira |
| FinancialAccountEndpoints | `edit(id)` | `/preferences/financial-account/edit/{id}` | Editar conta financeira |
| FinancialAccountEndpoints | `details(id)` | `/preferences/financial-account/{id}` | Detalhes da conta financeira |
| FinancialAccountEndpoints | `delete(id)` | `/preferences/financial-account/del/{id}` | Excluir conta financeira |
| FinancialAccountEndpoints | `toggleStatus(id)` | `/preferences/financial-account/status/{id}` | Ativar/desativar conta financeira |
| FinancialAccountEndpoints | `deleteBatch` | `/preferences/financial-account/del/batch` | Excluir em lote |
| FinancialAccountEndpoints | `toggleStatusBatch` | `/preferences/financial-account/status/batch` | Ativar/desativar em lote |
| FinancialAccountEndpoints | `setDefault(id)` | `/preferences/financial-account/default/{id}` | Definir conta padrão |
| FinancialCategoryGroupEndpoints | `list` | `/preferences/financial-category-group/list` | Listar grupos de categoria financeira |
| FinancialCategoryGroupEndpoints | `add` | `/preferences/financial-category-group/add` | Adicionar grupo |
| FinancialCategoryGroupEndpoints | `edit(id)` | `/preferences/financial-category-group/edit/{id}` | Editar grupo |
| FinancialCategoryGroupEndpoints | `details(id)` | `/preferences/financial-category-group/{id}` | Detalhes do grupo |
| FinancialCategoryGroupEndpoints | `delete(id)` | `/preferences/financial-category-group/del/{id}` | Excluir grupo |
| FinancialCategoryGroupEndpoints | `toggleStatus(id)` | `/preferences/financial-category-group/status/{id}` | Ativar/desativar grupo |
| FinancialCategoryGroupEndpoints | `deleteBatch` | `/preferences/financial-category-group/del/batch` | Excluir em lote |
| FinancialCategoryGroupEndpoints | `toggleStatusBatch` | `/preferences/financial-category-group/status/batch` | Ativar/desativar em lote |
| GatewayEndpoints | `list` | `/preferences/gateway/list` | Listar gateways de pagamento |
| GatewayEndpoints | `add` | `/preferences/gateway/add` | Adicionar gateway |
| GatewayEndpoints | `edit(id)` | `/preferences/gateway/edit/{id}` | Editar gateway |
| GatewayEndpoints | `details(id)` | `/preferences/gateway/{id}` | Detalhes do gateway |
| GatewayEndpoints | `delete(id)` | `/preferences/gateway/del/{id}` | Excluir gateway |
| GatewayEndpoints | `toggleStatus(id)` | `/preferences/gateway/status/{id}` | Ativar/desativar gateway |
| GatewayEndpoints | `deleteBatch` | `/preferences/gateway/del/batch` | Excluir em lote |
| GatewayEndpoints | `toggleStatusBatch` | `/preferences/gateway/status/batch` | Ativar/desativar em lote |
| GatewayEndpoints | `listGatewayServices` | `/preferences/gateway/service/list` | Listar serviços de gateway |
| GatewayEndpoints | `testConnection(id)` | `/preferences/gateway/test-connection/{id}` | Testar conexão do gateway |
| InstallmentEndpoints | `edit(id)` | `/finance/installment/edit/{id}` | Editar parcela |
| InstallmentEndpoints | `details(id)` | `/finance/installment/{id}` | Detalhes da parcela |
| InstallmentEndpoints | `delete(id)` | `/finance/installment/del/{id}` | Excluir parcela |
| InstallmentEndpoints | `cancel` | `/finance/installment/cancel` | Cancelar parcela |
| PaymentEndpoints | `list` | `/finance/payment/list` | Listar pagamentos |
| PaymentEndpoints | `edit(id)` | `/finance/payment/edit/{id}` | Editar pagamento |
| PaymentEndpoints | `details(id)` | `/finance/payment/{id}` | Detalhes do pagamento |
| PaymentEndpoints | `delete(id)` | `/finance/payment/del/{id}` | Excluir pagamento |
| PaymentEndpoints | `cancel(id)` | `/finance/payment/cancel/{id}` | Cancelar pagamento |
| PaymentEndpoints | `addInstallment(installmentId)` | `/finance/payment/add/{installmentId}` | Adicionar pagamento a parcela |
| PaymentMethodEndpoints | `list` | `/preferences/payment-method/list` | Listar métodos de pagamento |
| PaymentMethodEndpoints | `add` | `/preferences/payment-method/add` | Adicionar método de pagamento |
| PaymentMethodEndpoints | `edit(id)` | `/preferences/payment-method/edit/{id}` | Editar método de pagamento |
| PaymentMethodEndpoints | `details(id)` | `/preferences/payment-method/{id}` | Detalhes do método |
| PaymentMethodEndpoints | `delete(id)` | `/preferences/payment-method/del/{id}` | Excluir método de pagamento |
| PaymentMethodEndpoints | `toggleStatus(id)` | `/preferences/payment-method/status/{id}` | Ativar/desativar método |
| PaymentMethodEndpoints | `deleteBatch` | `/preferences/payment-method/del/batch` | Excluir em lote |
| PaymentMethodEndpoints | `toggleStatusBatch` | `/preferences/payment-method/status/batch` | Ativar/desativar em lote |
| ReceiptMethodEndpoints | `list` | `/preferences/receipt-method/list` | Listar métodos de recebimento |
| ReceiptMethodEndpoints | `add` | `/preferences/receipt-method/add` | Adicionar método de recebimento |
| ReceiptMethodEndpoints | `edit(id)` | `/preferences/receipt-method/edit/{id}` | Editar método de recebimento |
| ReceiptMethodEndpoints | `details(id)` | `/preferences/receipt-method/{id}` | Detalhes do método |
| ReceiptMethodEndpoints | `delete(id)` | `/preferences/receipt-method/del/{id}` | Excluir método de recebimento |
| ReceiptMethodEndpoints | `toggleStatus(id)` | `/preferences/receipt-method/status/{id}` | Ativar/desativar método |
| ReceiptMethodEndpoints | `deleteBatch` | `/preferences/receipt-method/del/batch` | Excluir em lote |
| ReceiptMethodEndpoints | `toggleStatusBatch` | `/preferences/receipt-method/status/batch` | Ativar/desativar em lote |
| FinanceReportEndpoints | `balanceSheet` | `/finance/reports/balance-sheet` | Relatório de balanço |
| FinanceReportEndpoints | `profitAndLoss` | `/finance/reports/profit-and-loss` | Relatório de lucros e perdas |
| FinanceReportEndpoints | `cashFlow` | `/finance/reports/cash-flow` | Relatório de fluxo de caixa |
| FinanceReportEndpoints | `byCategory` | `/finance/reports/by-category` | Relatório por categoria |
| FinanceReportEndpoints | `byCustomer` | `/finance/reports/by-customer` | Relatório por cliente |
| FinanceReportEndpoints | `payables` | `/finance/reports/payables` | Relatório de contas a pagar |
| FinanceReportEndpoints | `receivables` | `/finance/reports/receivables` | Relatório de contas a receber |
| FinanceReportEndpoints | `paymentsReceived` | `/finance/reports/payments-received` | Relatório de pagamentos recebidos |

### Suprimentos/Estoque (19 arquivos)

| Arquivo | Propriedade | Path | Descrição |
|---------|-------------|------|-----------|
| InventoryEndpoints | `list` | `/supply/inventory/transfer` | Listar transferências de estoque |
| InventoryEndpoints | `entries` | `/supply/inventory/entries` | Listar lançamentos de estoque |
| InventoryEndpoints | `addOutEntry` | `/supply/inventory/out` | Lançamento de saída |
| InventoryEndpoints | `addReceivingEntry` | `/supply/inventory/enter` | Lançamento de entrada |
| InventoryEndpoints | `addBalanceEntry` | `/supply/inventory/balance` | Lançamento de saldo |
| InventoryEndpoints | `addTransferEntry` | `/supply/inventory/transfer` | Transferência entre depósitos |
| InventoryEndpoints | `warehouseDetails(idWarehouse)` | `/supply/inventory/{idWarehouse}` | Detalhes do depósito |
| InventoryEndpoints | `productEntries(idProduct)` | `/supply/inventory/product/{idProduct}/entries` | Lançamentos do produto |
| InventoryEndpoints | `reverseBatch(sourceId)` | `/supply/inventory/reverse-batch/{sourceId}` | Reverter lote |
| InventoryEndpoints | `launchBatchOut` | `/supply/inventory/launch-batch-out` | Lançamento de saída em lote |
| InventoryEndpoints | `launchBatchIn` | `/supply/inventory/launch-batch-in` | Lançamento de entrada em lote |
| InventoryCheckEndpoints | `listTasks` | `/supply/task/inventory/list` | Listar tarefas de inventário |
| InventoryCheckEndpoints | `createTask` | `/supply/task/inventory/create` | Criar tarefa de inventário |
| InventoryCheckEndpoints | `getTask(taskId)` | `/supply/task/inventory/{taskId}` | Detalhes da tarefa |
| InventoryCheckEndpoints | `finishTask(taskId)` | `/supply/task/inventory/{taskId}/finish` | Finalizar tarefa |
| InventoryCheckEndpoints | `cancelTask(taskId)` | `/supply/task/inventory/{taskId}/cancel` | Cancelar tarefa |
| InventoryCheckEndpoints | `itemList(taskId)` | `/supply/task/inventory/{taskId}/item/list` | Listar itens da tarefa |
| InventoryCheckEndpoints | `addItem(taskId)` | `/supply/task/inventory/{taskId}/add` | Adicionar item à tarefa |
| InventoryCheckEndpoints | `editItem(taskId, itemId)` | `/supply/task/inventory/{taskId}/edit/{itemId}` | Editar item da tarefa |
| InventoryCheckEndpoints | `getItem(itemId)` | `/supply/task/inventory/item/{itemId}` | Detalhes do item |
| InventoryCheckEndpoints | `getHistory(taskId)` | `/supply/task/inventory/{taskId}/history` | Histórico da tarefa |
| InventoryConfigEndpoints | `edit` | `/preferences/config/inventory` | Editar configuração de estoque |
| InventoryConfigEndpoints | `details` | `/preferences/config/inventory` | Detalhes da configuração |
| InventoryReserveEndpoints | `listWarehouseReserves` | `supply/reserve/list` | Listar reservas de depósito |
| InventoryTaskEndpoints | `list` | `/supply/task/list` | Listar tarefas de estoque |
| InventoryTaskEndpoints | `getDetails(id)` | `/supply/task/{id}` | Detalhes da tarefa |
| InventoryTaskEndpoints | `itemList(taskId)` | `/supply/task/{taskId}/item/list` | Listar itens da tarefa |
| BuyOrderEndpoints | `list` | `/supply/buy-order/list` | Listar pedidos de compra |
| BuyOrderEndpoints | `add` | `/supply/buy-order/add` | Criar pedido de compra |
| BuyOrderEndpoints | `edit(id)` | `/supply/buy-order/edit/{id}` | Editar pedido de compra |
| BuyOrderEndpoints | `details(id)` | `/supply/buy-order/{id}` | Detalhes do pedido |
| BuyOrderEndpoints | `delete(id)` | `/supply/buy-order/del/{id}` | Excluir pedido |
| BuyOrderEndpoints | `cancel(id)` | `/supply/buy-order/{id}/cancel` | Cancelar pedido |
| BuyOrderEndpoints | `changeStatus(id)` | `/supply/buy-order/{id}/change-status` | Alterar status |
| BuyOrderEndpoints | `nextSequenceNumber` | `/supply/buy-order/next-sequence` | Próximo número sequencial |
| BuyOrderEndpoints | `approveBatch` | `/supply/buy-order/approve-batch` | Aprovar pedidos em lote |
| BuyOrderEndpoints | `cancelBatch` | `/supply/buy-order/cancel-batch` | Cancelar pedidos em lote |
| BuyOrderConfigEndpoints | `edit` | `/preferences/config/buy-order` | Editar configuração de compras |
| BuyOrderConfigEndpoints | `details` | `/preferences/config/buy-order` | Detalhes da configuração |
| PicklistEndpoints | `list` | `/supply/pick-list/list` | Listar picklists |
| PicklistEndpoints | `add` | `/supply/pick-list/add` | Criar picklist |
| PicklistEndpoints | `getPicklist(id)` | `/supply/pick-list/{id}` | Detalhes da picklist |
| PicklistEndpoints | `delete(id)` | `/supply/pick-list/del/{id}` | Excluir picklist |
| PicklistEndpoints | `deleteBatch` | `/supply/pick-list/del/batch` | Excluir em lote |
| PicklistEndpoints | `editDescription(id)` | `/supply/pick-list/edit-description/{id}` | Editar descrição |
| PicklistEndpoints | `itemList(picklistId)` | `/supply/pick-list/{picklistId}/item/list` | Listar itens da picklist |
| PicklistEndpoints | `addItem(picklistId)` | `/supply/pick-list/{picklistId}/add-item` | Adicionar item |
| PicklistEndpoints | `editItem(itemId)` | `/supply/pick-list/edit-item/{itemId}` | Editar item |
| PicklistEndpoints | `getPicklistItem(id)` | `/supply/pick-list/item/{id}` | Detalhes do item |
| PicklistEndpoints | `deleteItem(itemId)` | `/supply/pick-list/del-item/{itemId}` | Excluir item |
| WarehouseEndpoints | `list` | `/preferences/warehouse/list` | Listar depósitos |
| WarehouseEndpoints | `add` | `/preferences/warehouse/add` | Adicionar depósito |
| WarehouseEndpoints | `edit(id)` | `/preferences/warehouse/edit/{id}` | Editar depósito |
| WarehouseEndpoints | `details(id)` | `/preferences/warehouse/{id}` | Detalhes do depósito |
| WarehouseEndpoints | `delete(id)` | `/preferences/warehouse/del/{id}` | Excluir depósito |
| WarehouseEndpoints | `toggleStatus(id)` | `/preferences/warehouse/status/{id}` | Ativar/desativar depósito |
| WarehouseEndpoints | `deleteBatch` | `/preferences/warehouse/del/batch` | Excluir em lote |
| WarehouseEndpoints | `toggleStatusBatch` | `/preferences/warehouse/status/batch` | Ativar/desativar em lote |
| WarehouseBatchEndpoints | `list` | `/supply/batch/list` | Listar lotes |
| WarehouseBatchEndpoints | `add` | `/supply/batch/add` | Adicionar lote |
| WarehouseBatchEndpoints | `edit(id)` | `/supply/batch/edit/{id}` | Editar lote |
| WarehouseBatchEndpoints | `details(id)` | `/supply/batch/{id}` | Detalhes do lote |
| WarehouseBatchEndpoints | `delete(id)` | `/supply/batch/del/{id}` | Excluir lote |
| WarehouseBatchEndpoints | `deleteBatch` | `/supply/batch/del/batch` | Excluir em lote |
| WarehouseBatchEndpoints | `updateDatesBatch` | `/supply/batch/update-dates/batch` | Atualizar datas em lote |
| ProductInventoryControlEndpoints | `list` | `/supply/product-inventory/list` | Listar controle de estoque |
| ProductInventoryControlEndpoints | `edit(id)` | `/supply/product-inventory/edit/{id}` | Editar controle |
| ProductInventoryControlEndpoints | `getDetails(id)` | `/supply/product-inventory/{id}` | Detalhes do controle |
| ProductInventoryControlEndpoints | `productDetails` | `/supply/product-inventory/product-detail` | Detalhes do produto no estoque |
| ProductInventoryControlEndpoints | `alerts(productId)` | `/supply/product-inventory/{productId}/alerts` | Alertas do produto |
| ProductInventoryControlEndpoints | `movementHistory(productId)` | `/supply/product-inventory/{productId}/movement-history` | Histórico de movimentação |
| ProductLossReportEndpoints | `list` | `/supply/reports/product-loss/list` | Listar perdas de produto |
| ProductLossReportEndpoints | `listProduct(productId)` | `/supply/reports/product-loss/{productId}/list` | Perdas por produto |
| ProductLossReportEndpoints | `productLossDetails(productId)` | `/supply/reports/product-loss/{productId}` | Detalhes da perda |
| SeparationConfigEndpoints | `edit` | `/preferences/config/separation` | Editar configuração de separação |
| SeparationConfigEndpoints | `details` | `/preferences/config/separation` | Detalhes da configuração |
| SeparationTaskEndpoints | `list` | `/supply/task/separation/list` | Listar tarefas de separação |
| SeparationTaskEndpoints | `add(pickListId)` | `/supply/task/separation/add/{pickListId}` | Criar tarefa a partir de picklist |
| SeparationTaskEndpoints | `taskSeparationDetails(taskId)` | `/supply/task/separation/{taskId}` | Detalhes da tarefa |
| SeparationTaskEndpoints | `finish(separationId)` | `/supply/task/separation/{separationId}/finish` | Finalizar tarefa |
| SeparationTaskEndpoints | `cancel(separationId)` | `/supply/task/separation/{separationId}/cancel` | Cancelar tarefa |
| SeparationTaskEndpoints | `itemList(taskId)` | `/supply/task/separation/{taskId}/item/list` | Listar itens da tarefa |
| SeparationTaskEndpoints | `editItem(separationId, itemId)` | `/supply/task/separation/{separationId}/edit/{itemId}` | Editar item |
| SeparationTaskEndpoints | `taskSeparationHistory(taskId)` | `/supply/task/separation/{taskId}/history` | Histórico da tarefa |
| SeparationTaskEndpoints | `taskSeparationItemDetails(itemId)` | `/supply/task/separation/item/{itemId}` | Detalhes do item |
| SupplyTaskEndpoints | `list` | `/supply/task/supply/list` | Listar tarefas de abastecimento |
| SupplyTaskEndpoints | `add(pickListId)` | `/supply/task/supply/add/{pickListId}` | Criar tarefa a partir de picklist |
| SupplyTaskEndpoints | `taskSupplyDetails(taskId)` | `/supply/task/supply/{taskId}` | Detalhes da tarefa |
| SupplyTaskEndpoints | `finish(supplyId)` | `/supply/task/supply/{supplyId}/finish` | Finalizar tarefa |
| SupplyTaskEndpoints | `cancel(supplyId)` | `/supply/task/supply/{supplyId}/cancel` | Cancelar tarefa |
| SupplyTaskEndpoints | `itemList(taskId)` | `/supply/task/supply/{taskId}/item/list` | Listar itens da tarefa |
| SupplyTaskEndpoints | `editItem(supplyId, itemId)` | `/supply/task/supply/{supplyId}/edit/{itemId}` | Editar item |
| SupplyTaskEndpoints | `taskSupplyHistory(taskId)` | `/supply/task/supply/{taskId}/history` | Histórico da tarefa |
| SupplyTaskEndpoints | `taskSupplyItemDetails(itemId)` | `/supply/task/supply/item/{itemId}` | Detalhes do item |
| SupplyCheckTaskEndpoints | `list` | `/supply/task/supply-check/list` | Listar tarefas de conferência de abastecimento |
| SupplyCheckTaskEndpoints | `add(pickListId)` | `/supply/task/supply-check/add/{pickListId}` | Criar tarefa de conferência a partir de picklist |
| SupplyCheckTaskEndpoints | `taskSupplyDetails(taskId)` | `/supply/task/supply-check/{taskId}` | Detalhes da tarefa |
| SupplyCheckTaskEndpoints | `finish(supplyId)` | `/supply/task/supply-check/{supplyId}/finish` | Finalizar tarefa |
| SupplyCheckTaskEndpoints | `cancel(supplyId)` | `/supply/task/supply-check/{supplyId}/cancel` | Cancelar tarefa |
| SupplyCheckTaskEndpoints | `itemList(taskId)` | `/supply/task/supply-check/{taskId}/item/list` | Listar itens da tarefa |
| SupplyCheckTaskEndpoints | `editItem(supplyId, itemId)` | `/supply/task/supply-check/{supplyId}/edit/{itemId}` | Editar item |
| SupplyCheckTaskEndpoints | `taskSupplyHistory(taskId)` | `/supply/task/supply-check/{taskId}/history` | Historico da tarefa |
| SupplyCheckTaskEndpoints | `taskSupplyItemDetails(itemId)` | `/supply/task/supply-check/item/{itemId}` | Detalhes do item |
| SupplyReportEndpoints | `inventoryInOut` | `/supply/reports/inventory/in-out` | Relatorio de entradas e saidas |
| SupplyReportEndpoints | `inventoryBalance` | `/supply/reports/inventory/balance` | Relatorio de saldo |
| SupplyReportEndpoints | `inventoryBiggestMovement` | `/supply/reports/inventory/biggest-movement` | Maiores movimentacoes |
| SupplyReportEndpoints | `inventoryWithoutMovement` | `/supply/reports/inventory/without-movement` | Produtos sem movimentacao |
| SupplyReportEndpoints | `inventoryBelowMinimum` | `/supply/reports/inventory/below-minimum` | Estoque abaixo do minimo |
| SupplyReportEndpoints | `inventoryFinanceOverview` | `/supply/reports/inventory/finance-overview` | Visao financeira do estoque |
| SupplyReportEndpoints | `inventoryUsage` | `/supply/reports/inventory/usage` | Relatorio de uso do estoque |
| SupplyReportEndpoints | `nfeInOperation` | `/supply/reports/nfe-in/operation` | Relatorio de operacoes NF-e entrada |
| SupplyReportEndpoints | `nfeInSupplier` | `/supply/reports/nfe-in/supplier` | Relatorio por fornecedor |
| SupplyReportEndpoints | `nfeInProduct` | `/supply/reports/nfe-in/product` | Relatorio por produto |
| SupplyReportEndpoints | `nfeInProgress` | `/supply/reports/nfe-in/progress` | Progresso de NF-e entrada |
| SupplyReportEndpoints | `nfeInProductSupplier` | `/supply/reports/nfe-in/product-supplier` | Relatório produto-fornecedor |
| SupplyReportEndpoints | `buyOrder` | `/supply/reports/buy-order` | Relatório de pedidos de compra |
| SupplyReportEndpoints | `productLoss` | `/supply/reports/product-loss/list` | Relatório de perdas |
| SupplyReportEndpoints | `purchaseSuggestion` | `/supply/reports/purchase-suggestion` | Sugestão de compra |
| SupplyReportEndpoints | `costOfGoodsSold` | `/supply/reports/inventory/cost-of-goods-sold` | Relatório de custo da mercadoria vendida |
| SupplyReportEndpoints | `costOfGoodsSoldExport` | `/supply/reports/inventory/cost-of-goods-sold/export` | Exportação do custo da mercadoria vendida |
| SupplierContactEndpoints | `list` | `/registrations/supplier/list` | Listar fornecedores |
| SupplierContactEndpoints | `add` | `/registrations/supplier/add` | Adicionar fornecedor |
| SupplierContactEndpoints | `edit(id)` | `/registrations/supplier/edit/{id}` | Editar fornecedor |
| SupplierContactEndpoints | `details(id)` | `/registrations/supplier/{id}` | Detalhes do fornecedor |
| SupplierContactEndpoints | `delete(id)` | `/registrations/supplier/del/{id}` | Excluir fornecedor |
| SupplierContactEndpoints | `toggleStatus(id)` | `/registrations/supplier/status/{id}` | Ativar/desativar fornecedor |
| SupplierContactEndpoints | `deleteBatch` | `/registrations/supplier/del-batch` | Excluir em lote |
| SupplierContactEndpoints | `toggleStatusBatch` | `/registrations/supplier/status-batch` | Ativar/desativar em lote |
| GoodsReceiptEndpoints | `create(nfeInId)` | `/inventory/goods-receipt/create/{nfeInId}` | Criar recebimento de mercadorias a partir de NF-e de entrada |
| GoodsReceiptEndpoints | `updateItem(id, itemId)` | `/inventory/goods-receipt/{id}/items/{itemId}` | Atualizar item do recebimento |
| GoodsReceiptEndpoints | `checkAll(id)` | `/inventory/goods-receipt/{id}/check-all` | Conferir todos os itens |
| GoodsReceiptEndpoints | `finish(id)` | `/inventory/goods-receipt/{id}/finish` | Finalizar recebimento |
| GoodsReceiptEndpoints | `details(id)` | `/inventory/goods-receipt/{id}` | Detalhes do recebimento |
| GoodsReceiptEndpoints | `reverse(id)` | `/inventory/goods-receipt/del/{id}` | Reverter recebimento |

### NFe/Fiscal (11 arquivos)

| Arquivo | Propriedade | Path | Descrição |
|---------|-------------|------|-----------|
| NfeInEndpoints | `list` | `/supply/purchase-invoice/list` | Listar NF-e de entrada |
| NfeInEndpoints | `add` | `/supply/purchase-invoice/add` | Adicionar NF-e de entrada |
| NfeInEndpoints | `edit(id)` | `/supply/purchase-invoice/edit/{id}` | Editar NF-e de entrada |
| NfeInEndpoints | `details(id)` | `/supply/purchase-invoice/{id}` | Detalhes da NF-e |
| NfeInEndpoints | `delete(id)` | `/supply/purchase-invoice/del/{id}` | Excluir NF-e |
| NfeInEndpoints | `changeStatus(id)` | `/supply/purchase-invoice/status/{id}` | Alterar status |
| NfeInEndpoints | `cancelStatus(id)` | `/supply/purchase-invoice/status/{id}/cancel` | Cancelar status |
| NfeInEndpoints | `authorize(id)` | `/supply/purchase-invoice/authorize/{id}` | Autorizar NF-e |
| NfeInEndpoints | `reissue(id)` | `/supply/purchase-invoice/reissuance/{id}` | Reemitir NF-e |
| NfeInEndpoints | `nextSequenceNumber` | `/supply/purchase-invoice/next-sequence` | Próximo número sequencial |
| NfeInEndpoints | `defaultSeriesNumber` | `/supply/purchase-invoice/default-series-number` | Número de série padrão |
| NfeInEndpoints | `defaultTransactionNature` | `/supply/purchase-invoice/default-transaction-nature` | Natureza de operação padrão |
| NfeInEndpoints | `returnInventory(id)` | `/supply/purchase-invoice/{id}/return-inventory` | Devolver ao estoque |
| NfeInEndpoints | `importXml` | `/supply/purchase-invoice/import/xml` | Importar XML |
| NfeInEndpoints | `detailsByAccessKey(accessKey)` | `/supply/purchase-invoice/details/{accessKey}` | Detalhes por chave de acesso |
| NfeInEndpoints | `importByAccessKey(accessKey)` | `/supply/purchase-invoice/import/access-key/{accessKey}` | Importar por chave de acesso |
| NfeOutEndpoints | `list` | `/sales/sales-invoice/list` | Listar NF-e de saida |
| NfeOutEndpoints | `add` | `/sales/sales-invoice/add` | Adicionar NF-e de saida |
| NfeOutEndpoints | `addReturn` | `/sales/sales-invoice/return` | Criar devolucao de saida |
| NfeOutEndpoints | `edit(id)` | `/sales/sales-invoice/edit/{id}` | Editar NF-e de saida |
| NfeOutEndpoints | `details(id)` | `/sales/sales-invoice/{id}` | Detalhes da NF-e |
| NfeOutEndpoints | `delete(id)` | `/sales/sales-invoice/del/{id}` | Excluir NF-e |
| NfeOutEndpoints | `changeStatus(id)` | `/sales/sales-invoice/status/{id}` | Alterar status |
| NfeOutEndpoints | `cancelStatus(id)` | `/sales/sales-invoice/status/{id}/cancel` | Cancelar status |
| NfeOutEndpoints | `authorize(id)` | `/sales/sales-invoice/authorize/{id}` | Autorizar NF-e |
| NfeOutEndpoints | `reissue(id)` | `/sales/sales-invoice/reissuance/{id}` | Reemitir NF-e |
| NfeOutEndpoints | `launchInventory(idNfeOut)` | `/sales/sales-invoice/launch-inventory/{idNfeOut}` | Lancar no estoque |
| NfeOutEndpoints | `returnableBalance(id)` | `/sales/sales-invoice/{id}/returnable-balance` | Consultar saldo retornavel |
| NfeOutEndpoints | `transactionNature` | `/sales/sales-invoice/transaction-nature` | Natureza de operacao |
| NfeOutEndpoints | `nextSequenceNumber` | `/sales/sales-invoice/next-sequence` | Proximo numero sequencial |
| NfeOutEndpoints | `defaultSeriesNumber` | `/sales/sales-invoice/default-series-number` | Numero de serie padrao |
| NfeOutEndpoints | `defaultTransactionNature` | `/sales/sales-invoice/default-transaction-nature` | Natureza de operação padrao |
| NfceEndpoints | `list` | `/sales/nfce/list` | Listar NFC-e |
| NfceEndpoints | `add` | `/sales/nfce/add` | Adicionar NFC-e |
| NfceEndpoints | `edit(id)` | `/sales/nfce/edit/{id}` | Editar NFC-e |
| NfceEndpoints | `details(id)` | `/sales/nfce/{id}` | Detalhes da NFC-e |
| NfceEndpoints | `delete(id)` | `/sales/nfce/del/{id}` | Excluir NFC-e |
| NfceEndpoints | `changeStatus(id)` | `/sales/nfce/status/{id}` | Alterar status |
| NfceEndpoints | `cancelStatus(id)` | `/sales/nfce/status/{id}/cancel` | Cancelar status |
| NfceEndpoints | `authorize(id)` | `/sales/nfce/authorize/{id}` | Autorizar NFC-e |
| NfceEndpoints | `reissue(id)` | `/sales/nfce/reissuance/{id}` | Reemitir NFC-e |
| NfceEndpoints | `batchReissue` | `/sales/nfce/batch-reissuance` | Reemitir em lote |
| NfceEndpoints | `transactionNature` | `/sales/nfce/transaction-nature` | Natureza de operação |
| NfceEndpoints | `nextSequenceNumber` | `/sales/nfce/next-sequence` | Próximo número sequencial |
| NfceEndpoints | `defaultSeriesNumber` | `/sales/nfce/default-series-number` | Número de série padrão |
| NfceEndpoints | `defaultTransactionNature` | `/sales/nfce/default-transaction-nature` | Natureza de operação padrão |
| NfceEndpoints | `printDanfe(id)` | `/sales/nfce/print/{id}` | Imprimir DANFE |
| NfceDisableEndpoints | `list` | `/sales/nfce-disable/list` | Listar inutilizações |
| NfceDisableEndpoints | `add` | `/sales/nfce-disable/add` | Adicionar inutilização |
| NfceDisableEndpoints | `details(id)` | `/sales/nfce-disable/{id}` | Detalhes da inutilização |
| NfceDisableEndpoints | `delete(id)` | `/sales/nfce-disable/del/{id}` | Excluir inutilização |
| NfceDisableEndpoints | `cancel(id)` | `/sales/nfce-disable/cancel/{id}` | Cancelar inutilização |
| NfeConfigEndpoints | `edit` | `/preferences/config/nfe` | Editar configuração NF-e |
| NfeConfigEndpoints | `details` | `/preferences/config/nfe` | Detalhes da configuração |
| NfeConfigEndpoints | `resetSequenceNumber` | `/preferences/config/nfe/reset-sequence-number` | Resetar número sequencial |
| NfeDistributionEndpoints | `status` | `/supply/distribution/status` | Status da distribuição |
| NfeDistributionEndpoints | `list` | `/supply/distribution/list` | Listar documentos |
| NfeDistributionEndpoints | `import(id)` | `/supply/distribution/documents/{id}/import` | Importar documento |
| NfeDistributionEndpoints | `changeStatus(id)` | `/supply/distribution/status/{id}` | Alterar status |
| TransactionNatureEndpoints | `list` | `/preferences/transaction-nature/list` | Listar naturezas de operação |
| TransactionNatureEndpoints | `add` | `/preferences/transaction-nature/add` | Adicionar natureza |
| TransactionNatureEndpoints | `edit(id)` | `/preferences/transaction-nature/edit/{id}` | Editar natureza |
| TransactionNatureEndpoints | `details(id)` | `/preferences/transaction-nature/{id}` | Detalhes da natureza |
| TransactionNatureEndpoints | `delete(id)` | `/preferences/transaction-nature/del/{id}` | Excluir natureza |
| TransactionNatureEndpoints | `toggleStatus(id)` | `/preferences/transaction-nature/status/{id}` | Ativar/desativar natureza |
| TransactionNatureEndpoints | `setDefault(id)` | `/preferences/transaction-nature/default/{id}` | Definir natureza padrão |
| TransactionNatureEndpoints | `deleteBatch` | `/preferences/transaction-nature/del/batch` | Excluir em lote |
| TransactionNatureEndpoints | `toggleStatusBatch` | `/preferences/transaction-nature/status/batch` | Ativar/desativar em lote |
| TaxScenarioEndpoints | `list` | `/preferences/tax-scenario/list` | Listar cenários tributários |
| TaxScenarioEndpoints | `add` | `/preferences/tax-scenario/add` | Adicionar cenário |
| TaxScenarioEndpoints | `edit(id)` | `/preferences/tax-scenario/edit/{id}` | Editar cenário |
| TaxScenarioEndpoints | `details(id)` | `/preferences/tax-scenario/{id}` | Detalhes do cenário |
| TaxScenarioEndpoints | `delete(id)` | `/preferences/tax-scenario/del/{id}` | Excluir cenário |
| TaxScenarioEndpoints | `toggleStatus(id)` | `/preferences/tax-scenario/status/{id}` | Ativar/desativar cenário |
| CfopEndpoints | `list` | `/preferences/cfop/list` | Listar CFOPs |
| CfopEndpoints | `add` | `/preferences/cfop/add` | Adicionar CFOP |
| CfopEndpoints | `edit(id)` | `/preferences/cfop/edit/{id}` | Editar CFOP |
| CfopEndpoints | `details(id)` | `/preferences/cfop/{id}` | Detalhes do CFOP |
| CfopEndpoints | `delete(id)` | `/preferences/cfop/del/{id}` | Excluir CFOP |
| CfopEndpoints | `toggleStatus(id)` | `/preferences/cfop/status/{id}` | Ativar/desativar CFOP |
| CfopEndpoints | `deleteBatch` | `/preferences/cfop/del/batch` | Excluir em lote |
| CfopEndpoints | `toggleStatusBatch` | `/preferences/cfop/status/batch` | Ativar/desativar em lote |
| CestEndpoints | `list` | `/preferences/cest/list` | Listar CESTs |
| CestEndpoints | `add` | `/preferences/cest/add` | Adicionar CEST |
| CestEndpoints | `edit(id)` | `/preferences/cest/edit/{id}` | Editar CEST |
| CestEndpoints | `details(id)` | `/preferences/cest/{id}` | Detalhes do CEST |
| CestEndpoints | `delete(id)` | `/preferences/cest/del/{id}` | Excluir CEST |
| CestEndpoints | `toggleStatus(id)` | `/preferences/cest/status/{id}` | Ativar/desativar CEST |
| CestEndpoints | `deleteBatch` | `/preferences/cest/del/batch` | Excluir em lote |
| CestEndpoints | `toggleStatusBatch` | `/preferences/cest/status/batch` | Ativar/desativar em lote |
| NcmEndpoints | `list` | `/preferences/ncm/list` | Listar NCMs |
| NcmEndpoints | `add` | `/preferences/ncm/add` | Adicionar NCM |
| NcmEndpoints | `edit(id)` | `/preferences/ncm/edit/{id}` | Editar NCM |
| NcmEndpoints | `details(id)` | `/preferences/ncm/{id}` | Detalhes do NCM |
| NcmEndpoints | `delete(id)` | `/preferences/ncm/del/{id}` | Excluir NCM |
| NcmEndpoints | `toggleStatus(id)` | `/preferences/ncm/status/{id}` | Ativar/desativar NCM |
| NcmEndpoints | `deleteBatch` | `/preferences/ncm/del/batch` | Excluir em lote |
| NcmEndpoints | `toggleStatusBatch` | `/preferences/ncm/status/batch` | Ativar/desativar em lote |

### Contatos (7 arquivos)

| Arquivo | Propriedade | Path | Descrição |
|---------|-------------|------|-----------|
| ContactEndpoints | `list` | `/search/contact` | Buscar contatos |
| ClientContactEndpoints | `list` | `/registrations/client/list` | Listar clientes |
| ClientContactEndpoints | `add` | `/registrations/client/add` | Adicionar cliente |
| ClientContactEndpoints | `edit(id)` | `/registrations/client/edit/{id}` | Editar cliente |
| ClientContactEndpoints | `details(id)` | `/registrations/client/{id}` | Detalhes do cliente |
| ClientContactEndpoints | `delete(id)` | `/registrations/client/del/{id}` | Excluir cliente |
| ClientContactEndpoints | `toggleStatus(id)` | `/registrations/client/status/{id}` | Ativar/desativar cliente |
| ClientContactEndpoints | `deleteBatch` | `/registrations/client/del-batch` | Excluir em lote |
| ClientContactEndpoints | `toggleStatusBatch` | `/registrations/client/status-batch` | Ativar/desativar em lote |
| EmployeeContactEndpoints | `list` | `/registrations/employee/list` | Listar funcionários |
| EmployeeContactEndpoints | `add` | `/registrations/employee/add` | Adicionar funcionário |
| EmployeeContactEndpoints | `edit(id)` | `/registrations/employee/edit/{id}` | Editar funcionário |
| EmployeeContactEndpoints | `details(id)` | `/registrations/employee/{id}` | Detalhes do funcionário |
| EmployeeContactEndpoints | `delete(id)` | `/registrations/employee/del/{id}` | Excluir funcionário |
| EmployeeContactEndpoints | `toggleStatus(id)` | `/registrations/employee/status/{id}` | Ativar/desativar funcionário |
| EmployeeContactEndpoints | `notificationAvailableList` | `/registrations/employee/notification/available/list` | Notificações disponíveis |
| EmployeeContactEndpoints | `deleteBatch` | `/registrations/employee/del-batch` | Excluir em lote |
| EmployeeContactEndpoints | `toggleStatusBatch` | `/registrations/employee/status-batch` | Ativar/desativar em lote |
| CommunityContactEndpoints | `list` | `/registrations/community/list` | Listar contatos da comunidade |
| CommunityContactEndpoints | `add` | `/registrations/community/add` | Adicionar contato |
| CommunityContactEndpoints | `edit(id)` | `/registrations/community/edit/{id}` | Editar contato |
| CommunityContactEndpoints | `details(id)` | `/registrations/community/{id}` | Detalhes do contato |
| CommunityContactEndpoints | `delete(id)` | `/registrations/community/del/{id}` | Excluir contato |
| CommunityContactEndpoints | `toggleStatus(id)` | `/registrations/community/status/{id}` | Ativar/desativar contato |
| CommunityContactEndpoints | `deleteBatch` | `/registrations/community/del-batch` | Excluir em lote |
| CommunityContactEndpoints | `toggleStatusBatch` | `/registrations/community/status-batch` | Ativar/desativar em lote |
| AddressEndpoints | `details(cep)` | `/address/resolve-cep/{cep}` | Consultar endereco por CEP |
| ClientFeedbackEndpoints | `list` | `/crm/client-feedback/list` | Listar pesquisas de satisfacao de clientes |
| ClientFeedbackEndpoints | `add` | `/crm/client-feedback/add` | Criar pesquisa de satisfacao |
| ClientFeedbackEndpoints | `edit(id)` | `/crm/client-feedback/edit/{id}` | Editar pesquisa de satisfacao |
| ClientFeedbackEndpoints | `details(id)` | `/crm/client-feedback/{id}` | Detalhes da pesquisa |
| ClientFeedbackEndpoints | `delete(id)` | `/crm/client-feedback/del/{id}` | Excluir pesquisa |
| ClientFeedbackEndpoints | `toggleStatus(id)` | `/crm/client-feedback/status/{id}` | Ativar/desativar pesquisa |
| ClientFeedbackEndpoints | `responses(id)` | `/crm/client-feedback/{id}/responses/list` | Listar respostas da pesquisa |
| CustomerRegistrationEndpoints | `find(token)` | `/public/customer-registration/{token}` | Buscar cadastro público de cliente |
| CustomerRegistrationEndpoints | `confirm(token)` | `/public/customer-registration/{token}/confirm` | Confirmar cadastro público de cliente |

### Sistema/Configuracao (11 arquivos)

| Arquivo | Propriedade | Path | Descrição |
|---------|-------------|------|-----------|
| SystemEndpoints | `version` | `/system/version` | Versão do sistema |
| SystemEndpoints | `usage` | `/system/usage` | Uso do sistema |
| SystemEndpoints | `owner` | `/system/owner` | Proprietário do sistema |
| SystemEndpoints | `modules` | `/system/modules` | Módulos disponíveis |
| SystemEndpoints | `plan` | `/system/plan` | Plano do sistema |
| SystemEndpoints | `billing` | `/system/billing` | Cobranca do sistema |
| SystemEndpoints | `clientApp` | `/system/client-app` | Aplicacao cliente do sistema |
| SystemTypeEndpoints | `list` | `/system-type/list` | Listar tipos de sistema |
| SystemTypeEndpoints | `getSystemTypeByClassName(className)` | `/system-type/{className}` | Buscar tipo por classe |
| CompanyInformationEndpoints | `edit` | `/preferences/company` | Editar dados da empresa |
| CompanyInformationEndpoints | `details` | `/preferences/company` | Detalhes da empresa |
| CertificateConfigEndpoints | `edit` | `/preferences/config/certificate` | Editar certificado digital |
| CertificateConfigEndpoints | `details` | `/preferences/config/certificate` | Detalhes do certificado |
| RegistrationConfigEndpoints | `edit` | `/preferences/config/registration` | Editar configuração de cadastro |
| RegistrationConfigEndpoints | `details` | `/preferences/config/registration` | Detalhes da configuração |
| UiConfigEndpoints | `edit` | `/preferences/config/ui` | Editar configuração de interface |
| UiConfigEndpoints | `details` | `/preferences/config/ui` | Detalhes da configuração |
| FilesPreferencesEndpoints | `edit` | `/preferences/config/file` | Editar preferências de arquivos |
| FilesPreferencesEndpoints | `details` | `/preferences/config/file` | Detalhes das preferências |
| CommunicationPreferencesEndpoints | `edit` | `/preferences/config/communication` | Editar preferências de comunicação |
| CommunicationPreferencesEndpoints | `details` | `/preferences/config/communication` | Detalhes das preferências |
| CommunicationProviderEndpoints | `list` | `/preferences/communication-provider/list` | Listar provedores de comunicação |
| CommunicationProviderEndpoints | `add` | `/preferences/communication-provider/add` | Adicionar provedor |
| CommunicationProviderEndpoints | `edit(id)` | `/preferences/communication-provider/edit/{id}` | Editar provedor |
| CommunicationProviderEndpoints | `details(id)` | `/preferences/communication-provider/{id}` | Detalhes do provedor |
| CommunicationProviderEndpoints | `delete(id)` | `/preferences/communication-provider/del/{id}` | Excluir provedor |
| CommunicationProviderEndpoints | `toggleStatus(id)` | `/preferences/communication-provider/status/{id}` | Ativar/desativar provedor |
| CommunicationProviderEndpoints | `listCommunicationProviderServices` | `/preferences/communication-provider/service/list` | Listar servicos de comunicacao |
| SystemNotificationPreferencesEndpoints | `edit` | `/preferences/config/notification` | Editar preferencias de notificacao |
| SystemNotificationPreferencesEndpoints | `details` | `/preferences/config/notification` | Detalhes das preferencias |
| AgentEndpoints | `chat` | `/agent/chat` | Chat com agente de IA |
| AgentEndpoints | `chatStream` | `/agent/chat/stream` | Chat em streaming do agente |
| AgentEndpoints | `conversations` | `/agent/conversations` | Listar conversas do agente |
| AgentEndpoints | `conversationMessages(conversationId)` | `/agent/conversations/{conversationId}/messages` | Mensagens de uma conversa |

### Dashboard (3 arquivos)

| Arquivo | Propriedade | Path | Descrição |
|---------|-------------|------|-----------|
| DashboardFinanceEndpoints | `totalBalance` | `/dashboard/finance/total-balance` | Saldo total |
| DashboardFinanceEndpoints | `topPaymentMethods` | `/dashboard/finance/top-payment-methods/used` | Métodos de pagamento mais usados |
| DashboardFinanceEndpoints | `resume` | `/dashboard/finance/resume` | Resumo financeiro |
| DashboardFinanceEndpoints | `highBalance` | `/dashboard/finance/high-balance` | Maiores saldos |
| DashboardFinanceEndpoints | `growth` | `/dashboard/finance/growth` | Crescimento financeiro |
| DashboardFinanceEndpoints | `cashFlow` | `/dashboard/finance/cash-flow` | Fluxo de caixa |
| DashboardFinanceEndpoints | `billsToReceive` | `/dashboard/finance/bills-to-receive` | Contas a receber |
| DashboardFinanceEndpoints | `billsToPay` | `/dashboard/finance/bills-to-pay` | Contas a pagar |
| DashboardFinanceEndpoints | `receivablesAging` | `/dashboard/finance/receivables-aging` | Aging de recebíveis |
| DashboardFinanceEndpoints | `profit` | `/dashboard/finance/profit` | Lucro |
| DashboardOperationEndpoints | `warehouseTasks` | `/dashboard/operation/warehouse-task` | Tarefas de depósito |
| DashboardOperationEndpoints | `highlights` | `/dashboard/operation/highlights` | Destaques operacionais |
| DashboardOperationEndpoints | `expiringProduct` | `/dashboard/operation/expiring-product` | Produtos vencendo |
| DashboardOperationEndpoints | `productLoss` | `/dashboard/operation/product-loss` | Perdas de produto |
| DashboardOperationEndpoints | `posAvailability` | `/dashboard/operation/pos-availability` | Disponibilidade de PDV |
| DashboardSalesEndpoints | `topPaymentMethodsUsed` | `/dashboard/sales/top-payment-methods/used` | Métodos de pagamento mais usados |
| DashboardSalesEndpoints | `topPaymentMethodsReceived` | `/dashboard/sales/top-payment-methods/received` | Métodos mais recebidos |
| DashboardSalesEndpoints | `resume` | `/dashboard/sales/resume` | Resumo de vendas |
| DashboardSalesEndpoints | `peakHours` | `/dashboard/sales/peak-hours` | Horários de pico |
| DashboardSalesEndpoints | `orders` | `/dashboard/sales/orders` | Pedidos |
| DashboardSalesEndpoints | `bestSellersProducts` | `/dashboard/sales/best-sellers/products` | Produtos mais vendidos |
| DashboardSalesEndpoints | `bestSellersCategories` | `/dashboard/sales/best-sellers/categories` | Categorias mais vendidas |
| DashboardSalesEndpoints | `averageTicket` | `/dashboard/sales/average-ticket` | Ticket médio |

### Outros (16 arquivos)

| Arquivo | Propriedade | Path | Descrição |
|---------|-------------|------|-----------|
| HomeEndpoints | `announcements` | `/home/announcements` | Anuncios |
| HomeEndpoints | `news` | `/home/news` | Novidades |
| HomeEndpoints | `modules` | `/home/modules` | Modulos disponiveis |
| HomeEndpoints | `dismissFirstAccess` | `/account/first-access` | Dispensar primeiro acesso |
| PushNotificationEndpoints | `list` | `/push-notification/list` | Listar push notifications |
| PushNotificationEndpoints | `add` | `/push-notification/add` | Criar push notification |
| PushNotificationEndpoints | `details(id)` | `/push-notification/{id}` | Detalhes da push notification |
| PushNotificationEndpoints | `update(id)` | `/push-notification/{id}` | Atualizar push notification |
| PushNotificationEndpoints | `send(id)` | `/push-notification/{id}/send` | Enviar push notification |
| PushNotificationEndpoints | `cancel(id)` | `/push-notification/{id}/cancel` | Cancelar envio |
| PushNotificationEndpoints | `consumers` | `/push-notification/consumer/list` | Listar consumidores |
| SetupGuideEndpoints | `state` | `/setup-guide/state` | Estado do guia de configuracao |
| SetupGuideEndpoints | `dismiss` | `/setup-guide/dismiss` | Dispensar guia de configuracao |
| SetupGuideEndpoints | `stepSkip(code)` | `/setup-guide/steps/{code}/skip` | Pular etapa do guia |
| ScheduleEndpoints | `list` | `/schedule/list` | Listar agendamentos |
| ScheduleEndpoints | `add` | `/schedule/add` | Criar agendamento |
| ScheduleEndpoints | `edit(id)` | `/schedule/edit/{id}` | Editar agendamento |
| ScheduleEndpoints | `details(id)` | `/schedule/{id}` | Detalhes do agendamento |
| ScheduleEndpoints | `delete(id)` | `/schedule/del/{id}` | Excluir agendamento |
| SetupEndpoints | `setup` | `/setup` | Configuração inicial |
| SetupEndpoints | `setLogo` | `/setup/logo` | Definir logotipo |
| TagEndpoints | `listAll` | `/preferences/tag/list-all` | Listar todas as tags |
| TagEndpoints | `add` | `/preferences/tag/add` | Adicionar tag |
| TagEndpoints | `list(type)` | `/preferences/tag/{type}/list` | Listar tags por tipo |
| TagEndpoints | `edit(id)` | `/preferences/tag/edit/{id}` | Editar tag |
| TagEndpoints | `details(id)` | `/preferences/tag/{id}` | Detalhes da tag |
| TagEndpoints | `delete(id)` | `/preferences/tag/del/{id}` | Excluir tag |
| TagEndpoints | `toggleStatus(id)` | `/preferences/tag/{id}/status` | Ativar/desativar tag |
| TagEndpoints | `deleteBatch` | `/preferences/tag/del/batch` | Excluir em lote |
| TagEndpoints | `toggleStatusBatch` | `/preferences/tag/status/batch` | Ativar/desativar em lote |
| TagTemplateEndpoints | `list` | `/preferences/tag-template/list` | Listar templates de tag |
| TagTemplateEndpoints | `add` | `/preferences/tag-template/add` | Adicionar template |
| TagTemplateEndpoints | `edit(id)` | `/preferences/tag-template/edit/{id}` | Editar template |
| TagTemplateEndpoints | `details(id)` | `/preferences/tag-template/{id}` | Detalhes do template |
| TagTemplateEndpoints | `delete(id)` | `/preferences/tag-template/del/{id}` | Excluir template |
| TagTemplateEndpoints | `toggleStatus(id)` | `/preferences/tag-template/status/{id}` | Ativar/desativar template |
| TagTemplateEndpoints | `deleteBatch` | `/preferences/tag-template/del/batch` | Excluir em lote |
| TagTemplateEndpoints | `toggleStatusBatch` | `/preferences/tag-template/status/batch` | Ativar/desativar em lote |
| TagTemplateEndpoints | `duplicate(id)` | `/preferences/tag-template/duplicate/{id}` | Duplicar template |
| TaskEndpoints | `getStatus(taskName)` | `/tasks/{taskName}` | Status da tarefa |
| TelemetryEndpoints | `sales` | `/telemetry/sales` | Telemetria de vendas |
| TelemetryEndpoints | `posList` | `/telemetry/pos/list` | Listar PDVs |
| TelemetryEndpoints | `alerts` | `telemetry/alert/list` | Listar alertas |
| TelemetryEndpoints | `resume` | `/telemetry/resume` | Resumo de telemetria |
| TelemetryEndpoints | `posHealth` | `/telemetry/pos-health` | Saúde dos PDVs |
| TerminalEndpoints | `list` | `/registrations/terminal/list` | Listar terminais |
| TerminalEndpoints | `add` | `/registrations/terminal/add` | Adicionar terminal |
| TerminalEndpoints | `edit(id)` | `/registrations/terminal/edit/{id}` | Editar terminal |
| TerminalEndpoints | `details(id)` | `/registrations/terminal/{id}` | Detalhes do terminal |
| TerminalEndpoints | `delete(id)` | `/registrations/terminal/del/{id}` | Excluir terminal |
| TerminalEndpoints | `editPassword(id)` | `/registrations/terminal/edit-password/{id}` | Alterar senha do terminal |
| TerminalEndpoints | `forceReboot(id)` | `/registrations/terminal/{id}/force-reboot` | Forçar reinicialização |
| TerminalEndpoints | `deleteBatch` | `/registrations/terminal/del-batch` | Excluir em lote |
| PointOfSaleEndpoints | `list` | `/registrations/pos/list` | Listar pontos de venda |
| PointOfSaleEndpoints | `add` | `/registrations/pos/add` | Adicionar ponto de venda |
| PointOfSaleEndpoints | `edit(id)` | `/registrations/pos/edit/{id}` | Editar ponto de venda |
| PointOfSaleEndpoints | `details(id)` | `/registrations/pos/{id}` | Detalhes do PDV |
| PointOfSaleEndpoints | `delete(id)` | `/registrations/pos/del/{id}` | Excluir ponto de venda |
| PointOfSaleEndpoints | `toggleStatus(id)` | `/registrations/pos/status/{id}` | Ativar/desativar PDV |
| PointOfSaleEndpoints | `deleteBatch` | `/registrations/pos/del-batch` | Excluir em lote |
| PointOfSaleEndpoints | `toggleStatusBatch` | `/registrations/pos/status-batch` | Ativar/desativar em lote |
| FileManagerEndpoints | `list` | `/file-manager/list` | Listar arquivos |
| FileManagerEndpoints | `uploadFile` | `/file-manager/upload/file` | Upload de arquivo |
| FileManagerEndpoints | `uploadUrl` | `/file-manager/upload/url` | Upload via URL |
| FileManagerEndpoints | `edit(id)` | `/file-manager/edit/{id}` | Editar arquivo |
| FileManagerEndpoints | `find(id)` | `/file-manager/{id}` | Buscar arquivo |
| FileManagerEndpoints | `delete(id)` | `/file-manager/del/{id}` | Excluir arquivo |
| FileManagerEndpoints | `systemStorageDetails` | `/file-manager/system-store-details` | Detalhes do armazenamento |
| NotificationsEndpoints | `list` | `/notification/list` | Listar notificações |
| NotificationsEndpoints | `export` | `/notification/export` | Exportar notificações |
| NotificationsEndpoints | `read(id)` | `/notification/read/{id}` | Marcar como lida |
| NotificationsEndpoints | `unread(id)` | `/notification/unread/{id}` | Marcar como não lida |
| NotificationsEndpoints | `readAll` | `/notification/read/all` | Marcar todas como lidas |
| NotificationsEndpoints | `delete(id)` | `/notification/del/{id}` | Excluir notificação |
| NotificationsEndpoints | `deleteBatch` | `/notification/del/batch` | Excluir em lote |
| NotificationsEndpoints | `readBatch` | `/notification/read/batch` | Marcar em lote como lidas |
| NotificationsEndpoints | `details(id)` | `/notification/{id}` | Detalhes da notificação |
| NotificationsEndpoints | `stream` | `/notification/stream` | Stream de notificações (SSE) |
| BarcodeNotFoundEndpoints | `list` | `/sales/reports/barcode-not-found` | Listar códigos de barras não encontrados |
| BarcodeNotFoundEndpoints | `addToPlanogram` | `/sales/reports/barcode-not-found/add-to-planogram` | Adicionar ao planograma |
| SupportPageEndpoints | `support` | `/suporte` | Pagina de suporte |
| SystemUserEndpoints | `dashboard` | `/inicio/indice` | Indice do usuario do sistema |

## Links de Navegação

A camada de rotas do cliente usa constantes centralizadas em `src/api/core/links.ts` para montar URLs internas da aplicação. Entre os vínculos disponíveis, a página de detalhe de operação de inventário e a listagem de resultados de pesquisa de satisfação usam funções parametrizadas.

| Constante | Valor / Formato | Uso |
|-----------|------------------|-----|
| `INVENTORY_OPERATIONS_PAGE_URL` | `/suprimentos/operacoes` | Página de listagem de operações de inventário |
| `INVENTORY_OPERATION_DETAIL_PAGE_URL(id)` | `/suprimentos/operacoes/{id}` | Página de detalhe de operação de inventário |
| `CLIENT_FEEDBACK_LIST_PAGE_URL` | `/crm/pesquisa-satisfacao/lista` | Listagem de pesquisas de satisfação |
| `CLIENT_FEEDBACK_NEW_PAGE_URL` | `/crm/pesquisa-satisfacao/lista/novo` | Criação de pesquisa de satisfação |
| `CLIENT_FEEDBACK_EDIT_PAGE_URL(id)` | `/crm/pesquisa-satisfacao/lista/edita/{id}` | Edição de pesquisa de satisfação |
| `CLIENT_FEEDBACK_RESULTS_PAGE_URL(id)` | `/crm/pesquisa-satisfacao/lista?pesquisa={id}` | Resultados de pesquisa de satisfação |

## Resumo

O catálogo acima reúne os seguintes arquivos e endpoints:

| Domínio | Arquivos | Endpoints |
|---------|----------|-----------|
| Auth | 1 | 6 |
| Conta/Usuarios | 5 | 44 |
| Catalogo | 5 | 46 |
| Vendas | 8 | 59 |
| Financeiro | 14 | 98 |
| Suprimentos/Estoque | 19 | 134 |
| NFe/Fiscal | 11 | 98 |
| Contatos | 7 | 36 |
| Sistema/Configuracao | 11 | 34 |
| Dashboard | 3 | 23 |
| Outros | 16 | 82 |
| **Total** | **100** | **660** |

Todos os endpoints seguem o padrão de objetos constantes exportados, com paths estáticos para operações sem parâmetros e arrow functions para paths dinâmicos. Os wrappers tipados em `axios.ts` garantem que todas as chamadas retornem `ApiResponse<T>`, mantendo consistência na camada de comunicação. Endpoints que utilizam `responseType` binário ou em streaming retornam o payload cru e são tratados sem o envelope padrão da API.
