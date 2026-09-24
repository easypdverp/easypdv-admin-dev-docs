---
title: Modelos e DTOs
description: Convencoes de modelagem de dados e catalogo completo de tipos TypeScript do Despensinha ERP.
sidebar:
  order: 6
---

A camada de modelos do Despensinha ERP define todas as interfaces e tipos TypeScript que representam a forma dos dados trafegados entre a API e a interface. Esses tipos garantem type-safety em toda a aplicacao, desde as requisicoes HTTP ate a renderizacao dos componentes React.

Todos os modelos ficam em `src/app/models/` e sao importados pelos endpoints, hooks e componentes.

## Convencoes de Nomenclatura

O ERP segue convencoes claras para nomear arquivos e tipos de modelo:

### Arquivos `*Dto.ts` — Data Transfer Objects

A maioria dos arquivos segue o padrao `*Dto.ts`. Esses tipos representam a forma dos dados enviados e recebidos da API (request/response shapes):

```typescript
// src/app/models/UserDto.ts
import { type ContactDto } from "./Contact";
import { type EnumType } from "./EnumType";
import { type UserRoleDto } from "./UserRoleDto";

export type UserDto = {
  id?: string;
  login?: string;
  google_id?: string | null;
  password?: string | null;
  active?: boolean;
  registration_date?: string;
  modification_date?: string;
  contact?: ContactDto;
  user_role?: UserRoleDto;
  accepted_notifications?: EnumType[];
};

export const initialUserEmpty = {
  password: '',
  login: '',
  accepted_notifications: [],
}
```

### Arquivos com nome simples — Entidades de dominio

Alguns arquivos usam nomes simples sem sufixo `Dto` (ex.: `Product.ts`, `Brand.ts`, `Category.ts`). Esses representam entidades de dominio usadas em multiplos contextos da aplicacao:

```typescript
// src/app/models/Brand.ts
import { type AttachmentDto } from "./Attachment";

export type BrandDto = {
  id: string | null;
  name: string;
  partner?: boolean;
  slug: string;
  description?: string;
  active?: boolean;
  registration_date?: string;
  modification_date?: string;
  logo?: AttachmentDto;
};

export const initialBrandEmpty: BrandDto = {
  name: '',
  slug: '',
  id: null,
}
```

### Convencao geral

- **PascalCase** para nomes de arquivo e tipo exportado (ex.: `ProductDto.ts` exporta `ProductDto`)
- Sufixo `Dto` indica transferencia de dados com a API
- Sufixo `Filter` indica parametros de busca/filtragem
- Sufixo `RequestDto` indica payload de requisicao especifico
- Sufixo `ResponseDto` indica formato de resposta especifico
- Prefixo `initial*Empty` para valores iniciais de formularios

## Estrutura de Diretorios

```
src/app/models/
├── AcceptInvitationRequestDto.ts
├── AccessCredentialsDto.ts
├── ...                          # ~200 arquivos de modelo no raiz
├── filters/                     # Tipos de filtro para listagens
│   ├── PlanogramFilter.ts
│   ├── PointOfSaleFilter.ts
│   ├── SupplyTaskFilter.ts
│   ├── UserRoleFilter.ts
│   └── WarehouseEntryFilter.ts
└── reports/                     # Tipos especificos de relatorios
    ├── finance/
    │   └── FinanceReportDtos.ts  # 10 tipos (BalanceSheet, ProfitAndLoss, CashFlow, etc.)
    ├── sales/
    │   ├── CashierReportDto.ts
    │   ├── InvoiceReportDtos.ts  # 12 tipos (consultas por produto, CFOP, cliente, ICMS)
    │   ├── SalesFinanceReportDto.ts
    │   └── TransactionReportDto.ts
    └── supply/
        ├── BuyOrderReportDto.ts
        ├── InventoryReportDtos.ts  # 14 tipos (entrada/saida, saldo, movimentacao, etc.)
        ├── NfeInReportDtos.ts      # 10 tipos (operacao, fornecedor, produto, progresso)
        ├── ProductLossReportDtos.ts
        └── PurchaseSuggestionReportDtos.ts
```

