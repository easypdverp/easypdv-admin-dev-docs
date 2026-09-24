---
title: API e Endpoints
description: Padroes de comunicacao com a API e catalogo completo de endpoints do Despensinha ERP.
sidebar:
  order: 5
---

O Despensinha ERP utiliza uma camada de API centralizada baseada no **axios**, com wrappers tipados que garantem respostas consistentes via `ApiResponse<T>`. Toda comunicacao com o backend segue um padrao uniforme: instancia axios configurada com interceptors de autenticacao e tratamento de erros, e arquivos de endpoints organizados por dominio que exportam objetos constantes com paths estaticos e funcoes para paths dinamicos.

## Configuracao do Axios

A instancia do axios e criada em `src/api/axios.ts` com a seguinte configuracao base:

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

A `baseURL` vem da variavel de ambiente `VITE_APP_API_URL`, configurada em `.env.development` para desenvolvimento e injetada pelo CI/CD em producao.

### Wrappers Tipados

O arquivo exporta cinco funcoes wrapper que encapsulam os metodos HTTP do axios, todas retornando `Promise<ApiResponse<R>>`:

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

| Wrapper   | Metodo HTTP | Aceita Body | Uso Tipico                  |
|-----------|-------------|-------------|-----------------------------|
| `get`     | GET         | Nao         | Listagens, detalhes         |
| `post`    | POST        | Sim         | Criacao de recursos         |
| `put`     | PUT         | Sim         | Atualizacao completa        |
| `patch`    | PATCH       | Sim         | Atualizacao parcial         |
| `destroy` | DELETE      | Nao         | Remocao de recursos         |

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

Os interceptors sao configurados pela funcao `setupAxios()` e gerenciam autenticacao e tratamento de erros automaticamente.

### Request Interceptor

Adiciona o header `Authorization` com o token do usuario autenticado em todas as requisicoes (exceto refresh token):

```typescript
const onRequest = (config: CustomAxiosRequestConfig): CustomAxiosRequestConfig => {
  const auth = getAuth();
  if (auth?.token && !config.url?.includes('refreshtoken')) {
    config.headers.Authorization = auth.type + ' ' + auth.token;
  }
  return config;
};
```

O formato do header e `{type} {token}`, onde `type` e tipicamente `"Bearer"`.

### Response Interceptor

Trata respostas com `success: false` e implementa refresh automatico de token quando recebe status 401:

```typescript
const onResponse = async (response: AxiosResponse<ApiResponse>): Promise<AxiosResponse> => {
  if (!response.data.success) {
    const originalRequest = response.config as CustomAxiosRequestConfig;
    const auth = getAuth();
    const errorResult = new ApiResponseError(response.data);

    if (errorResult.status === 401 && auth?.refresh_token && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const rs = await refreshToken(auth.refresh_token);
        setAuth(rs.data);
        originalRequest.headers['Authorization'] = 'Bearer ' + rs.data.token;
        return client(originalRequest);
      } catch (error) {
        removeAuth();
        return Promise.reject(error);
      }
    }
    return Promise.reject(errorResult);
  }
  return Promise.resolve(response);
};
```

**Fluxo de refresh:**

1. Requisicao retorna `success: false` com status 401
2. Se existe `refresh_token` e a requisicao nao e uma retry, tenta renovar o token
3. Em caso de sucesso, atualiza o auth e reenvia a requisicao original
4. Em caso de falha no refresh, remove a autenticacao e rejeita a promise

## Padrao de Endpoints

Cada dominio do ERP possui um arquivo `{Domain}Endpoints.ts` em `src/api/endpoints/` que exporta um objeto constante com todos os paths daquele dominio. O padrao segue duas convencoes:

- **Paths estaticos**: propriedades string para rotas sem parametros (listagens, criacao)
- **Paths dinamicos**: arrow functions que recebem parametros e retornam a string do path

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

### Convencoes Comuns

| Propriedade        | Tipo       | Descricao                                      |
|--------------------|----------|--------------------------------------------------|
| `list`             | string   | Listagem paginada do recurso                    |
| `add`              | string   | Criacao de novo recurso                         |
| `edit(id)`         | funcao   | Atualizacao de recurso por ID                   |
| `details(id)`      | funcao   | Detalhes de recurso por ID                      |
| `delete(id)`       | funcao   | Remocao de recurso por ID                       |
| `toggleStatus(id)` | funcao   | Ativar/desativar recurso por ID                 |
| `deleteBatch`      | string   | Remocao em lote                                 |
| `toggleStatusBatch` | string  | Ativar/desativar em lote                        |

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

O ERP possui **93 arquivos de endpoints** organizados em 11 dominios. A seguir, o catalogo completo de cada arquivo com todas as suas propriedades.

### Auth (1 arquivo)

| Arquivo | Propriedade | Path | Descricao |
|---------|-------------|------|-----------|
| AuthEndpoints | `login` | `/auth/login` | Login do usuario |
| AuthEndpoints | `logout` | `/auth/logout` | Logout do usuario |
| AuthEndpoints | `refreshToken` | `/auth/refresh-token` | Renovacao de token |
| AuthEndpoints | `forgotPassword` | `/auth/forgot-password` | Recuperacao de senha |
| AuthEndpoints | `resetPassword` | `/auth/reset-password` | Redefinicao de senha |
| AuthEndpoints | `googleLogin` | `/auth/google` | Login via Google |

### Conta/Usuarios (5 arquivos)

