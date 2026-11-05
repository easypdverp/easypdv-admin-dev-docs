---
title: API Backend (easypdv-main-api-modular)
description: Recursos expostos pela API que o admin ainda nao consome, com o estado de cada um no backend.
sidebar:
  order: 8
---

O admin consome a API `easypdv-main-api-modular`. Esta página lista os recursos que a API expõe e o admin ainda não usa, com a versão do backend em que cada um está disponível. Recursos marcados como **develop** ainda não fazem parte de uma release da API e podem mudar de contrato.

| Estado | Significado |
|--------|-------------|
| `v1.52.0` | Disponível na release indicada da API |
| `develop` | Implementado na branch develop, sem release |

## Nexus (`develop`)

Módulo `easypdv-nexus`, separado em duas portas:

| Porta | Base | Autenticação | Uso |
|-------|------|--------------|-----|
| Administração | `/admin/nexus` | JWT do admin; GET da ativação só exige login, as mutações da ativação exigem ACESSO_TOTAL, e as rotas de integração exigem uma das permissões de cadastro (produtos, categorias, fornecedores, clientes, pontos de venda ou planogramas) | Ativação, termos, conectores, integrações e comparações |
| Dados | `/nexus/**` | Chave de leitura da ativação, no header `X-API-Key` (fora da cadeia CSRF) | Leitura de produtos, categorias, clientes, fornecedores, pontos de venda e planogramas |