- **Raiz** (`src/app/models/`): contem a grande maioria dos modelos (~200 arquivos)
- **`filters/`**: tipos usados como parametros de filtragem em endpoints de listagem
- **`reports/`**: tipos de dados e filtros para telas de relatorios, organizados por dominio (finance, sales, supply)

## Padroes de Tipagem

### `export type` (padrao predominante)

A grande maioria dos modelos usa `export type`:

```typescript
// Tipo com campos opcionais e obrigatorios
export type ProductDto = {
  id?: string;
  sku: string;
  description: string;
  price: number | null;
  active?: boolean;
  gtin_ean: string;
  brand?: BrandDto;
  ncm?: NcmDto;
  category?: CategoryDto;
  tax_scenarios?: TaxScenarioDto[];
};
```

### Tipo utilitario generico

Alguns tipos sao genericos reutilizaveis:

```typescript
// src/app/models/SelectOption.ts
export type SelectOption<T> = {
  value: string | undefined;
  label: string | undefined;
  data: T;
}
```

### Tipo enum simulado

O padrao `EnumType` e usado extensivamente para representar enums do backend:

```typescript
// src/app/models/EnumType.ts
export type EnumType = {
  value: string,
  description: string,
  extra?: string
}
```

### Tipo de paginacao

Respostas paginadas usam o tipo `Pageable`:

```typescript
// src/app/models/Pageable.ts
export type Pageable = {
  page_number: number;
  page_size: number;
  sort: { empty: boolean; sorted: boolean; unsorted: boolean };
  offset: number;
  paged: boolean;
  unpaged: boolean;
};
```

### Valores iniciais para formularios

Muitos DTOs exportam um objeto `initial*Empty` usado como estado inicial em formularios React:

```typescript
export const initialProductDtoEmpty: ProductDto = {
  sku: '',
  description: '',
  gtin_ean: '',
  slug: '',
  active: true,
  adult: false,
  items_per_conversion_unit: 1,
  price: null,
}
```

### Convencoes de campos

- Campos opcionais marcados com `?`
- Datas como `string` (formato ISO)
- IDs como `string` (UUID)
- Valores monetarios como `number`
- Enums do backend como `EnumType` (objeto `{value, description}`)
- Relacionamentos como tipos importados (ex.: `brand?: BrandDto`)

## Catalogo de Modelos

### Autenticacao e Usuarios

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `AccessCredentialsDto.ts` | type | Credenciais de login (email, senha) |
| `JWTPayload.ts` | type | Payload decodificado do token JWT |
| `PasswordRecovery.ts` | type | Dados para recuperacao de senha |
| `UserDto.ts` | type | Dados completos do usuario |
| `UserChangeEmailRequestDto.ts` | type | Requisicao de alteracao de email |
| `UserChangePasswordRequestDto.ts` | type | Requisicao de alteracao de senha |
| `UserLoginSessionDto.ts` | type | Dados da sessao de login |
| `UserRefreshTokenResponseDto.ts` | type | Resposta de refresh token |
| `UserRole.ts` | type | Papel/perfil do usuario |
| `UserRoleDto.ts` | type | DTO de papel com permissoes |
| `PermissionDto.ts` | type | Permissao individual |
| `AcceptInvitationRequestDto.ts` | type | Requisicao para aceitar convite |
| `InvitationDto.ts` | type | Dados de convite de usuario |
| `InvitationValidationResponseDto.ts` | type | Resposta de validacao de convite |