| Arquivo | Propriedade | Path | Descricao |
|---------|-------------|------|-----------|
| AccountEndpoints | `save` | `/account/save` | Salvar dados da conta |
| AccountEndpoints | `changePassword` | `/account/change-password` | Alterar senha |
| AccountEndpoints | `changeEmail` | `/account/change-email` | Alterar email |
| AccountEndpoints | `details` | `/account/details` | Detalhes da conta |
| AccountEndpoints | `notificationsPreferencesAvailableList` | `/account/notification-preferences/available/list` | Preferencias de notificacao disponiveis |
| AccountEndpoints | `notificationsPreferencesActiveList` | `/account/notification-preferences/active/list` | Preferencias de notificacao ativas |
| AccountEndpoints | `notificationsPreferencesSave` | `/account/notification-preferences/save` | Salvar preferencias de notificacao |
| AccountEndpoints | `loginSessionList` | `/account/sessions` | Listar sessoes de login |
| AccountEndpoints | `notificationList` | `/account/notifications` | Listar notificacoes da conta |
| AccountEndpoints | `linkGoogleAccount` | `/account/google-account` | Vincular conta Google |
| AccountEndpoints | `unlinkGoogleAccount` | `/account/google-account` | Desvincular conta Google |
| AccountEndpoints | `permissionsAvailableList` | `/account/permissions/available/list` | Listar permissoes disponiveis |
| AccountantManagementEndpoints | `listAccess` | `/accountant-management/access/list` | Listar acessos do contador |
| AccountantManagementEndpoints | `dashboardMetrics` | `/accountant-management/dashboard/invoice/metrics` | Metricas do dashboard do contador |
| AccountantManagementEndpoints | `listInvoices` | `/accountant-management/dashboard/invoice/list` | Listar notas fiscais |
| AccountantManagementEndpoints | `generateInvoicesPdf` | `/accountant-management/dashboard/invoice/generate/pdf` | Gerar PDF de notas fiscais |
| AccountantManagementEndpoints | `generateSpedFiscal` | `/accountant-management/dashboard/invoice/generate/sped-fiscal` | Gerar SPED Fiscal |
| AccountantManagementEndpoints | `toggleAccessStatus(id)` | `/accountant-management/access/status/{id}` | Ativar/desativar acesso do contador |
| AccountantManagementEndpoints | `removeAccess(id)` | `/accountant-management/access/del/{id}` | Remover acesso do contador |
| AccountantManagementEndpoints | `changePassword(id)` | `/accountant-management/access/change-password/{id}` | Alterar senha do contador |
| ManagerManagementEndpoints | `listCommunities` | `/manager-management/communities/list` | Listar comunidades do gestor |
| ManagerManagementEndpoints | `listPointsOfSale` | `/manager-management/pos/list` | Listar pontos de venda |
| ManagerManagementEndpoints | `dashboardMetrics` | `/manager-management/dashboard/metrics` | Metricas do dashboard do gestor |
| ManagerManagementEndpoints | `dashboardChart` | `/manager-management/dashboard/chart` | Grafico do dashboard do gestor |
| ManagerManagementEndpoints | `listBillsToPay` | `/manager-management/dashboard/bills-to-pay/list` | Listar contas a pagar |
| ManagerManagementEndpoints | `listBillsToReceive` | `/manager-management/dashboard/bills-to-receive/list` | Listar contas a receber |
| ManagerManagementEndpoints | `uploadPaymentDoc(installmentId)` | `/manager-management/installment/{installmentId}/upload` | Upload de comprovante de pagamento |
| ManagerManagementEndpoints | `installmentDetails(installmentId)` | `/manager-management/installment/{installmentId}/details` | Detalhes da parcela |
| ManagerManagementEndpoints | `exportReport` | `/manager-management/dashboard/export` | Exportar relatorio |
| InvitationEndpoints | `list` | `/invitation/list` | Listar convites |
| InvitationEndpoints | `find(id)` | `/invitation/{id}` | Buscar convite por ID |
| InvitationEndpoints | `add` | `/invitation/add` | Criar convite |
| InvitationEndpoints | `resend(id)` | `/invitation/resend/{id}` | Reenviar convite |
| InvitationEndpoints | `cancel(id)` | `/invitation/cancel/{id}` | Cancelar convite |
| InvitationEndpoints | `delete(id)` | `/invitation/del/{id}` | Excluir convite |
| InvitationEndpoints | `validate(inviteId)` | `/public/invitations/{inviteId}` | Validar convite (publico) |
| InvitationEndpoints | `accept(inviteId)` | `/public/invitations/accept/{inviteId}` | Aceitar convite (publico) |
| UserRoleEndpoints | `list` | `/preferences/user-role/list` | Listar perfis de usuario |
| UserRoleEndpoints | `add` | `/preferences/user-role/add` | Criar perfil de usuario |
| UserRoleEndpoints | `edit(id)` | `/preferences/user-role/edit/{id}` | Editar perfil de usuario |
| UserRoleEndpoints | `details(id)` | `/preferences/user-role/{id}` | Detalhes do perfil |
| UserRoleEndpoints | `delete(id)` | `/preferences/user-role/del/{id}` | Excluir perfil de usuario |
| UserRoleEndpoints | `deleteBatch` | `/preferences/user-role/del/batch` | Excluir perfis em lote |

### Catalogo (5 arquivos)

