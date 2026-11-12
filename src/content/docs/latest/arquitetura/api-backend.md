---
title: API Backend (easypdv-main-api-modular)
description: Recursos expostos pela API que o admin ainda nao consome, com o estado de cada um no backend.
sidebar:
  order: 8
---

O admin consome a API `easypdv-main-api-modular`. Esta pagina lista os recursos que a API expõe e o admin ainda não usa, com a versão do backend em que cada um está disponível. Recursos marcados como **develop** ainda não fazem parte de uma release da API e podem mudar de contrato.

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

### Execuções de reposição automática

| Componente | Path | Uso |
|-----------|------|-----|
| `AutomaticReplenishmentEndpoints.list` | `/preferences/automatic-replenishment/list` | Lista as regras de reposição automática |
| `AutomaticReplenishmentEndpoints.listExecutions(id)` | `/preferences/automatic-replenishment/list/executions/{id}` | Lista as execuções de uma regra |
| `AutomaticReplenishmentEndpoints.create` | `/preferences/automatic-replenishment/create` | Cria a regra |
| `AutomaticReplenishmentEndpoints.run(id)` | `/preferences/automatic-replenishment/run/{id}` | Executa a regra |
| `AutomaticReplenishmentEndpoints.details(id)` | `/preferences/automatic-replenishment/{id}` | Detalhe da regra |
| `AutomaticReplenishmentEndpoints.edit(id)` | `/preferences/automatic-replenishment/edit/{id}` | Edita a regra |
| `AutomaticReplenishmentEndpoints.delete(id)` | `/preferences/automatic-replenishment/del/{id}` | Remove a regra |
| `AutomaticReplenishmentEndpoints.toggleStatus(id)` | `/preferences/automatic-replenishment/status/{id}` | Ativa ou desativa a regra |

### Execuções de picklist automática

| Componente | Path | Uso |
|-----------|------|-----|
| `AutomaticPickListEndpoints.add` | `/preferences/automatic-picklist/add` | Cria a regra de picklist automática |
| `AutomaticPickListEndpoints.listExecutions(id)` | `/preferences/automatic-picklist/list/executions/{id}` | Lista as execuções de uma regra |
| `AutomaticPickListEndpoints.run(id)` | `/preferences/automatic-picklist/run/{id}` | Executa a regra |
| `AutomaticPickListEndpoints.details(id)` | `/preferences/automatic-picklist/{id}` | Detalhe da regra |
| `AutomaticPickListEndpoints.edit(id)` | `/preferences/automatic-picklist/edit/{id}` | Edita a regra |
| `AutomaticPickListEndpoints.delete(id)` | `/preferences/automatic-picklist/del/{id}` | Remove a regra |
| `AutomaticPickListEndpoints.toggleStatus(id)` | `/preferences/automatic-picklist/status/{id}` | Ativa ou desativa a regra |

### Automações

| Componente | Path | Uso |
|-----------|------|-----|
| `AutomationEndpoints.list` | `/preferences/automation/list` | Lista as automações cadastradas |
| `AUTOMATIONS_PAGE_URL` | `/preferencias/automacoes` | Rota de navegação do admin para automações |
| `AUTOMATIC_REPLENISHMENT_EXECUTIONS_PAGE_URL(id)` | `/preferencias/automacoes/reposicao-automatica/{id}` | Rota de navegação para execuções de reposição automática |
| `AUTOMATIC_PICKLIST_EXECUTIONS_PAGE_URL(id)` | `/preferencias/automacoes/picklist-automatica/{id}` | Rota de navegação para execuções de picklist automática |

## Agenda: compromissos recorrentes (`develop`)