### Catalogo de Produtos

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `Product.ts` | type | Entidade completa de produto (30+ campos) |
| `Brand.ts` | type | Marca com logo e slug |
| `Category.ts` | type | Categoria de produto |
| `Ncm.ts` | type | Codigo NCM (Nomenclatura Comum do Mercosul) |
| `Cest.ts` | type | Codigo CEST (Especificador da Substituicao Tributaria) |
| `Cfop.ts` | type | Codigo Fiscal de Operacoes e Prestacoes |
| `ConversionUnitDto.ts` | type | Unidade de conversao (cx, pct, etc.) |
| `Dimension.ts` | type | Dimensoes do produto |
| `MetaTag.ts` | type | Meta tags para SEO/exibicao |
| `ProductLookupResultDto.ts` | type | Resultado de consulta de produto (codigo de barras) |
| `ProductPriceHistoryDto.ts` | type | Historico de preco do produto |
| `ProductSupplierDto.ts` | type | Relacao produto-fornecedor |
| `ProductSupplierPriceHistoryDto.ts` | type | Historico de preco por fornecedor |
| `ProductProvider.ts` | type | Provider de produto |
| `PriceList.ts` | type | Lista de precos |
| `Coupon.ts` | type | Cupom de desconto |
| `CouponUsageCounterDto.ts` | type | Contador de uso de cupom |
| `Promotion.ts` | type | Promocao |
| `TagDto.ts` | type | Tag/etiqueta de produto |
| `TagTemplateDto.ts` | type | Template de etiqueta para impressao |

### Vendas e Pedidos

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `OrderDto.ts` | type | Pedido de venda completo |
| `OrderItemDto.ts` | type | Item de pedido |
| `OrderInstallmentDto.ts` | type | Parcela de pedido |
| `OrderCurrenceDto.ts` | type | Ocorrencia/evento de pedido |
| `SalesOrderDto.ts` | type | Pedido de venda (formato resumido) |
| `SalesOrderHistoryDto.ts` | type | Historico de pedido |
| `SalesOrderReportDto.ts` | type | Dados de relatorio de vendas |
| `SalesOrderReportFilterDto.ts` | type | Filtro para relatorio de vendas |
| `SalesOrderChartDto.ts` | type | Dados para grafico de vendas |
| `SalesOrderChartItemDto.ts` | type | Item individual do grafico |
| `SalesResumeDto.ts` | type | Resumo de vendas do dashboard |
| `SaleOrderConfig.ts` | type | Configuracoes de pedido de venda |
| `SaleOrderTotalsDto.ts` | type | Totais do pedido |
| `PaymentDto.ts` | type | Pagamento de pedido |
| `InstallmentDto.ts` | type | Parcela de pagamento |
| `TransactionMethodDto.ts` | type | Metodo de transacao (dinheiro, cartao, etc.) |
| `PointOfSale.ts` | type | Ponto de venda (PDV) |
| `PosStatusResumeDto.ts` | type | Status resumido do PDV |
| `TerminalDto.ts` | type | Terminal de pagamento |
| `TerminalPasswordEditRequestDto.ts` | type | Requisicao de alteracao de senha do terminal |

### Financeiro

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `FinancialEntryDto.ts` | type | Lancamento financeiro |
| `FinancialAccountDto.ts` | type | Conta financeira |
| `FinancialAccountHighestBalanceDto.ts` | type | Conta com maior saldo |
| `FinancialBalanceDto.ts` | type | Saldo de conta financeira |
| `FinancialCategory.ts` | type | Categoria financeira |
| `FinancialCategoryGroupDto.ts` | type | Grupo de categorias financeiras |
| `FinanceResumeDto.ts` | type | Resumo financeiro do dashboard |
| `BankAccountDto.ts` | type | Conta bancaria |
| `BankDto.ts` | type | Banco |
| `BillDto.ts` | type | Conta a pagar/receber |
| `BillChartDto.ts` | type | Dados para grafico de contas |
| `BillChartItemDto.ts` | type | Item do grafico de contas |
| `BillsToPayTotalsDto.ts` | type | Totais de contas a pagar |
| `CompetenceTotalsDto.ts` | type | Totais por competencia |
| `CashFlowChartDto.ts` | type | Dados do grafico de fluxo de caixa |
| `CashFlowChartItemDto.ts` | type | Item do grafico de fluxo de caixa |
| `CashFlowTotalsDto.ts` | type | Totais do fluxo de caixa |
| `MonthlyMovementDto.ts` | type | Movimentacao mensal |
| `ProfitChartDto.ts` | type | Dados do grafico de lucro |
| `ProfitChartItemDto.ts` | type | Item do grafico de lucro |
| `ReceivablesAgingDto.ts` | type | Aging de recebiveis |
| `GatewayDto.ts` | type | Gateway de pagamento |
| `GatewayModelDto.ts` | type | Modelo de gateway |
| `GatewayPaymentMethodFeeDto.ts` | type | Taxa por metodo de pagamento |