| Arquivo | Propriedade | Path | Descricao |
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
| PriceListEndpoints | `list` | `/catalog/price-list/list` | Listar listas de preco |
| PriceListEndpoints | `add` | `/catalog/price-list/add` | Adicionar lista de preco |
| PriceListEndpoints | `edit(id)` | `/catalog/price-list/edit/{id}` | Editar lista de preco |
| PriceListEndpoints | `details(id)` | `/catalog/price-list/{id}` | Detalhes da lista de preco |
| PriceListEndpoints | `delete(id)` | `/catalog/price-list/del/{id}` | Excluir lista de preco |
| PriceListEndpoints | `toggleStatus(id)` | `/catalog/price-list/status/{id}` | Ativar/desativar lista de preco |
| PriceListEndpoints | `deleteBatch` | `/catalog/price-list/del-batch` | Excluir em lote |
| PriceListEndpoints | `toggleStatusBatch` | `/catalog/price-list/status-batch` | Ativar/desativar em lote |
| ConversionUnitEndpoints | `list` | `/preferences/conversion-unit/list` | Listar unidades de conversao |
| ConversionUnitEndpoints | `add` | `/preferences/conversion-unit/add` | Adicionar unidade de conversao |
| ConversionUnitEndpoints | `edit(id)` | `/preferences/conversion-unit/edit/{id}` | Editar unidade de conversao |
| ConversionUnitEndpoints | `details(id)` | `/preferences/conversion-unit/{id}` | Detalhes da unidade |
| ConversionUnitEndpoints | `delete(id)` | `/preferences/conversion-unit/del/{id}` | Excluir unidade de conversao |
| ConversionUnitEndpoints | `toggleStatus(id)` | `/preferences/conversion-unit/status/{id}` | Ativar/desativar unidade |
| ConversionUnitEndpoints | `deleteBatch` | `/preferences/conversion-unit/del/batch` | Excluir em lote |
| ConversionUnitEndpoints | `toggleStatusBatch` | `/preferences/conversion-unit/status/batch` | Ativar/desativar em lote |

### Vendas (7 arquivos)

| Arquivo | Propriedade | Path | Descricao |
|---------|-------------|------|-----------|
| SaleOrderEndpoints | `list` | `/sales/sale-order/list` | Listar pedidos de venda |
| SaleOrderEndpoints | `add` | `/sales/sale-order/add` | Criar pedido de venda |
| SaleOrderEndpoints | `edit(id)` | `/sales/sale-order/edit/{id}` | Editar pedido de venda |
| SaleOrderEndpoints | `details(id)` | `/sales/sale-order/{id}` | Detalhes do pedido |
| SaleOrderEndpoints | `delete(id)` | `/sales/sale-order/del/{id}` | Excluir pedido |
| SaleOrderEndpoints | `cancel(id)` | `/sales/sale-order/{id}/cancel` | Cancelar pedido |
| SaleOrderEndpoints | `changeStatus(id)` | `/sales/sale-order/{id}/change-status` | Alterar status do pedido |
| SaleOrderEndpoints | `nextSequenceNumber` | `/sales/sale-order/next-sequence` | Proximo numero sequencial |
| SaleOrderConfigEndpoints | `edit` | `/preferences/config/sale-order` | Editar configuracao de pedidos |
| SaleOrderConfigEndpoints | `details` | `/preferences/config/sale-order` | Detalhes da configuracao |
| SalesOrderReportEndpoints | `generateReport` | `/sales/reports/general` | Gerar relatorio geral de pedidos |
| SalesReportEndpoints | `financeReport` | `/sales/reports/finance` | Relatorio financeiro de vendas |
| SalesReportEndpoints | `cashierReport` | `/sales/reports/cashier` | Relatorio de caixa |
| SalesReportEndpoints | `transactions` | `/sales/reports/transactions` | Relatorio de transacoes |
| SalesReportEndpoints | `invoiceProductQuery` | `/sales/reports/invoice/product-query` | Consulta de produtos por nota |
| SalesReportEndpoints | `invoiceOperation` | `/sales/reports/invoice/operation` | Relatorio de operacoes fiscais |
| SalesReportEndpoints | `invoiceCustomer` | `/sales/reports/invoice/customer` | Relatorio por cliente |
| SalesReportEndpoints | `invoiceProduct` | `/sales/reports/invoice/product` | Relatorio por produto |
| SalesReportEndpoints | `invoiceProgress` | `/sales/reports/invoice/progress` | Relatorio de progresso fiscal |
| SalesReportEndpoints | `invoiceIcms` | `/sales/reports/invoice/icms` | Relatorio de ICMS |
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
| PromotionEndpoints | `list` | `/sales/promotion/list` | Listar promocoes |
| PromotionEndpoints | `add` | `/sales/promotion/add` | Criar promocao |
| PromotionEndpoints | `edit(id)` | `/sales/promotion/edit/{id}` | Editar promocao |
| PromotionEndpoints | `details(id)` | `/sales/promotion/{id}` | Detalhes da promocao |
| PromotionEndpoints | `delete(id)` | `/sales/promotion/del/{id}` | Excluir promocao |
| PromotionEndpoints | `toggleStatus(id)` | `/sales/promotion/status/{id}` | Ativar/desativar promocao |
| CouponListEndpoints | `list` | `/sales/coupon/list` | Listar cupons |
| CouponListEndpoints | `add` | `/sales/coupon/add` | Criar cupom |
| CouponListEndpoints | `edit(id)` | `/sales/coupon/edit/{id}` | Editar cupom |
| CouponListEndpoints | `details(id)` | `/sales/coupon/{id}` | Detalhes do cupom |
| CouponListEndpoints | `delete(id)` | `/sales/coupon/del/{id}` | Excluir cupom |
| CouponListEndpoints | `toggleStatus(id)` | `/sales/coupon/status/{id}` | Ativar/desativar cupom |
| CouponListEndpoints | `usage(id)` | `/sales/coupon/usage/{id}` | Uso do cupom |
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
| NfeOutEndpoints | `defaultTransactionNature` | `/sales/sales-invoice/default-transaction-nature` | Natureza de operacao padrao |
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
| NfceEndpoints | `transactionNature` | `/sales/nfce/transaction-nature` | Natureza de operacao |
| NfceEndpoints | `nextSequenceNumber` | `/sales/nfce/next-sequence` | Proximo numero sequencial |
| NfceEndpoints | `defaultSeriesNumber` | `/sales/nfce/default-series-number` | Numero de serie padrao |
| NfceEndpoints | `defaultTransactionNature` | `/sales/nfce/default-transaction-nature` | Natureza de operacao padrao |
| NfceEndpoints | `printDanfe(id)` | `/sales/nfce/print/{id}` | Imprimir DANFE |
| NfceDisableEndpoints | `list` | `/sales/nfce-disable/list` | Listar inutilizacoes |
| NfceDisableEndpoints | `add` | `/sales/nfce-disable/add` | Adicionar inutilizacao |
| NfceDisableEndpoints | `details(id)` | `/sales/nfce-disable/{id}` | Detalhes da inutilizacao |
| NfceDisableEndpoints | `delete(id)` | `/sales/nfce-disable/del/{id}` | Excluir inutilizacao |
| NfceDisableEndpoints | `cancel(id)` | `/sales/nfce-disable/cancel/{id}` | Cancelar inutilizacao |
| NfeConfigEndpoints | `edit` | `/preferences/config/nfe` | Editar configuracao NF-e |
| NfeConfigEndpoints | `details` | `/preferences/config/nfe` | Detalhes da configuracao |
| NfeConfigEndpoints | `resetSequenceNumber` | `/preferences/config/nfe/reset-sequence-number` | Resetar numero sequencial |
| NfeDistributionEndpoints | `status` | `/supply/distribution/status` | Status da distribuicao |
| NfeDistributionEndpoints | `list` | `/supply/distribution/list` | Listar documentos |
| NfeDistributionEndpoints | `import(id)` | `/supply/distribution/documents/{id}/import` | Importar documento |
| NfeDistributionEndpoints | `changeStatus(id)` | `/supply/distribution/status/{id}` | Alterar status |
| TransactionNatureEndpoints | `list` | `/preferences/transaction-nature/list` | Listar naturezas de operacao |
| TransactionNatureEndpoints | `add` | `/preferences/transaction-nature/add` | Adicionar natureza |
| TransactionNatureEndpoints | `edit(id)` | `/preferences/transaction-nature/edit/{id}` | Editar natureza |
| TransactionNatureEndpoints | `details(id)` | `/preferences/transaction-nature/{id}` | Detalhes da natureza |
| TransactionNatureEndpoints | `delete(id)` | `/preferences/transaction-nature/del/{id}` | Excluir natureza |
| TransactionNatureEndpoints | `toggleStatus(id)` | `/preferences/transaction-nature/status/{id}` | Ativar/desativar natureza |
| TransactionNatureEndpoints | `setDefault(id)` | `/preferences/transaction-nature/default/{id}` | Definir natureza padrao |
| TransactionNatureEndpoints | `deleteBatch` | `/preferences/transaction-nature/del/batch` | Excluir em lote |
| TransactionNatureEndpoints | `toggleStatusBatch` | `/preferences/transaction-nature/status/batch` | Ativar/desativar em lote |
| TaxScenarioEndpoints | `list` | `/preferences/tax-scenario/list` | Listar cenarios tributarios |
| TaxScenarioEndpoints | `add` | `/preferences/tax-scenario/add` | Adicionar cenario |
| TaxScenarioEndpoints | `edit(id)` | `/preferences/tax-scenario/edit/{id}` | Editar cenario |
| TaxScenarioEndpoints | `details(id)` | `/preferences/tax-scenario/{id}` | Detalhes do cenario |
| TaxScenarioEndpoints | `delete(id)` | `/preferences/tax-scenario/del/{id}` | Excluir cenario |
| TaxScenarioEndpoints | `toggleStatus(id)` | `/preferences/tax-scenario/status/{id}` | Ativar/desativar cenario |
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

