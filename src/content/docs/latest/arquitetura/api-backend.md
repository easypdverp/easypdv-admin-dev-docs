---
title: API Backend (easypdv-main-api-modular)
description: Recursos expostos pela API que o admin ainda nao consome, com o estado de cada um no backend.
sidebar:
  order: 8
---

O admin consome a API `easypdv-main-api-modular`. Esta pagina lista os recursos que a API expoe e o admin ainda nao usa, com a versao do backend em que cada um esta disponivel. Recursos marcados como **develop** ainda nao fazem parte de uma release da API e podem mudar de contrato.

| Estado | Significado |
|--------|-------------|
| `v1.52.0` | Disponivel na release indicada da API |
| `develop` | Implementado na branch develop, sem release |

## Nexus (`develop`)

Modulo `easypdv-nexus`, separado em duas portas:

| Porta | Base | Autenticacao | Uso |
|-------|------|--------------|-----|
| Administracao | `/admin/nexus` | JWT do admin; GET da ativacao so exige login, as mutacoes da ativacao exigem ACESSO_TOTAL, e as rotas de integracao exigem uma das permissoes de cadastro (produtos, categorias, fornecedores, clientes, pontos de venda ou planogramas) | Ativacao, termos, conectores, integracoes e comparacoes |
| Dados | `/nexus/**` | Chave de leitura da ativacao, no header `X-API-Key` (fora da cadeia CSRF) | Leitura de produtos, categorias, clientes, fornecedores, pontos de venda e planogramas |

### Administracao
| Metodo | Path | Descricao |
|--------|------|-----------|
| GET | `/admin/nexus/activation` | Estado da ativacao (#1470) |
| POST | `/admin/nexus/activation/create/{termsVersion}` | Ativa aceitando a versao dos termos (#1471) |
| POST | `/admin/nexus/activation/renew/{termsVersion}` | Renova as chaves da ativacao (#1483) |
| POST | `/admin/nexus/activation/accept-terms/{termsVersion}` | Aceita uma versao nova dos termos (#1483) |
| DELETE | `/admin/nexus/activation/del` | Desativa (#1474) |
| GET | `/admin/nexus/connectors` | Conectores disponiveis, so com o nexus ativo (#1476) |
| POST | `/admin/nexus/integrations/add` | Provisiona uma integracao (#1503) |
| PUT | `/admin/nexus/integrations/edit/{id}` | Troca as credenciais da origem (#1505) |
| POST | `/admin/nexus/integrations/{id}/run` | Executa uma nova comparacao; uma tarefa do nexus por vez (#1500) |
| POST | `/admin/nexus/integrations/{id}/items/list` | Itens da comparacao, paginados (#1496) |
| GET | `/admin/nexus/integrations/{id}/items/{itemId}` | Item da comparacao (#1492) |
| POST | `/admin/nexus/reconciliations/list` | Integracoes com comparacao, paginadas (#1491) |
| POST | `/admin/nexus/reconciliations/{id}/runs/list` | Comparacoes de uma integracao (#1488) |
| GET | `/admin/nexus/runs/{id}` | Detalhe de uma comparacao (#1496) |
| DELETE | `/admin/nexus/runs/del/{id}` | Apaga uma comparacao (#1491) |

### Porta de dados
| Metodo | Path | Descricao |
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
| POST | `/nexus/product/list/barcode` | Produtos por codigo de barras (#1490) |
| POST | `/nexus/planogram/list` | Planogramas, paginados (#1497) |
| GET | `/nexus/planogram/{id}` | Planograma por id, com os itens embutidos (#1497) |
| GET | `/nexus/environment` | Id do ambiente; usado pelo nexus para confirmar que o endereco atende pelo ambiente registrado (#1461) |

A variavel de ambiente `NEXUS_BASE_URL` e opcional (`nexus.base-url=${NEXUS_BASE_URL:}`); vazia, a integracao com o nexus fica desligada (#1461).

## Reposicao automatica por vendas (`develop`)

`AutomaticReplenishmentController`, permissao `PREFERENCIAS_REPOSICAO_AUTOMATICA`:

| Metodo | Path | Descricao |
|--------|------|-----------|
| POST | `/admin/preferences/automatic-replenishment/create` | Cria uma reposicao para um destino (#1484) |
| GET | `/admin/preferences/automatic-replenishment/{id}` | Mostra uma reposicao (#1484) |

`AutomaticReplenishmentDto` (campos principais): `name`, `company` (obrigatoria na origem SALES), `active`, `origin` (`SALES` ou `PLANOGRAM`), `destinationWarehouse` (deposito da empresa, ou o estoque do PDV quando ele nao tem deposito supridor), `pastDays`/`desiredDays` (so em SALES, ausentes usam o padrao), `categoryIds`/`supplierIds` (escopo), `weekDays` (pelo menos um) e `hour` (0 a 23, horario de Brasilia).

## Agenda: compromissos recorrentes (`develop`)

`AppointmentDto` tem o campo `recurrence` (`AppointmentRecurrenceDto`), dentro das rotas de `/admin/schedule` que o admin ja consome para compromissos avulsos; o admin ainda nao le nem envia esse campo (#1431).

`AppointmentRecurrenceDto`: `frequency` (ausente = nao repete), `interval`, `weekDays` (repeticao semanal), `monthlyMode` (como a repeticao mensal escolhe o dia), `endType`, `untilDate` e `occurrenceCount`. O dia do mes, o dia da semana e a posicao dele vem da data de inicio do compromisso.

## Suprimentos (`develop`)

- `POST /admin/supply/task/supply/{supplyId}/item/supply-all` marca como abastecidos todos os itens pendentes da tarefa em andamento, com a quantidade prevista, registra o historico de cada item e recalcula os contadores; itens ja abastecidos ficam como estao e a tarefa continua em andamento ate o `/finish` (#1472).
- `BuyOrderDto` e `BuyOrderGenerateOrderDto` tem o campo `destination` (`WarehouseSummaryDto`, opcional), o deposito da ordem de compra (#1486).
- `BuyOrderGenerateRequestDto`, o corpo de `POST /admin/supply/buy-order/generate` (endpoint que o admin ja consome), tem `source` (`PurchaseSuggestionOrigin`) e `pointOfSaleId`, sem o campo `company` (#1486).
- No filtro de sugestao de compra da origem SALES, `pastDays` e `desiredDays` ausentes usam 90 e 7 dias como padrao no backend (#1485).

## Recursos lancados ainda nao consumidos (`v1.52.0`)

- `POST /admin/catalog/category/add/batch` cria as categorias de uma lista que ainda nao existem e reaproveita, pelo nome, as que ja existem (reativando as inativas); nome de categoria e unico (#1332).
- O ambiente credenciado (`NETWORK_ISSUER_URI`, `NETWORK_CLIENT_ID`, `NETWORK_CLIENT_SECRET`, `NETWORK_BROKER_URI`) se apresenta a central no boot e sabe se esta vinculado a uma rede de franquia, por mensageria; sem essas variaveis, nada de rede liga. Nome da rede e do franqueado ficam gravados na assinatura (`SystemSubscriptionConfig`), sem endpoint do admin que os exponha ainda (#1285-#1296).
- Lotes acompanham a mercadoria na transferencia, no abastecimento sem deposito de origem e na contagem por tarefa; comportamento interno dos mesmos endpoints que o admin ja usa, sem mudanca de contrato (#1375).