### Administração
| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/admin/nexus/activation` | Estado da ativação (#1470) |
| POST | `/admin/nexus/activation/create/{termsVersion}` | Ativa aceitando a versão dos termos (#1471) |
| POST | `/admin/nexus/activation/renew/{termsVersion}` | Renova as chaves da ativação (#1483) |
| POST | `/admin/nexus/activation/accept-terms/{termsVersion}` | Aceita uma versão nova dos termos (#1483) |
| DELETE | `/admin/nexus/activation/del` | Desativa (#1474) |
| GET | `/admin/nexus/connectors` | Conectores disponíveis, só com o nexus ativo (#1476) |
| POST | `/admin/nexus/integrations/add` | Provisiona uma integração (#1503) |
| PUT | `/admin/nexus/integrations/edit/{id}` | Troca as credenciais da origem (#1505) |
| POST | `/admin/nexus/integrations/{id}/run` | Executa uma nova comparação; uma tarefa do nexus por vez (#1500) |
| POST | `/admin/nexus/integrations/{id}/items/list` | Itens da comparação, paginados (#1496) |
| GET | `/admin/nexus/integrations/{id}/items/{itemId}` | Item da comparação (#1492) |
| POST | `/admin/nexus/reconciliations/list` | Integrações com comparação, paginadas (#1491) |
| POST | `/admin/nexus/reconciliations/{id}/runs/list` | Comparações de uma integração (#1488) |
| GET | `/admin/nexus/runs/{id}` | Detalhe de uma comparação (#1496) |
| DELETE | `/admin/nexus/runs/del/{id}` | Apaga uma comparação (#1491) |

### Porta de dados
| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/nexus/category/list` | Categorias, paginadas (#1475) |
| GET | `/nexus/category/{id}` | Categoria por id (#1475) |
| POST | `/nexus/client/list` | Clientes, paginados (#1490) |
| GET | `/nexus/client/{id}` | Cliente por id (#1490) |
| POST | `/nexus/supplier/list` | Fornecedores, paginados (#1493) |
| GET | `/nexus/supplier/{id}` | Fornecedor por id (#1493) |
| POST | `/nexus/pos/list` | Pontos de venda, paginados (#1495) |
| GET | `/nexus/pos/{id}` | Ponto de venda por id (#1495) |
| POST | `/nexus/product/list` | Produtos, paginados (#1487) |
| GET | `/nexus/product/{id}` | Produto por id (#1487) |
| POST | `/nexus/product/list/barcode` | Produtos por código de barras (#1490) |
| POST | `/nexus/planogram/list` | Planogramas, paginados (#1497) |
| GET | `/nexus/planogram/{id}` | Planograma por id, com os itens embutidos (#1497) |
| GET | `/nexus/environment` | Id do ambiente; usado pelo nexus para confirmar que o endereço atende pelo ambiente registrado (#1461) |

A variável de ambiente `NEXUS_BASE_URL` é opcional (`nexus.base-url=${NEXUS_BASE_URL:}`); vazia, a integração com o nexus fica desligada (#1461).

## Reposição automática por vendas (`develop`)

`AutomaticReplenishmentController`, permissão `PREFERENCIAS_REPOSICAO_AUTOMATICA`:

| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/admin/preferences/automatic-replenishment/create` | Cria uma reposição para um destino (#1484) |
| GET | `/admin/preferences/automatic-replenishment/{id}` | Mostra uma reposição (#1484) |

`AutomaticReplenishmentDto` (campos principais): `name`, `company` (obrigatória na origem SALES), `active`, `origin` (`SALES` ou `PLANOGRAM`), `destinationWarehouse` (depósito da empresa, ou o estoque do PDV quando ele não tem depósito supridor), `pastDays`/`desiredDays` (só em SALES, ausentes usam o padrão), `categoryIds`/`supplierIds` (escopo), `weekDays` (pelo menos um) e `hour` (0 a 23, horário de Brasília).

## Agenda: compromissos recorrentes (`develop`)

`AppointmentDto` tem o campo `recurrence` (`AppointmentRecurrenceDto`), dentro das rotas de `/admin/schedule` que o admin já consome para compromissos avulsos; o admin ainda não lê nem envia esse campo (#1431).

`AppointmentRecurrenceDto`: `frequency` (ausente = não repete), `interval`, `weekDays` (repetição semanal), `monthlyMode` (como a repetição mensal escolhe o dia), `endType`, `untilDate` e `occurrenceCount`. O dia do mês, o dia da semana e a posição dele vêm da data de início do compromisso.

## Suprimentos (`develop`)

- `POST /admin/supply/task/supply/{supplyId}/item/supply-all` marca como abastecidos todos os itens pendentes da tarefa em andamento, com a मात्रा prevista, registra o histórico de cada item e recalcula os contadores; itens já abastecidos ficam como estão e a tarefa continua em andamento até o `/finish` (#1472).
- `BuyOrderDto` e `BuyOrderGenerateOrderDto` têm o campo `destination` (`WarehouseSummaryDto`, opcional), o depósito da ordem de compra (#1486).
- `BuyOrderGenerateRequestDto`, o corpo de `POST /admin/supply/buy-order/generate` (endpoint que o admin já consome), tem `source` (`PurchaseSuggestionOrigin`) e `pointOfSaleId`, sem o campo `company` (#1486).
- No filtro de sugestão de compra da origem SALES, `pastDays` e `desiredDays` ausentes usam 90 e 7 dias como padrão no backend (#1485).

## Preferências de gateway

`GatewayEndpoints` concentra as rotas de cadastro e administração de gateways financeiros.

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/preferences/gateway/list` | Lista gateways cadastrados |
| GET | `/preferences/gateway/export` | Exporta a listagem de gateways |
| POST | `/preferences/gateway/add` | Cria um gateway |
| GET | `/preferences/gateway/{id}` | Detalhes de um gateway |
| PUT | `/preferences/gateway/edit/{id}` | Edita um gateway |
| DELETE | `/preferences/gateway/del/{id}` | Remove um gateway |
| DELETE | `/preferences/gateway/del/batch` | Remove vários gateways em lote |
| PATCH | `/preferences/gateway/status/{id}` | Alterna o status de um gateway |
| PATCH | `/preferences/gateway/status/batch` | Alterna o status de vários gateways em lote |
| GET | `/preferences/gateway/service/list` | Lista serviços de gateway disponíveis |
| POST | `/preferences/gateway/test-connection/{id}` | Testa a conexão do gateway |

## Pedidos de venda

`SaleOrderEndpoints` expõe o fluxo de pedidos de venda.

| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/sales/sale-order/list` | Lista pedidos |
| POST | `/sales/sale-order/export` | Exporta pedidos |
| POST | `/sales/sale-order/add` | Cria pedido |
| GET | `/sales/sale-order/{id}` | Detalhes do pedido |
| PUT | `/sales/sale-order/edit/{id}` | Edita pedido |
| DELETE | `/sales/sale-order/{id}` | Remove pedido |
| PATCH | `/sales/sale-order/{id}/cancel` | Cancela pedido |
| PATCH | `/sales/sale-order/{id}/change-status` | Altera status do pedido |

## Preferências de interface

`UiConfigEndpoints` concentra a configuração da interface do usuário.

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/preferences/config/ui` | Detalhes da configuração visual |
| PUT | `/preferences/config/ui` | Atualiza a configuração visual |

## Relatórios e painéis

`DashboardFinanceEndpoints` e `DashboardOperationEndpoints` agrupam consultas usadas pelos painéis financeiros e operacionais.

### Financeiro
| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/dashboard/finance/summary` | Resumo financeiro |
| GET | `/dashboard/finance/monthly-performance` | Desempenho mensal |
| GET | `/dashboard/finance/high-balance` | Contas com maior saldo |
| GET | `/dashboard/finance/growth` | Crescimento financeiro |
| GET | `/dashboard/finance/cash-flow` | Fluxo de caixa |
| GET | `/dashboard/finance/bills-to-receive` | Títulos a receber |
| GET | `/dashboard/finance/bills-to-pay` | Títulos a pagar |
| GET | `/dashboard/finance/receivables-aging` | Envelhecimento de recebíveis |
| GET | `/dashboard/finance/profit` | Lucro |

### Operações
| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/dashboard/operation/warehouse-task` | Tarefas do depósito |
| GET | `/dashboard/operation/highlights` | Destaques operacionais |
| GET | `/dashboard/operation/expiring-product` | Produtos a vencer |

## Endpoints de conta

`AccountEndpoints` expõe os dados da conta e as preferências de notificação.

| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/account/change-password` | Altera senha |
| POST | `/account/change-email` | Altera e-mail |
| GET | `/account/details` | Dados da conta |
| GET | `/account/notification-preferences/available/list` | Preferências de notificação disponíveis |
| GET | `/account/notification-preferences/disabled/list` | Preferências de notificação desabilitadas |
| POST | `/account/notification-preferences/disabled/save` | Salva preferências de notificação desabilitadas |

## Recursos lançados ainda não consumidos (`v1.52.0`)

- `POST /admin/catalog/category/add/batch` cria as categorias de uma lista que ainda não existem e reaproveita, pelo nome, as que já existem (reativando as inativas); nome de categoria é único (#1332).
- O ambiente credenciado (`NETWORK_ISSUER_URI`, `NETWORK_CLIENT_ID`, `NETWORK_CLIENT_SECRET`, `NETWORK_BROKER_URI`) se apresenta a central no boot e sabe se está vinculado a uma rede de franquia, por mensageria; sem essas variáveis, nada de rede liga. Nome da rede e do franqueado ficam gravados na assinatura (`SystemSubscriptionConfig`), sem endpoint do admin que os exponha ainda (#1285-#1296).
- Lotes acompanham a mercadoria na transferência, no abastecimento sem depósito de origem e na contagem por tarefa; comportamento interno dos mesmos endpoints que o admin já usa, sem mudança de contrato (#1375).