### Suprimentos/Estoque (18 arquivos)

| Arquivo | Propriedade | Path | Descricao |
|---------|-------------|------|-----------|
| InventoryEndpoints | `list` | `/supply/inventory/transfer` | Listar transferencias de estoque |
| InventoryEndpoints | `entries` | `/supply/inventory/entries` | Listar lancamentos de estoque |
| InventoryEndpoints | `addOutEntry` | `/supply/inventory/out` | Lancamento de saida |
| InventoryEndpoints | `addReceivingEntry` | `/supply/inventory/enter` | Lancamento de entrada |
| InventoryEndpoints | `addBalanceEntry` | `/supply/inventory/balance` | Lancamento de saldo |
| InventoryEndpoints | `addTransferEntry` | `/supply/inventory/transfer` | Transferencia entre depositos |
| InventoryEndpoints | `warehouseDetails(idWarehouse)` | `/supply/inventory/{idWarehouse}` | Detalhes do deposito |
| InventoryEndpoints | `productEntries(idProduct)` | `/supply/inventory/product/{idProduct}/entries` | Lancamentos do produto |
| InventoryEndpoints | `reverseBatch(sourceId)` | `/supply/inventory/reverse-batch/{sourceId}` | Reverter lote |
| InventoryEndpoints | `launchBatchOut` | `/supply/inventory/launch-batch-out` | Lancamento de saida em lote |
| InventoryEndpoints | `launchBatchIn` | `/supply/inventory/launch-batch-in` | Lancamento de entrada em lote |
| InventoryCheckEndpoints | `listTasks` | `/supply/task/inventory/list` | Listar tarefas de inventario |
| InventoryCheckEndpoints | `createTask` | `/supply/task/inventory/create` | Criar tarefa de inventario |
| InventoryCheckEndpoints | `getTask(taskId)` | `/supply/task/inventory/{taskId}` | Detalhes da tarefa |
| InventoryCheckEndpoints | `finishTask(taskId)` | `/supply/task/inventory/{taskId}/finish` | Finalizar tarefa |
| InventoryCheckEndpoints | `cancelTask(taskId)` | `/supply/task/inventory/{taskId}/cancel` | Cancelar tarefa |
| InventoryCheckEndpoints | `itemList(taskId)` | `/supply/task/inventory/{taskId}/item/list` | Listar itens da tarefa |
| InventoryCheckEndpoints | `addItem(taskId)` | `/supply/task/inventory/{taskId}/add` | Adicionar item a tarefa |
| InventoryCheckEndpoints | `editItem(taskId, itemId)` | `/supply/task/inventory/{taskId}/edit/{itemId}` | Editar item da tarefa |
| InventoryCheckEndpoints | `getItem(itemId)` | `/supply/task/inventory/item/{itemId}` | Detalhes do item |
| InventoryCheckEndpoints | `getHistory(taskId)` | `/supply/task/inventory/{taskId}/history` | Historico da tarefa |
| InventoryConfigEndpoints | `edit` | `/preferences/config/inventory` | Editar configuracao de estoque |
| InventoryConfigEndpoints | `details` | `/preferences/config/inventory` | Detalhes da configuracao |
| InventoryReserveEndpoints | `listWarehouseReserves` | `supply/reserve/list` | Listar reservas de deposito |
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
| BuyOrderEndpoints | `nextSequenceNumber` | `/supply/buy-order/next-sequence` | Proximo numero sequencial |
| BuyOrderEndpoints | `approveBatch` | `/supply/buy-order/approve-batch` | Aprovar pedidos em lote |
| BuyOrderEndpoints | `cancelBatch` | `/supply/buy-order/cancel-batch` | Cancelar pedidos em lote |
| BuyOrderConfigEndpoints | `edit` | `/preferences/config/buy-order` | Editar configuracao de compras |
| BuyOrderConfigEndpoints | `details` | `/preferences/config/buy-order` | Detalhes da configuracao |
| PicklistEndpoints | `list` | `/supply/pick-list/list` | Listar picklists |
| PicklistEndpoints | `add` | `/supply/pick-list/add` | Criar picklist |
| PicklistEndpoints | `getPicklist(id)` | `/supply/pick-list/{id}` | Detalhes da picklist |
| PicklistEndpoints | `delete(id)` | `/supply/pick-list/del/{id}` | Excluir picklist |
| PicklistEndpoints | `deleteBatch` | `/supply/pick-list/del/batch` | Excluir em lote |
| PicklistEndpoints | `editDescription(id)` | `/supply/pick-list/edit-description/{id}` | Editar descricao |
| PicklistEndpoints | `itemList(picklistId)` | `/supply/pick-list/{picklistId}/item/list` | Listar itens da picklist |
| PicklistEndpoints | `addItem(picklistId)` | `/supply/pick-list/{picklistId}/add-item` | Adicionar item |
| PicklistEndpoints | `editItem(itemId)` | `/supply/pick-list/edit-item/{itemId}` | Editar item |
| PicklistEndpoints | `getPicklistItem(id)` | `/supply/pick-list/item/{id}` | Detalhes do item |
| PicklistEndpoints | `deleteItem(itemId)` | `/supply/pick-list/del-item/{itemId}` | Excluir item |
| WarehouseEndpoints | `list` | `/preferences/warehouse/list` | Listar depositos |
| WarehouseEndpoints | `add` | `/preferences/warehouse/add` | Adicionar deposito |
| WarehouseEndpoints | `edit(id)` | `/preferences/warehouse/edit/{id}` | Editar deposito |
| WarehouseEndpoints | `details(id)` | `/preferences/warehouse/{id}` | Detalhes do deposito |
| WarehouseEndpoints | `delete(id)` | `/preferences/warehouse/del/{id}` | Excluir deposito |
| WarehouseEndpoints | `toggleStatus(id)` | `/preferences/warehouse/status/{id}` | Ativar/desativar deposito |
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
| ProductInventoryControlEndpoints | `movementHistory(productId)` | `/supply/product-inventory/{productId}/movement-history` | Historico de movimentacao |
| ProductLossReportEndpoints | `list` | `/supply/reports/product-loss/list` | Listar perdas de produto |
| ProductLossReportEndpoints | `listProduct(productId)` | `/supply/reports/product-loss/{productId}/list` | Perdas por produto |
| ProductLossReportEndpoints | `productLossDetails(productId)` | `/supply/reports/product-loss/{productId}` | Detalhes da perda |
| SeparationConfigEndpoints | `edit` | `/preferences/config/separation` | Editar configuracao de separacao |
| SeparationConfigEndpoints | `details` | `/preferences/config/separation` | Detalhes da configuracao |
| SeparationTaskEndpoints | `list` | `/supply/task/separation/list` | Listar tarefas de separacao |
| SeparationTaskEndpoints | `add(pickListId)` | `/supply/task/separation/add/{pickListId}` | Criar tarefa a partir de picklist |
| SeparationTaskEndpoints | `taskSeparationDetails(taskId)` | `/supply/task/separation/{taskId}` | Detalhes da tarefa |
| SeparationTaskEndpoints | `finish(separationId)` | `/supply/task/separation/{separationId}/finish` | Finalizar tarefa |
| SeparationTaskEndpoints | `cancel(separationId)` | `/supply/task/separation/{separationId}/cancel` | Cancelar tarefa |
| SeparationTaskEndpoints | `itemList(taskId)` | `/supply/task/separation/{taskId}/item/list` | Listar itens da tarefa |
| SeparationTaskEndpoints | `editItem(separationId, itemId)` | `/supply/task/separation/{separationId}/edit/{itemId}` | Editar item |
| SeparationTaskEndpoints | `taskSeparationHistory(taskId)` | `/supply/task/separation/{taskId}/history` | Historico da tarefa |
| SeparationTaskEndpoints | `taskSeparationItemDetails(itemId)` | `/supply/task/separation/item/{itemId}` | Detalhes do item |
| SupplyTaskEndpoints | `list` | `/supply/task/supply/list` | Listar tarefas de abastecimento |
| SupplyTaskEndpoints | `add(pickListId)` | `/supply/task/supply/add/{pickListId}` | Criar tarefa a partir de picklist |
| SupplyTaskEndpoints | `taskSupplyDetails(taskId)` | `/supply/task/supply/{taskId}` | Detalhes da tarefa |
| SupplyTaskEndpoints | `finish(supplyId)` | `/supply/task/supply/{supplyId}/finish` | Finalizar tarefa |
| SupplyTaskEndpoints | `cancel(supplyId)` | `/supply/task/supply/{supplyId}/cancel` | Cancelar tarefa |
| SupplyTaskEndpoints | `itemList(taskId)` | `/supply/task/supply/{taskId}/item/list` | Listar itens da tarefa |
| SupplyTaskEndpoints | `editItem(supplyId, itemId)` | `/supply/task/supply/{supplyId}/edit/{itemId}` | Editar item |
| SupplyTaskEndpoints | `taskSupplyHistory(taskId)` | `/supply/task/supply/{taskId}/history` | Historico da tarefa |
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
| SupplyReportEndpoints | `nfeInProductSupplier` | `/supply/reports/nfe-in/product-supplier` | Relatorio produto-fornecedor |
| SupplyReportEndpoints | `buyOrder` | `/supply/reports/buy-order` | Relatorio de pedidos de compra |
| SupplyReportEndpoints | `productLoss` | `/supply/reports/product-loss/list` | Relatorio de perdas |
| SupplyReportEndpoints | `purchaseSuggestion` | `/supply/reports/purchase-suggestion` | Sugestao de compra |
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

