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
├── ...                          # ~340 arquivos de modelo no raiz
├── filters/                     # Tipos de filtro para listagens
│   ├── CompanyFilter.ts
│   ├── FinancialAccountFilter.ts
│   ├── PlanogramFilter.ts
│   ├── PointOfSaleFilter.ts
│   ├── SalesOccurrenceFilter.ts
│   ├── SupplyTaskFilter.ts
│   ├── UserRoleFilter.ts
│   └── WarehouseEntryFilter.ts
└── reports/
    └── finance/
        └── FinanceReportDtos.ts  # 4 tipos (FinanceCategoryReport, FinanceCustomerReport, com filtros)
```

- **Raiz** (`src/app/models/`): contem a grande maioria dos modelos (~340 arquivos)
- **`filters/`**: tipos usados como parametros de filtragem em endpoints de listagem
- **`reports/`**: a maioria dos tipos de relatorio (finance, sales, supply) esta em arquivos individuais no raiz — um arquivo por DTO, filtro e totais. Só o relatorio por categoria e por cliente do financeiro (`FinanceCategoryReportDto`, `FinanceCustomerReportDto`) fica agrupado em `reports/finance/FinanceReportDtos.ts`.

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
| `SalesOrderDto.ts` | type | Pedido de venda (formato resumido); venda cancelada sem pagamento aprovado traz `not_completed_reason?: EnumType \| null` com o motivo da venda nao concluida |
| `SalesOrderHistoryDto.ts` | type | Historico de pedido |
| `SalesOrderReportDto.ts` | type | Linha do relatorio de vendas, agrupavel por produto, categoria, cliente, PDV, dia, mes, promocao ou cupom (ver `SalesOrderReportGroupBy`) |
| `SalesOrderReportFilterDto.ts` | type | Filtro para relatorio de vendas, com `group_by: EnumType` e `company_ids?: string[]` |
| `SalesOrderReportSummaryDto.ts` | type | Totais do filtro inteiro do relatorio de vendas (`additional_content.summary`) |
| `SalesOrderChartDto.ts` | type | Dados para grafico de vendas |
| `SalesOrderChartItemDto.ts` | type | Item individual do grafico |
| `SalesResumeDto.ts` | type | Resumo de vendas do dashboard |
| `SaleOrderConfig.ts` | type | Configuracoes de pedido de venda |
| `SaleOrderTotalsDto.ts` | type | Totais do pedido |
| `PaymentDto.ts` | type | Pagamento de pedido |
| `InstallmentDto.ts` | type | Parcela de pagamento |
| `TransactionMethodDto.ts` | type | Metodo de transacao (dinheiro, cartao, etc.) |
| `PointOfSale.ts` | type | Ponto de venda (PDV); traz a empresa do PDV em `company?: CompanySummaryDto` |
| `PosStatusResumeDto.ts` | type | Status resumido do PDV |
| `TerminalDto.ts` | type | Terminal de pagamento |
| `TerminalPasswordEditRequestDto.ts` | type | Requisicao de alteracao de senha do terminal |
| `PointOfSaleConversionReportDto.ts` | type | Conversao do PDV: contagem por etapa (iniciada, concluida, abandonada no carrinho/pagamento, pagamento negado) e taxa de conversao |
| `PointOfSaleConversionReportFilterDto.ts` | type | Filtro da conversao do PDV, com agrupamento por `PointOfSaleConversionGroupByType` (PDV, adquirente, forma de pagamento, dia da semana × hora) |

### Financeiro

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `FinancialEntryDto.ts` | type | Lancamento financeiro |
| `FinancialAccountDto.ts` | type | Conta financeira; traz a empresa dela em `company?: CompanySummaryDto` |
| `FinancialAccountHighestBalanceDto.ts` | type | Conta com maior saldo |
| `FinancialBalanceDto.ts` | type | Saldo de conta financeira |
| `FinancialCategory.ts` | type | Categoria financeira |
| `FinancialCategoryGroupDto.ts` | type | Grupo de categorias financeiras |
| `FinanceResumeDto.ts` | type | Resumo financeiro do dashboard |
| `BankAccountDto.ts` | type | Conta bancaria; traz a empresa dela em `company?: CompanySummaryDto` |
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
| `Inventory.ts` | type | Estoque/deposito; traz a empresa dele em `company?: CompanySummaryDto` |
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
| `BuyOrderDto.ts` | type | Pedido de compra; traz a empresa compradora em `company?: CompanySummaryDto` (so informada na criacao, fixa na edicao) |
| `BuyOrderConfigDto.ts` | type | Configuracao de pedido de compra, com as opcoes de documento e os templates de envio ao fornecedor |
| `BuyOrderTotalsDto.ts` | type | Totais do pedido de compra |
| `BuyOrderDocumentDto.ts` | type | Documento gerado do pedido de compra para envio ao fornecedor (PDF ou outro formato) |
| `BuyOrderDocumentOptionsDto.ts` | type | Colunas e opcoes de layout do documento do pedido |
| `BuyOrderDocumentRequestDto.ts` | type | Requisicao para gerar o documento do pedido |
| `BuyOrderDocumentEmailRequestDto.ts` | type | Requisicao para enviar o documento do pedido por e-mail |
| `BuyOrderDocumentEmailResultDto.ts` | type | Resultado do envio por e-mail |
| `GenerateBuyOrderPayload.ts` | type | Payload para gerar um pedido de compra a partir da necessidade de compra |
| `GenerateBuyOrdersPayload.ts` | type | Payload para gerar varios pedidos de compra de uma vez |
| `GeneratedBuyOrderDto.ts` | type | Pedido de compra gerado a partir da necessidade de compra |
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
| `ProductLossOccurrenceFilter.ts` | type | Filtro de ocorrencias de perda |
| `ProductLossReportDto.ts` | type | Relatorio de perdas |
| `ProductLossReportFilter.ts` | type | Filtro de relatorio de perdas |
| `ProductLossReportTotalsDto.ts` | type | Totais do relatorio de perdas |
| `ProductLossTypeTotalsDto.ts` | type | Totais por tipo de perda |
| `BarcodeNotFoundReportDto.ts` | type | Relatorio de codigos de barras nao encontrados |
| `BarcodeNotFoundReportFilterDto.ts` | type | Filtro do relatorio de codigos nao encontrados |

### Sistema e Configuracao

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `CompanyDto.ts` | type | Dados completos da empresa (Preferências › Empresas), com o contador em `accountant?: AccountantDto` |
| `CompanySummaryDto.ts` | type | Empresa resumida (`id`, `social_name`, `fantasy_name`, `cnpj`), usada como referencia em outros DTOs (`company?: CompanySummaryDto`) |
| `CompanyBillingDto.ts` | type | Dados de cobranca de uma empresa faturada (pessoa, documento, regime tributario, endereco) |
| `BilledCompanyDto.ts` | type | Empresa faturavel referenciada em `CompanyBillingDto.company` |
| `AccountDetailsDto.ts` | type | Detalhes da conta |
| `AdminAccountDetailsDto.ts` | type | Detalhes da conta admin |
| `AccountantDto.ts` | type | Dados do contador; listado e criado por modal no cadastro da empresa (`AccountantEndpoints`) |
| `SystemModulesDto.ts` | type | Modulos do sistema |
| `SystemNotificationConfigDto.ts` | type | Configuracao de notificacoes do sistema |
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
| `CompanyFilter.ts` | Filtro de empresas por id (`company_ids`) e por rotulo (`company_labels`) |
| `FinancialAccountFilter.ts` | Filtro de contas financeiras por status e por empresa (`company_ids`) |
| `PlanogramFilter.ts` | Filtro por ponto de venda para planogramas |
| `PointOfSaleFilter.ts` | Filtro de PDVs (com planograma, comunidade, principal e empresa, `company_ids`) |
| `SupplyTaskFilter.ts` | Filtro de tarefas de suprimento por status |
| `UserRoleFilter.ts` | Filtro de perfis por tipo (sistema ou customizado) |
| `WarehouseEntryFilter.ts` | Filtro de entradas por tipo, data e estoque |

### Filtro multiempresa

Telas e relatorios que aceitam mais de uma empresa no filtro usam o campo `company_ids?: string[]` (um array de ids, nunca um `companyId` unico). O campo aparece em `CompanyFilter`, `FinancialAccountFilter`, `PointOfSaleFilter` e na maioria dos `*FilterDto` de relatorio (`SalesOrderReportFilterDto`, `BuyOrderReportFilterDto`, `ShrinkageReportFilterDto`, `ProfitAndLossFilterDto`, `PaymentsReceivedReportFilterDto`, `PointOfSaleConversionReportFilterDto`, `PointOfSaleResultReportFilterDto`, `InventoryWithoutMovementFilterDto`, entre outros). Nos DTOs de cadastro, a empresa do registro aparece como `company?: CompanySummaryDto` (ver a tabela de Sistema e Configuracao) em `PointOfSaleDto` (campo `company`), `InventoryDto` (deposito/estoque), `BuyOrderDto`, `FinancialAccountDto` e `BankAccountDto`.

### Filtro de faixa de valor

Os filtros de pedido de venda e de ordem de compra enviam uma faixa de valor como dois campos separados, `min_amount?: number` e `max_amount?: number`, em vez de um filtro de valor exato. O componente de interface (`AmountRangeFilter`, em `src/app/components/inputs/AmountRangeFilter/`) usa o tipo auxiliar `AmountRange`:

```typescript
// src/app/components/inputs/AmountRangeFilter/core/_models.ts
export type AmountRange = {
  min?: number;
  max?: number;
};
```

## Relatorios

A maioria dos tipos de relatorio vive em arquivos individuais no raiz de `src/app/models/` — um arquivo por DTO de linha, por filtro e por totais (ex.: `ShrinkageReportDto.ts` e `ShrinkageReportFilterDto.ts`). Só o relatorio por categoria e por cliente do financeiro fica agrupado em `src/app/models/reports/finance/FinanceReportDtos.ts`. Cada relatorio segue o padrao `*ReportDto` (linha), `*ReportFilterDto` (filtro) e, quando o backend devolve totais do filtro inteiro, `*ReportTotalsDto` ou `*SummaryDto`.

### Financeiro

| Arquivo | Descricao |
|---------|-----------|
| `BalanceSheetReportDto.ts` / `BalanceSheetReportFilterDto.ts` / `BalanceSheetReportTotalsDto.ts` | Saldos por conta financeira: saldo anterior, entradas, saidas, ajustes e saldo final |
| `ProfitAndLossDto.ts` / `ProfitAndLossFilterDto.ts` | DRE por linha (`code`, `level: 'LINE' \| 'DETAIL' \| 'SUBTOTAL'`); o filtro tem `compare_months?: boolean` para comparar meses do periodo, com `months?: ProfitAndLossMonthAmountDto[]` em cada linha |
| `ProfitAndLossMonthAmountDto.ts` | Valor e percentual da linha da DRE num mes, usado quando a comparacao mensal esta ativa |
| `ProfitAndLossAdditionalContentDto.ts` | Subtotais e avisos da DRE calculados no backend |
| `CashFlowReportDto.ts` / `CashFlowReportFilterDto.ts` / `CashFlowReportTotalsDto.ts` | Fluxo de caixa com saldos reais |
| `BillInstallmentReportDto.ts` / `BillInstallmentReportFilterDto.ts` / `BillInstallmentReportTotalsDto.ts` | Contas a pagar/receber por parcela, com status, aging (`aging_bucket`) e totais |
| `AgingBucketTotalDto.ts` | Total por faixa de aging (`aging_bucket`) das contas a pagar/receber |
| `PaymentsReceivedReportDto.ts` / `PaymentsReceivedReportFilterDto.ts` / `PaymentsReceivedReportTotalsDto.ts` | Recebimentos de contas a receber, com bruto, desconto, taxa, juros e multa; o filtro aceita `bill_type?: EnumType` |
| `PaymentMethodTotalDto.ts` | Total recebido por forma de pagamento (`PaymentMethodType`), usado para o recebimento por tipo |
| `PointOfSaleResultReportDto.ts` / `PointOfSaleResultReportFilterDto.ts` | Resultado (margem de contribuicao) por PDV: vendas, descontos, CMV, taxas de adquirente, repasses de comunidade e despesas |
| `FinancialEntryTotalsDto.ts` | Totais de lancamentos financeiros |
| `reports/finance/FinanceReportDtos.ts` | `FinanceCategoryReportDto`/`FinanceCategoryReportFilterDto` e `FinanceCustomerReportDto`/`FinanceCustomerReportFilterDto` — relatorios por categoria e por cliente |

### Vendas

| Arquivo | Descricao |
|---------|-----------|
| `SalesOrderReportDto.ts` / `SalesOrderReportFilterDto.ts` / `SalesOrderReportSummaryDto.ts` | Relatorio de vendas com bruto, desconto, custo, margem e markup; o filtro agrupa (`group_by: EnumType`) por produto, categoria, cliente, PDV, dia, mes, promocao ou cupom, valores do enum `SalesOrderReportGroupBy` |
| `HourlySalesWeekdayHourDto.ts` | Vendas por hora, na grade de dia da semana × hora |
| `PointOfSaleConversionReportDto.ts` / `PointOfSaleConversionReportFilterDto.ts` | Conversao do PDV: contagem por etapa do carrinho ate o pagamento e taxa de conversao; o filtro agrupa por PDV, adquirente, forma de pagamento ou dia da semana × hora (`PointOfSaleConversionGroupByType`) |
| `InvoiceOperationDto.ts` / `InvoiceOperationFilterDto.ts` / `InvoiceOperationTotalsDto.ts` | Notas fiscais de venda por operacao (CFOP) |
| `InvoiceCustomerDto.ts` / `InvoiceCustomerFilterDto.ts` | Notas fiscais de venda por cliente |
| `InvoiceProductQueryDto.ts` / `InvoiceProductQueryFilterDto.ts` / `InvoiceProductQueryTotalsDto.ts` | Consulta de produtos por nota fiscal de venda |
| `InvoiceProgressDto.ts` / `InvoiceProgressFilterDto.ts` / `InvoiceProgressDeniedReasonDto.ts` | Evolucao fiscal das notas de venda, com negadas agrupadas por motivo |
| `InvoiceTaxSumsDto.ts` | Somas de tributos de uma nota, usadas nos relatorios fiscais de venda |
| `SalesInvoiceTotalsDto.ts` | Totais de notas fiscais de venda |

### Suprimentos

| Arquivo | Descricao |
|---------|-----------|
| `BuyOrderReportDto.ts` / `BuyOrderReportFilterDto.ts` / `BuyOrderReportTotalsDto.ts` / `BuyOrderReportStatusTotalsDto.ts` | Relatorio de pedidos de compra, com status reais e totais por status |
| `InventoryInOutReportDto.ts` / `InventoryInOutFilterDto.ts` / `InventoryInOutSummaryDto.ts` | Entrada e saida de estoque por tipo de movimento, com saldo inicial, final e totais |
| `InventoryBalanceDto.ts` / `InventoryBalanceFilterDto.ts` / `InventoryBalanceTotalsDto.ts` | Saldo de estoque valorizado a custo medio, com situacao do saldo e totais |
| `InventoryWithoutMovementDto.ts` / `InventoryWithoutMovementFilterDto.ts` / `InventoryWithoutMovementTotalsDto.ts` | Produtos sem circulacao: estoque parado, valor parado (`stuck_value`), dias sem venda e, com `only_active_planogram_items`, so os itens do planograma ativo |
| `ShrinkageReportDto.ts` / `ShrinkageReportFilterDto.ts` | Quebra e acuracidade por PDV: vencidos, avariados, perdidos, saida sem pagamento, falta/sobra de contagem, percentual de quebra e de acuracidade |
| `NfeInOperationDto.ts` / `NfeInOperationFilterDto.ts` / `NfeInOperationTotalsDto.ts` | NF-e de entrada por operacao |
| `NfeInSupplierDto.ts` / `NfeInSupplierFilterDto.ts` / `NfeInSupplierTotalsDto.ts` | NF-e de entrada por fornecedor |
| `NfeInProductDto.ts` / `NfeInProductFilterDto.ts` / `NfeInProductTotalsDto.ts` | NF-e de entrada por produto |
| `NfeInProductSupplierDto.ts` / `NfeInProductSupplierFilterDto.ts` / `NfeInProductSupplierTotalsDto.ts` | Preco de compra por fornecedor: custo medio, ultimo custo, `price_variation_percentage`, `is_cheapest` e diferenca para o mais barato |
| `NfeInProgressDto.ts` / `NfeInProgressFilterDto.ts` / `NfeInProgressTotalsDto.ts` | Progresso de NF-e de entrada |
| `ProductLossReportDto.ts` / `ProductLossReportFilter.ts` / `ProductLossReportTotalsDto.ts` / `ProductLossTypeTotalsDto.ts` | Perdas por produto a custo medio, com totais por tipo de perda |
| `PurchaseSuggestionDto.ts` / `PurchaseSuggestionFilterDto.ts` / `PurchaseSuggestionSummaryDto.ts` / `PurchaseSuggestionBuyOrderDto.ts` | Sugestao de compra (estoque ideal, cobertura, custo estimado, situacao `coverage_status: EnumType<StockCoverageStatus>`), com o pedido de compra gerado a partir dela |

## Resumo

O diretorio de modelos tem bem mais de 300 arquivos no raiz, a maior parte deles pela fragmentacao dos relatorios (cada DTO, filtro e totais em seu proprio arquivo — ver a secao Relatorios nesta pagina) e pelos modelos de empresa (`CompanySummaryDto`, `CompanyBillingDto`, `BilledCompanyDto`). A tabela abaixo mantem a contagem por dominio documentada nesta pagina; ela cobre os arquivos citados nas secoes acima e nao e uma auditoria exaustiva de todo o diretorio:

| Dominio | Arquivos |
|---------|----------|
| Autenticacao e Usuarios | 14 |
| Catalogo de Produtos | 20 |
| Vendas e Pedidos | 23 |
| Financeiro | 24 |
| Suprimentos e Estoque | 41 |
| Fiscal e NF-e | 22 |
| Contatos e Comunicacao | 10 |
| Dashboard e Graficos | 7 |
| Planograma | 5 |
| Telemetria e PDV | 8 |
| Perdas de Produto | 9 |
| Sistema e Configuracao | 21 |
| Utilitarios e Compartilhados | 16 |
| **Subtotal raiz (documentado)** | **220** |
| Filtros (`filters/`) | 7 |
| Relatorios adicionais (raiz, fora da tabela acima) + `reports/finance/FinanceReportDtos.ts` | ~82 tipos em ~80 arquivos |

:::note
A contagem acima documenta os arquivos citados nesta pagina, nao o total exato do diretorio (que tem mais de 340 arquivos no raiz). A maior parte dos tipos de relatorio — financeiro, vendas e suprimentos — esta em arquivos individuais no raiz, fora de `reports/{dominio}/`; so o relatorio por categoria e por cliente do financeiro fica agrupado em `reports/finance/FinanceReportDtos.ts`. Alguns arquivos de relatorio (ex.: `ProductLossReportDto.ts`, `SalesOrderReportDto.ts`) ja aparecem nas tabelas de dominio acima e sao citados de novo na secao de Relatorios por clareza.
:::