`AppointmentDto` tem o campo `recurrence` (`AppointmentRecurrenceDto`), dentro das rotas de `/admin/schedule` que o admin já consome para compromissos avulsos; o admin ainda não lê nem envia esse campo (#1431).

`AppointmentRecurrenceDto`: `frequency` (ausente = não repete), `interval`, `weekDays` (repetição semanal), `monthlyMode` (como a repetição mensal escolhe o dia), `endType`, `untilDate` e `occurrenceCount`. O dia do mês, o dia da semana e a posição dele vêm da data de início do compromisso.

## Suprimentos (`develop`)

- `POST /admin/supply/task/supply/{supplyId}/item/supply-all` marca como abastecidos todos os itens pendentes da tarefa em andamento, com a quantidade prevista, registra o histórico de cada item e recalcula os contadores; itens já abastecidos ficam como estão e a tarefa continua em andamento até o `/finish` (#1472).
- `BuyOrderDto` e `BuyOrderGenerateOrderDto` têm o campo `destination` (`WarehouseSummaryDto`, opcional), o depósito da ordem de compra (#1486).
- `BuyOrderGenerateRequestDto`, o corpo de `POST /admin/supply/buy-order/generate` (endpoint que o admin já consome), tem `source` (`PurchaseSuggestionOrigin`) e `pointOfSaleId`, sem o campo `company` (#1486).
- No filtro de sugestão de compra da origem SALES, `pastDays` e `desiredDays` ausentes usam 90 e 7 dias como padrão no backend (#1485).

### Complementos de suprimentos

| Componente | Path | Uso |
|-----------|------|-----|
| `PicklistEndpoints.locations(pointOfSaleId)` | `/supply/pick-list/list/locations/{pointOfSaleId}` | Lista locais vinculados ao PDV para a picklist |
| `SupplyTaskEndpoints.supplyAllItems(supplyId)` | `/supply/task/supply/{supplyId}/item/supply-all` | Abastece todos os itens pendentes da tarefa |
| `SupplyReportEndpoints.purchaseSuggestionSuppliers` | `/supply/reports/purchase-suggestion/suppliers` | Lista fornecedores disponíveis para o relatório de sugestão de compra |
| `SupplyReportEndpoints.purchaseSuggestionDestinations` | `/supply/reports/purchase-suggestion/destinations` | Lista destinos disponíveis para o relatório de sugestão de compra |

## Recursos lançados ainda não consumidos (`v1.52.0`)

- `POST /admin/catalog/category/add/batch` cria as categorias de uma lista que ainda não existem e reaproveita, pelo nome, as que já existem (reativando as inativas); nome de categoria é único (#1332).
- O ambiente credenciado (`NETWORK_ISSUER_URI`, `NETWORK_CLIENT_ID`, `NETWORK_CLIENT_SECRET`, `NETWORK_BROKER_URI`) se apresenta à central no boot e sabe se está vinculado a uma rede de franquia, por mensageria; sem essas variáveis, nada de rede liga. Nome da rede e do franqueado ficam gravados na assinatura (`SystemSubscriptionConfig`), sem endpoint do admin que os exponha ainda (#1285-#1296).
- Lotes acompanham a mercadoria na transferência, no abastecimento sem depósito de origem e na contagem por tarefa; comportamento interno dos mesmos endpoints que o admin já usa, sem mudança de contrato (#1375).
- `POST /admin/preferences/automatic-replenishment/create` e `GET /admin/preferences/automatic-replenishment/{id}` expõem a administração das regras de reposição automática por vendas.
- `POST /admin/preferences/automatic-picklist/add`, `GET /preferences/automatic-picklist/list/executions/{id}` e as demais rotas de `AutomaticPickListEndpoints` cobrem as regras de picklist automática.
- `GET /nexus/environment` valida o ambiente registrado pela integração Nexus.
- `POST /sales/planogram/add/batch/{pointOfSaleId}` e `POST /sales/planogram/item/status/{id}` cobrem criação em lote de planogramas e alternância de status de item.
- `POST /sales/sale-order/{id}/risk-analysis` liga a avaliação de risco ao pedido de venda.
- `POST /finance/bank-statement/reconciliation/add`, `GET /finance/bank-statement/reconciliation/{id}`, `POST /finance/bank-statement/reconciliation/list/candidates/{lineId}` e as rotas correlatas cobrem conciliação de extrato bancário, regras e importações.
- `POST /preferences/acquirer/add`, `GET /preferences/acquirer/list`, `GET /preferences/acquirer/{id}`, `PUT /preferences/acquirer/edit/{id}` e as rotas correlatas cobrem adquirentes e dias de adquirente no extrato bancário.
- `POST /announcement/create`, `POST /announcement/publish/{id}`, `GET /announcement/list/pending` e as rotas correlatas cobrem comunicados do sistema.
- `POST /attachment/upload` e as rotas de biblioteca de anexos cobrem envio e organização de arquivos.
- `GET /account/dashboard-preferences`, `POST /account/dashboard-preferences/save` e `POST /account/dashboard-preferences/import` cobrem preferências do painel do usuário.
- `GET /preferences/user-role/list/assignable` lista papéis atribuíveis.
- `GET /preferences/config/risk-analysis`, `PUT /preferences/config/risk-analysis` e `GET /preferences/config/risk-analysis/products/list` cobrem a configuração de análise de risco.
- `GET /sales/reports/risk-analysis` expõe o relatório de análise de risco de vendas.
- `GET /dashboard/finance/cash-forecast`, `GET /dashboard/finance/list/open-payables`, `GET /dashboard/finance/list/open-receivables`, `GET /dashboard/finance/open-payables` e `GET /dashboard/finance/open-receivables` cobrem blocos do dashboard financeiro.
- `GET /dashboard/operation/list/stockout`, `GET /dashboard/operation/list/coverage`, `GET /dashboard/operation/turnover`, `GET /dashboard/operation/list/purchase-orders` e `GET /dashboard/operation/list/late-purchases` cobrem blocos do dashboard operacional.
- `GET /dashboard/sales/daily-margin`, `GET /dashboard/sales/payment-method-values` e `GET /dashboard/sales/coupon-usage` cobrem blocos do dashboard de vendas.
- `GET /public/interface/login` e `GET /preferences/config/ui/appearance` cobrem a interface pública de login e a aparência da UI.
- `GET /file-manager/folder/list`, `POST /file-manager/folder/add`, `POST /file-manager/edit/batch`, `POST /file-manager/favorite/add/{attachmentId}` e as rotas correlatas cobrem organização de arquivos, favoritos e compartilhamentos.
- `VITE_ENABLE_SOCIAL_NETWORK_MOCK`, `VITE_ENABLE_TICKETS_MOCK`, `VITE_ENABLE_TRAININGS_MOCK` e `VITE_ENABLE_CHECKLIST_MOCK` controlam mocks de rede social, chamados, treinamentos e checklist no front-end.