| Arquivo | Propriedade | Path | Descricao |
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
| NfeInEndpoints | `nextSequenceNumber` | `/supply/purchase-invoice/next-sequence` | Proximo numero sequencial |
| NfeInEndpoints | `defaultSeriesNumber` | `/supply/purchase-invoice/default-series-number` | Numero de serie padrao |
| NfeInEndpoints | `defaultTransactionNature` | `/supply/purchase-invoice/default-transaction-nature` | Natureza de operacao padrao |
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
| NfeOutEndpoints | `defaultTransactionNature` | `/sales/sales-invoice/default-transaction-nature` | Natureza de operacao padrao |
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
| NfceEndpoints | `transactionNature` | `/sales/nfce/transaction-nature` | Natureza de operacao |
| NfceEndpoints | `nextSequenceNumber` | `/sales/nfce/next-sequence` | Proximo numero sequencial |
| NfceEndpoints | `defaultSeriesNumber` | `/sales/nfce/default-series-number` | Numero de serie padrao |
| NfceEndpoints | `defaultTransactionNature` | `/sales/nfce/default-transaction-nature` | Natureza de operacao padrao |
| NfceEndpoints | `printDanfe(id)` | `/sales/nfce/print/{id}` | Imprimir DANFE |
| NfceDisableEndpoints | `list` | `/sales/nfce-disable/list` | Listar inutilizacoes |
| NfceDisableEndpoints | `add` | `/sales/nfce-disable/add` | Adicionar inutilizacao |
| NfceDisableEndpoints | `details(id)` | `/sales/nfce-disable/{id}` | Detalhes da inutilizacao |
| NfceDisableEndpoints | `delete(id)` | `/sales/nfce-disable/del/{id}` | Excluir inutilizacao |
| NfceDisableEndpoints | `cancel(id)` | `/sales/nfce-disable/cancel/{id}` | Cancelar inutilizacao |
| NfeConfigEndpoints | `edit` | `/preferences/config/nfe` | Editar configuracao NF-e |
| NfeConfigEndpoints | `details` | `/preferences/config/nfe` | Detalhes da configuracao |
| NfeConfigEndpoints | `resetSequenceNumber` | `/preferences/config/nfe/reset-sequence-number` | Resetar numero sequencial |
| NfeDistributionEndpoints | `status` | `/supply/distribution/status` | Status da distribuicao |
| NfeDistributionEndpoints | `list` | `/supply/distribution/list` | Listar documentos |
| NfeDistributionEndpoints | `import(id)` | `/supply/distribution/documents/{id}/import` | Importar documento |
| NfeDistributionEndpoints | `changeStatus(id)` | `/supply/distribution/status/{id}` | Alterar status |
| TransactionNatureEndpoints | `list` | `/preferences/transaction-nature/list` | Listar naturezas de operacao |
| TransactionNatureEndpoints | `add` | `/preferences/transaction-nature/add` | Adicionar natureza |
| TransactionNatureEndpoints | `edit(id)` | `/preferences/transaction-nature/edit/{id}` | Editar natureza |
| TransactionNatureEndpoints | `details(id)` | `/preferences/transaction-nature/{id}` | Detalhes da natureza |
| TransactionNatureEndpoints | `delete(id)` | `/preferences/transaction-nature/del/{id}` | Excluir natureza |
| TransactionNatureEndpoints | `toggleStatus(id)` | `/preferences/transaction-nature/status/{id}` | Ativar/desativar natureza |
| TransactionNatureEndpoints | `setDefault(id)` | `/preferences/transaction-nature/default/{id}` | Definir natureza padrao |
| TransactionNatureEndpoints | `deleteBatch` | `/preferences/transaction-nature/del/batch` | Excluir em lote |
| TransactionNatureEndpoints | `toggleStatusBatch` | `/preferences/transaction-nature/status/batch` | Ativar/desativar em lote |
| TaxScenarioEndpoints | `list` | `/preferences/tax-scenario/list` | Listar cenarios tributarios |
| TaxScenarioEndpoints | `add` | `/preferences/tax-scenario/add` | Adicionar cenario |
| TaxScenarioEndpoints | `edit(id)` | `/preferences/tax-scenario/edit/{id}` | Editar cenario |
| TaxScenarioEndpoints | `details(id)` | `/preferences/tax-scenario/{id}` | Detalhes do cenario |
| TaxScenarioEndpoints | `delete(id)` | `/preferences/tax-scenario/del/{id}` | Excluir cenario |
| TaxScenarioEndpoints | `toggleStatus(id)` | `/preferences/tax-scenario/status/{id}` | Ativar/desativar cenario |
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