### Suprimentos e Estoque

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `Inventory.ts` | type | Estoque/deposito |
| `InventoryConfigDto.ts` | type | Configuracoes de estoque |
| `InventoryHasProductDto.ts` | type | Relacao estoque-produto |
| `InventoryStockBreakdownDto.ts` | type | Detalhamento de estoque |
| `InventoryTaskCreateRequestDto.ts` | type | Requisicao para criar tarefa de estoque |
| `ProductInventoryAlertDto.ts` | type | Alerta de estoque de produto |
| `ProductInventoryControlDto.ts` | type | Controle de estoque de produto |
| `ProductInventoryControlDetailRequestDto.ts` | type | Detalhes de controle de estoque |
| `ProductInventoryControlRequestDto.ts` | type | Requisicao de controle de estoque |
| `ProductInventoryDetailsDto.ts` | type | Detalhes de inventario de produto |
| `ProductInventoryReserveDto.ts` | type | Reserva de estoque |
| `ExpiringProductDto.ts` | type | Produto proximo do vencimento |
| `BuyOrderDto.ts` | type | Pedido de compra |
| `BuyOrderConfigDto.ts` | type | Configuracao de pedido de compra |
| `BuyOrderTotalsDto.ts` | type | Totais do pedido de compra |
| `SupplierDto.ts` | type | Fornecedor |
| `Provider.ts` | type | Provider/fornecedor |
| `SupplyType.ts` | type | Tipo de suprimento |
| `WarehouseEntryDto.ts` | type | Entrada no deposito |
| `WarehouseEntryBatchDto.ts` | type | Lote de entrada no deposito |
| `WarehouseEntryLaunchDto.ts` | type | Lancamento de entrada |
| `WarehouseEntryLaunchItemDto.ts` | type | Item de lancamento de entrada |
| `WarehouseBatchDto.ts` | type | Lote de deposito |
| `WarehouseTaskDto.ts` | type | Tarefa de deposito |
| `WarehouseTaskHistoryDto.ts` | type | Historico de tarefa |
| `WarehouseTaskItemDto.ts` | type | Item de tarefa de deposito |
| `WarehouseTaskItemBatchDto.ts` | type | Lote de item de tarefa |
| `WarehouseTaskItemRemovalDto.ts` | type | Remocao de item de tarefa |
| `WarehouseTaskTypeRequestDto.ts` | type | Requisicao de tipo de tarefa |
| `WarehouseTransferDto.ts` | type | Transferencia entre depositos |
| `SeparationConfigDto.ts` | type | Configuracao de separacao |
| `PickListCreateRequestDto.ts` | type | Requisicao para criar pick list |
| `PickListDto.ts` | type | Pick list |
| `PickListItemDto.ts` | type | Item da pick list |

### Fiscal e NF-e

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `NfceDto.ts` | type | Nota Fiscal de Consumidor Eletronica |
| `NfceDisableDto.ts` | type | Dados para inutilizacao de NFC-e |
| `NfeDto.ts` | type | Nota Fiscal Eletronica |
| `NfeConfigDto.ts` | type | Configuracao de NF-e |
| `NfeInDto.ts` | type | NF-e de entrada |
| `NfeOutDto.ts` | type | NF-e de saida |
| `NfeItemDto.ts` | type | Item de NF-e |
| `NfeInstallmentDto.ts` | type | Parcela de NF-e |
| `NfeTotalsDto.ts` | type | Totais da NF-e |
| `NfeCounterpartDto.ts` | type | Contraparte da NF-e (emitente/destinatario) |
| `NfeOccurrenceDto.ts` | type | Ocorrencia/evento de NF-e |
| `NfeDistributionDocumentDto.ts` | type | Documento de distribuicao DF-e |
| `NfeDistributionStatusDto.ts` | type | Status de distribuicao DF-e |
| `CertificateConfig.ts` | type | Configuracao de certificado digital |
| `TransactionNatureDto.ts` | type | Natureza da operacao |
| `TransactionNatureCofinsExceptionDto.ts` | type | Excecao COFINS |
| `TransactionNatureIcmsExceptionDto.ts` | type | Excecao ICMS |
| `TransactionNatureIpiExceptionDto.ts` | type | Excecao IPI |
| `TransactionNatureIssqnExceptionDto.ts` | type | Excecao ISSQN |
| `TransactionNaturePisExceptionDto.ts` | type | Excecao PIS |
| `TransactionNatureSimplesExceptionDto.ts` | type | Excecao Simples Nacional |
| `TaxScenario.ts` | type | Cenario tributario |

