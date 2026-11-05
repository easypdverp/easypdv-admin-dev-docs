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

`AutomaticReplenishmentDto` tem os campos principais abaixo:

| Campo | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| `name` | string | sim | Nome da configuração de reposição |
| `company` | objeto/ID | sim na origem `SALES` | Empresa associada à regra |
| `active` | boolean | não | Indica se a reposição está ativa |
| `origin` | enum (`SALES` \| `PLANOGRAM`) | sim | Origem dos itens considerados na reposição |
| `destinationWarehouse` | objeto/ID | sim | Depósito da empresa ou estoque do PDV quando ele não possui depósito supridor |
| `pastDays` | number | não | Janela histórica para origem `SALES`; ausente, usa o padrão do backend |
| `desiredDays` | number | não | Dias desejados para cobertura; ausente, usa o padrão do backend |
| `categoryIds` | array | não | Escopo por categorias |
| `supplierIds` | array | não | Escopo por fornecedores |
| `weekDays` | array | sim | Dias da semana em que a execução ocorre |
| `hour` | number | sim | Horário de execução de 0 a 23, em horário de Brasília |

## Agenda: compromissos recorrentes (`develop`)

`AppointmentDto` tem o campo `recurrence` (`AppointmentRecurrenceDto`) dentro das rotas de `/admin/schedule` que o admin já consome para compromissos avulsos.

| Campo | Tipo | Descrição |
|------|------|-----------|
| `frequency` | enum/nullable | Frequência da recorrência; ausente indica que o compromisso não se repete |
| `interval` | number | Intervalo entre repetições |
| `weekDays` | array | Dias da semana usados na repetição semanal |
| `monthlyMode` | enum | Estratégia de escolha do dia na repetição mensal |
| `endType` | enum | Tipo de término da recorrência |
| `untilDate` | date/null | Data final da recorrência |
| `occurrenceCount` | number/null | Quantidade de ocorrências |
| `startDate` | date | Data de início do compromisso; dela derivam o dia do mês, o dia da semana e a posição semanal da recorrência |

## Suprimentos (`develop`)

- `POST /admin/supply/task/supply/{supplyId}/item/supply-all` marca como abastecidos todos os itens pendentes da tarefa em andamento, com a quantidade prevista, registra o histórico de cada item e recalcula os contadores; itens já abastecidos permanecem como estão e a tarefa continua em andamento até o `/finish` (#1472).
- `BuyOrderDto` e `BuyOrderGenerateOrderDto` têm o campo `destination` (`WarehouseSummaryDto`, opcional), o depósito da ordem de compra (#1486).
- `BuyOrderGenerateRequestDto`, o corpo de `POST /admin/supply/buy-order/generate` (endpoint que o admin já consome), tem `source` (`PurchaseSuggestionOrigin`) e `pointOfSaleId`, sem o campo `company` (#1486).
- No filtro de sugestão de compra da origem `SALES`, `pastDays` e `desiredDays` ausentes usam 90 e 7 dias como padrão no backend (#1485).

## Recursos lançados ainda não consumidos (`v1.52.0`)

- `POST /admin/catalog/category/add/batch` cria as categorias de uma lista que ainda não existem e reaproveita, pelo nome, as que já existem (reativando as inativas); nome de categoria é único (#1332).
- O ambiente credenciado (`NETWORK_ISSUER_URI`, `NETWORK_CLIENT_ID`, `NETWORK_CLIENT_SECRET`, `NETWORK_BROKER_URI`) se apresenta à central no boot e sabe se está vinculado a uma rede de franquia, por mensageria; sem essas variáveis, nada de rede liga. Nome da rede e do franqueado ficam gravados na assinatura (`SystemSubscriptionConfig`), sem endpoint do admin que os exponha ainda (#1285-#1296).
- Lotes acompanham a mercadoria na transferência, no abastecimento sem depósito de origem e na contagem por tarefa; comportamento interno dos mesmos endpoints que o admin já usa, sem mudança de contrato (#1375).