### Contatos (5 arquivos)

| Arquivo | Propriedade | Path | Descricao |
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
| EmployeeContactEndpoints | `list` | `/registrations/employee/list` | Listar funcionarios |
| EmployeeContactEndpoints | `add` | `/registrations/employee/add` | Adicionar funcionario |
| EmployeeContactEndpoints | `edit(id)` | `/registrations/employee/edit/{id}` | Editar funcionario |
| EmployeeContactEndpoints | `details(id)` | `/registrations/employee/{id}` | Detalhes do funcionario |
| EmployeeContactEndpoints | `delete(id)` | `/registrations/employee/del/{id}` | Excluir funcionario |
| EmployeeContactEndpoints | `toggleStatus(id)` | `/registrations/employee/status/{id}` | Ativar/desativar funcionario |
| EmployeeContactEndpoints | `notificationAvailableList` | `/registrations/employee/notification/available/list` | Notificacoes disponiveis |
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

### Sistema/Configuracao (10 arquivos)

| Arquivo | Propriedade | Path | Descricao |
|---------|-------------|------|-----------|
| SystemEndpoints | `version` | `/system/version` | Versao do sistema |
| SystemEndpoints | `usage` | `/system/usage` | Uso do sistema |
| SystemEndpoints | `owner` | `/system/owner` | Proprietario do sistema |
| SystemEndpoints | `modules` | `/system/modules` | Modulos disponiveis |
| SystemEndpoints | `plan` | `/system/plan` | Plano do sistema |
| SystemEndpoints | `billing` | `/system/billing` | Cobranca do sistema |
| SystemTypeEndpoints | `list` | `/system-type/list` | Listar tipos de sistema |
| SystemTypeEndpoints | `getSystemTypeByClassName(className)` | `/system-type/{className}` | Buscar tipo por classe |
| CompanyInformationEndpoints | `edit` | `/preferences/company` | Editar dados da empresa |
| CompanyInformationEndpoints | `details` | `/preferences/company` | Detalhes da empresa |
| CertificateConfigEndpoints | `edit` | `/preferences/config/certificate` | Editar certificado digital |
| CertificateConfigEndpoints | `details` | `/preferences/config/certificate` | Detalhes do certificado |
| RegistrationConfigEndpoints | `edit` | `/preferences/config/registration` | Editar configuracao de cadastro |
| RegistrationConfigEndpoints | `details` | `/preferences/config/registration` | Detalhes da configuracao |
| UiConfigEndpoints | `edit` | `/preferences/config/ui` | Editar configuracao de interface |
| UiConfigEndpoints | `details` | `/preferences/config/ui` | Detalhes da configuracao |
| FilesPreferencesEndpoints | `edit` | `/preferences/config/file` | Editar preferencias de arquivos |
| FilesPreferencesEndpoints | `details` | `/preferences/config/file` | Detalhes das preferencias |
| CommunicationPreferencesEndpoints | `edit` | `/preferences/config/communication` | Editar preferencias de comunicacao |
| CommunicationPreferencesEndpoints | `details` | `/preferences/config/communication` | Detalhes das preferencias |
| CommunicationProviderEndpoints | `list` | `/preferences/communication-provider/list` | Listar provedores de comunicacao |
| CommunicationProviderEndpoints | `add` | `/preferences/communication-provider/add` | Adicionar provedor |
| CommunicationProviderEndpoints | `edit(id)` | `/preferences/communication-provider/edit/{id}` | Editar provedor |
| CommunicationProviderEndpoints | `details(id)` | `/preferences/communication-provider/{id}` | Detalhes do provedor |
| CommunicationProviderEndpoints | `delete(id)` | `/preferences/communication-provider/del/{id}` | Excluir provedor |
| CommunicationProviderEndpoints | `toggleStatus(id)` | `/preferences/communication-provider/status/{id}` | Ativar/desativar provedor |
| CommunicationProviderEndpoints | `listCommunicationProviderServices` | `/preferences/communication-provider/service/list` | Listar servicos de comunicacao |
| SystemNotificationPreferencesEndpoints | `edit` | `/preferences/config/notification` | Editar preferencias de notificacao |
| SystemNotificationPreferencesEndpoints | `details` | `/preferences/config/notification` | Detalhes das preferencias |
| AgentEndpoints | `chat` | `/agent/chat` | Chat com agente de IA |
| AgentEndpoints | `conversations` | `/agent/conversations` | Listar conversas do agente |
| AgentEndpoints | `conversationMessages(conversationId)` | `/agent/conversations/{conversationId}/messages` | Mensagens de uma conversa |