### Contatos e Comunicacao

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `Contact.ts` | type | Contato (cliente/fornecedor) |
| `PersonOfContactDto.ts` | type | Pessoa de contato |
| `Address.ts` | type | Endereco |
| `AddressDto.ts` | type | DTO de endereco |
| `Notification.ts` | type | Notificacao |
| `NotificationDto.ts` | type | DTO de notificacao |
| `NotificationHasUserDto.ts` | type | Relacao notificacao-usuario |
| `CommunicationConfigDto.ts` | type | Configuracao de comunicacao |
| `CommunicationProviderDto.ts` | type | Provider de comunicacao (email, SMS) |
| `CommunicationProviderModelDto.ts` | type | Modelo de provider de comunicacao |

### Dashboard e Graficos

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `AverageTicketChartDto.ts` | type | Dados do grafico de ticket medio |
| `AverageTicketChartItemDto.ts` | type | Item do grafico de ticket medio |
| `BestSellerCategoryDto.ts` | type | Categoria mais vendida |
| `BestSellerHourDto.ts` | type | Horario de pico de vendas |
| `BestSellerPaymentMethodDto.ts` | type | Metodo de pagamento mais usado |
| `BestSellerProductDto.ts` | type | Produto mais vendido |
| `OperationsHighlightResumeDto.ts` | type | Resumo de destaques operacionais |

### Planograma

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `Planogram.ts` | type | Planograma |
| `PlanogramCreateRequestDto.ts` | type | Requisicao de criacao de planograma |
| `PlanogramItemDto.ts` | type | Item de planograma |
| `ProductPlanogramItemDto.ts` | type | Produto em item de planograma |
| `ProductPlanogramSummaryDto.ts` | type | Resumo de produto no planograma |

### Telemetria e PDV

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `TelemetryPosDto.ts` | type | Dados de telemetria do PDV |
| `TelemetryPosHealthDto.ts` | type | Saude do PDV |
| `TelemetryResumeDto.ts` | type | Resumo de telemetria |
| `TelemetryPosFilter.ts` | type | Filtro de telemetria |
| `TelemetryAlertFilter.ts` | type | Filtro de alertas de telemetria |
| `TelemetrySalesRequestDto.ts` | type | Requisicao de dados de vendas por telemetria |
| `SearchRequestDtoTelemetryAlertFilter.ts` | type | Filtro de busca para alertas |
| `AlertDto.ts` | type | Alerta do sistema |

### Perdas de Produto

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `ProductLossHighlightDto.ts` | type | Destaque de perda de produto |
| `ProductLossOccurrenceDto.ts` | type | Ocorrencia de perda |
| `ProductLossReportDto.ts` | type | Relatorio de perdas |
| `ProductLossReportFilter.ts` | type | Filtro de relatorio de perdas |
| `BarcodeNotFoundReportDto.ts` | type | Relatorio de codigos de barras nao encontrados |
| `BarcodeNotFoundReportFilterDto.ts` | type | Filtro do relatorio de codigos nao encontrados |