### Dashboard (3 arquivos)

| Arquivo | Propriedade | Path | Descricao |
|---------|-------------|------|-----------|
| DashboardFinanceEndpoints | `totalBalance` | `/dashboard/finance/total-balance` | Saldo total |
| DashboardFinanceEndpoints | `topPaymentMethods` | `/dashboard/finance/top-payment-methods/used` | Metodos de pagamento mais usados |
| DashboardFinanceEndpoints | `resume` | `/dashboard/finance/resume` | Resumo financeiro |
| DashboardFinanceEndpoints | `highBalance` | `/dashboard/finance/high-balance` | Maiores saldos |
| DashboardFinanceEndpoints | `growth` | `/dashboard/finance/growth` | Crescimento financeiro |
| DashboardFinanceEndpoints | `cashFlow` | `/dashboard/finance/cash-flow` | Fluxo de caixa |
| DashboardFinanceEndpoints | `billsToReceive` | `/dashboard/finance/bills-to-receive` | Contas a receber |
| DashboardFinanceEndpoints | `billsToPay` | `/dashboard/finance/bills-to-pay` | Contas a pagar |
| DashboardFinanceEndpoints | `receivablesAging` | `/dashboard/finance/receivables-aging` | Aging de recebiveis |
| DashboardFinanceEndpoints | `profit` | `/dashboard/finance/profit` | Lucro |
| DashboardOperationEndpoints | `warehouseTasks` | `/dashboard/operation/warehouse-task` | Tarefas de deposito |
| DashboardOperationEndpoints | `highlights` | `/dashboard/operation/highlights` | Destaques operacionais |
| DashboardOperationEndpoints | `expiringProduct` | `/dashboard/operation/expiring-product` | Produtos vencendo |
| DashboardOperationEndpoints | `productLoss` | `/dashboard/operation/product-loss` | Perdas de produto |
| DashboardOperationEndpoints | `posAvailability` | `/dashboard/operation/pos-availability` | Disponibilidade de PDV |
| DashboardSalesEndpoints | `topPaymentMethodsUsed` | `/dashboard/sales/top-payment-methods/used` | Metodos de pagamento mais usados |
| DashboardSalesEndpoints | `topPaymentMethodsReceived` | `/dashboard/sales/top-payment-methods/received` | Metodos mais recebidos |
| DashboardSalesEndpoints | `resume` | `/dashboard/sales/resume` | Resumo de vendas |
| DashboardSalesEndpoints | `peakHours` | `/dashboard/sales/peak-hours` | Horarios de pico |
| DashboardSalesEndpoints | `orders` | `/dashboard/sales/orders` | Pedidos |
| DashboardSalesEndpoints | `bestSellersProducts` | `/dashboard/sales/best-sellers/products` | Produtos mais vendidos |
| DashboardSalesEndpoints | `bestSellersCategories` | `/dashboard/sales/best-sellers/categories` | Categorias mais vendidas |
| DashboardSalesEndpoints | `averageTicket` | `/dashboard/sales/average-ticket` | Ticket medio |