### Sistema e Configuracao

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `CompanyDto.ts` | type | Dados da empresa |
| `AccountDetailsDto.ts` | type | Detalhes da conta |
| `AdminAccountDetailsDto.ts` | type | Detalhes da conta admin |
| `AccountantDto.ts` | type | Dados do contador |
| `SystemBillingDto.ts` | type | Faturamento do sistema |
| `SystemModulesDto.ts` | type | Modulos do sistema |
| `SystemNotificationConfigDto.ts` | type | Configuracao de notificacoes do sistema |
| `SystemOwnerDto.ts` | type | Proprietario do sistema |
| `SystemRegistrationConfigDto.ts` | type | Configuracao de registro |
| `SystemStorageDetailsDto.ts` | type | Detalhes de armazenamento |
| `SystemTypeDto.ts` | type | Tipo de sistema |
| `SystemUsageDto.ts` | type | Uso do sistema |
| `SystemUserDto.ts` | type | Usuario do sistema (admin) |
| `SubscriptionPlanDto.ts` | type | Plano de assinatura |
| `SetupRequestDto.ts` | type | Requisicao de setup inicial |
| `UiConfigDto.ts` | type | Configuracao de interface |
| `FileConfigDto.ts` | type | Configuracao de arquivos |
| `LockDto.ts` | type | Bloqueio de recurso |
| `OperationDto.ts` | type | Operacao do sistema |
| `OperationCenterDto.ts` | type | Centro de operacoes |

### Utilitarios e Compartilhados

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `EnumType.ts` | type | Tipo enum generico (value + description) |
| `Pageable.ts` | type | Paginacao de respostas |
| `ListData.ts` | type | Wrapper de lista paginada |
| `SelectOption.ts` | type | Opcao de select generico |
| `DataTableColumnDef.ts` | type | Definicao de coluna de DataTable |
| `DataTableFilter.ts` | type | Filtro de DataTable |
| `DatesRequestDto.ts` | type | Requisicao com datas (inicio/fim) |
| `PeriodRequestDto.ts` | type | Requisicao de periodo |
| `LocalTime.ts` | type | Representacao de hora local |
| `StrategyType.ts` | type | Tipo de estrategia |
| `Attachment.ts` | type | Anexo/arquivo |
| `PendingAttachment.ts` | type | Anexo pendente de upload |
| `AppoitmentDto.ts` | type | Agendamento |
| `FeedbackDto.ts` | type | Feedback |
| `FeedbackQuestionDto.ts` | type | Pergunta de feedback |
| `FeedbackAlternativeDto.ts` | type | Alternativa de feedback |
| `RatingDto.ts` | type | Avaliacao |

## Filtros

Tipos de filtro ficam em `src/app/models/filters/` e sao usados como parametros de busca em endpoints de listagem:

| Arquivo | Descricao |
|---------|-----------|
| `PlanogramFilter.ts` | Filtro por ponto de venda para planogramas |
| `PointOfSaleFilter.ts` | Filtro de PDVs (com planograma, comunidade, principal) |
| `SupplyTaskFilter.ts` | Filtro de tarefas de suprimento por status |
| `UserRoleFilter.ts` | Filtro de perfis por tipo (sistema ou customizado) |
| `WarehouseEntryFilter.ts` | Filtro de entradas por tipo, data e estoque |

## Relatorios

Tipos de relatorio ficam em `src/app/models/reports/` organizados por dominio. Cada arquivo tipicamente exporta um tipo de dados (`*Dto`) e um tipo de filtro (`*FilterDto`):

### Financeiro (`reports/finance/`)

| Arquivo | Tipos Exportados | Descricao |
|---------|-----------------|-----------|
| `FinanceReportDtos.ts` | `BalanceSheetDto`, `BalanceSheetFilterDto`, `ProfitAndLossDto`, `ProfitAndLossFilterDto`, `CashFlowReportDto`, `CashFlowReportFilterDto`, `FinanceCategoryReportDto`, `FinanceCategoryReportFilterDto`, `FinanceCustomerReportDto`, `FinanceCustomerReportFilterDto`, `PayablesReportDto`, `PayablesReportFilterDto`, `ReceivablesReportDto`, `ReceivablesReportFilterDto`, `PaymentReceivedReportDto`, `PaymentReceivedReportFilterDto` | Relatorios financeiros: balanco patrimonial, DRE, fluxo de caixa, por categoria, por cliente, contas a pagar/receber, pagamentos recebidos |

### Vendas (`reports/sales/`)