### Outros (12 arquivos)

| Arquivo | Propriedade | Path | Descricao |
|---------|-------------|------|-----------|
| HomeEndpoints | `setupGuide` | `/home/setup-guide` | Guia de configuracao |
| HomeEndpoints | `announcements` | `/home/announcements` | Anuncios |
| HomeEndpoints | `news` | `/home/news` | Novidades |
| HomeEndpoints | `modules` | `/home/modules` | Modulos disponiveis |
| HomeEndpoints | `dismissFirstAccess` | `/account/first-access` | Dispensar primeiro acesso |
| ScheduleEndpoints | `list` | `/schedule/list` | Listar agendamentos |
| ScheduleEndpoints | `add` | `/schedule/add` | Criar agendamento |
| ScheduleEndpoints | `edit(id)` | `/schedule/edit/{id}` | Editar agendamento |
| ScheduleEndpoints | `details(id)` | `/schedule/{id}` | Detalhes do agendamento |
| ScheduleEndpoints | `delete(id)` | `/schedule/del/{id}` | Excluir agendamento |
| SetupEndpoints | `setup` | `/setup` | Configuracao inicial |
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
| TelemetryEndpoints | `posHealth` | `/telemetry/pos-health` | Saude dos PDVs |
| TerminalEndpoints | `list` | `/registrations/terminal/list` | Listar terminais |
| TerminalEndpoints | `add` | `/registrations/terminal/add` | Adicionar terminal |
| TerminalEndpoints | `edit(id)` | `/registrations/terminal/edit/{id}` | Editar terminal |
| TerminalEndpoints | `details(id)` | `/registrations/terminal/{id}` | Detalhes do terminal |
| TerminalEndpoints | `delete(id)` | `/registrations/terminal/del/{id}` | Excluir terminal |
| TerminalEndpoints | `editPassword(id)` | `/registrations/terminal/edit-password/{id}` | Alterar senha do terminal |
| TerminalEndpoints | `forceReboot(id)` | `/registrations/terminal/{id}/force-reboot` | Forcar reinicializacao |
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
| NotificationsEndpoints | `list` | `/notification/list` | Listar notificacoes |
| NotificationsEndpoints | `add` | `/notification/add` | Criar notificacao |
| NotificationsEndpoints | `edit(id)` | `/notification/edit/{id}` | Editar notificacao |
| NotificationsEndpoints | `details(id)` | `/notification/{id}` | Detalhes da notificacao |
| NotificationsEndpoints | `delete(id)` | `/notification/del/{id}` | Excluir notificacao |
| NotificationsEndpoints | `read(id)` | `/notification/read/{id}` | Marcar como lida |
| NotificationsEndpoints | `unread(id)` | `/notification/unread/{id}` | Marcar como nao lida |
| NotificationsEndpoints | `readAll` | `/notification/read/all` | Marcar todas como lidas |
| NotificationsEndpoints | `stream` | `/notification/stream` | Stream de notificacoes (SSE) |
| BarcodeNotFoundEndpoints | `list` | `/sales/reports/barcode-not-found` | Listar codigos de barras nao encontrados |
| BarcodeNotFoundEndpoints | `addToPlanogram` | `/sales/reports/barcode-not-found/add-to-planogram` | Adicionar ao planograma |

## Resumo

O ERP Despensinha possui **93 arquivos de endpoints** distribuidos em 11 dominios:

| Dominio | Arquivos | Endpoints |
|---------|----------|-----------|
| Auth | 1 | 6 |
| Conta/Usuarios | 5 | 44 |
| Catalogo | 5 | 46 |
| Vendas | 7 | 47 |
| Financeiro | 14 | 96 |
| Suprimentos/Estoque | 18 | 111 |
| NFe/Fiscal | 11 | 86 |
| Contatos | 5 | 36 |
| Sistema/Configuracao | 10 | 38 |
| Dashboard | 3 | 23 |
| Outros | 12 | 62 |
| **Total** | **93** | **595** |

Todos os endpoints seguem o padrao de objetos constantes exportados, com paths estaticos para operacoes sem parametros e arrow functions para paths dinamicos. Os wrappers tipados em `axios.ts` garantem que todas as chamadas retornem `ApiResponse<T>`, mantendo consistencia na camada de comunicacao.