| Arquivo | Tipos Exportados | Descricao |
|---------|-----------------|-----------|
| `CashierReportDto.ts` | `CashierReportDto`, `CashierReportFilterDto` | Relatorio de caixa (abertura, fechamento, vendas, sangrias, suprimentos) |
| `InvoiceReportDtos.ts` | `InvoiceProductQueryDto`, `InvoiceProductQueryFilterDto`, `InvoiceOperationDto`, `InvoiceOperationFilterDto`, `InvoiceCustomerDto`, `InvoiceCustomerFilterDto`, `InvoiceProductDto`, `InvoiceProductFilterDto`, `InvoiceProgressDto`, `InvoiceProgressFilterDto`, `InvoiceIcmsDto`, `InvoiceIcmsFilterDto` | Relatorios de notas fiscais: consulta por produto, por CFOP, por cliente, progresso, ICMS |
| `SalesFinanceReportDto.ts` | `SalesFinanceReportDto`, `SalesFinanceReportFilterDto` | Relatorio financeiro de vendas (receita, custo, margem, markup) |
| `TransactionReportDto.ts` | `TransactionReportDto`, `TransactionReportFilterDto` | Relatorio de transacoes (movimentacoes de caixa) |

### Suprimentos (`reports/supply/`)

| Arquivo | Tipos Exportados | Descricao |
|---------|-----------------|-----------|
| `BuyOrderReportDto.ts` | `BuyOrderReportDto`, `BuyOrderReportFilterDto` | Relatorio de pedidos de compra |
| `InventoryReportDtos.ts` | `InventoryInOutDto`, `InventoryInOutFilterDto`, `InventoryBalanceDto`, `InventoryBalanceFilterDto`, `InventoryMovementDto`, `InventoryMovementFilterDto`, `InventoryNoMovementDto`, `InventoryNoMovementFilterDto`, `InventoryBelowMinDto`, `InventoryBelowMinFilterDto`, `InventoryFinanceDto`, `InventoryFinanceFilterDto`, `InventoryUsageDto`, `InventoryUsageFilterDto` | Relatorios de estoque: entrada/saida, saldo, movimentacao, sem movimento, abaixo do minimo, financeiro, consumo |
| `NfeInReportDtos.ts` | `NfeInOperationDto`, `NfeInOperationFilterDto`, `NfeInSupplierDto`, `NfeInSupplierFilterDto`, `NfeInProductDto`, `NfeInProductFilterDto`, `NfeInProgressDto`, `NfeInProgressFilterDto`, `NfeInProductSupplierDto`, `NfeInProductSupplierFilterDto` | Relatorios de NF-e de entrada: por operacao, fornecedor, produto, progresso, produto-fornecedor |
| `ProductLossReportDtos.ts` | `ProductLossDto`, `ProductLossFilterDto` | Relatorio de perdas de produto |
| `PurchaseSuggestionReportDtos.ts` | `PurchaseSuggestionDto`, `PurchaseSuggestionFilterDto` | Sugestao de compra (estoque ideal, cobertura, custo estimado) |

## Resumo

O diretorio de modelos contem **210 arquivos** no total, distribuidos da seguinte forma:

| Dominio | Arquivos |
|---------|----------|
| Autenticacao e Usuarios | 14 |
| Catalogo de Produtos | 20 |
| Vendas e Pedidos | 20 |
| Financeiro | 24 |
| Suprimentos e Estoque | 33 |
| Fiscal e NF-e | 22 |
| Contatos e Comunicacao | 10 |
| Dashboard e Graficos | 7 |
| Planograma | 5 |
| Telemetria e PDV | 8 |
| Perdas de Produto | 6 |
| Sistema e Configuracao | 20 |
| Utilitarios e Compartilhados | 16 |
| **Subtotal raiz** | **205** |
| Filtros (`filters/`) | 5 |
| Relatorios (`reports/`) | ~50 tipos em 10 arquivos |
| **Total de arquivos** | **~220** |

:::note
Os arquivos em `reports/` exportam multiplos tipos cada, totalizando ~50 tipos de relatorio distribuidos em 10 arquivos. A contagem de 210 refere-se aos arquivos `.ts` no diretorio raiz (200 arquivos .ts + 2 subdiretorios filters/ e reports/ contabilizados pelo sistema de arquivos). Os 5 filtros e 10 arquivos de relatorio sao adicionais.
:::
