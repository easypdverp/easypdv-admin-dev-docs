---
title: Exportação
description: Padrão de exportação de dados (PDF, Excel, CSV) no Despensinha ERP.
sidebar:
  order: 4
---

A exportação de uma tela é o botão **Exportar** de uma `DataTable` (`isExportable`), que abre o `ExportModal`. O modal segue um de dois caminhos:

- **Pelo backend** (`exportEndpoint` na `DataTable`): o `POST` leva o filtro, a busca e a ordenação da tela, e o backend gera o arquivo com todas as linhas que o filtro encontra. É o caminho das listagens grandes.
- **Em memória**: sem `exportEndpoint`, o modal monta o arquivo no navegador a partir das linhas já carregadas pela `DataTable`, com `exportToPDFFromConfig`, `exportToExcelFromConfig` e `exportToCSV`, em `src/app/utils/`. Só esse caminho oferece CSV.

## Arquivos

| Arquivo | Responsabilidade |
|---------|-------------------|
| `src/app/modules/export/components/ExportModal.tsx` | Modal: colunas, formato, linhas e prévia do arquivo |
| `src/app/modules/export/core/_utils.ts` | `buildExportFilters`, limites de linha por formato, `buildFilename` |
| `src/app/modules/export/hooks/useExportConfig.ts` | Estado do modal e exportação em memória |
| `src/app/modules/export/hooks/useBackendExport.ts` | Envio da exportação pelo backend e espera da tarefa |
| `src/app/modules/widgets/Dropdown/ExportDropdown.tsx` | Botão **Exportar** da `DataTable`, monta o `BackendExport` e abre o modal |
| `src/app/utils/exportToPDF.ts`, `exportToExcel.ts`, `exportToCSV.ts` | Geração do arquivo no caminho em memória |

## Quais linhas exportar

O modal abre com "Quais linhas?", um dos valores de `ExportScopeType` (`src/app/enums/ExportScopeType.ts`):

- `PAGE` — só as linhas da página atual.
- `ALL` — todas as linhas do filtro (só existe no caminho pelo backend).
- `SELECTED` — as linhas marcadas na tabela, de qualquer página; limitado a 1.000 ids por exportação.

A `DataTable` decide quais escopos aparecem através da prop `exportScopes` (veja [Tabelas](/modulos/tabelas/)), que só vale para o caminho pelo backend (`exportEndpoint`); no caminho em memória ela não tem efeito. Sem a prop, o modal oferece todos os escopos que as linhas permitem. Um relatório agregado, cuja linha não tem `id` (ex.: totais por categoria), não aceita exportar por `ids`: o modal detecta a ausência de `id` e mostra só "Todas as páginas", já marcada, mesmo sem a prop.

## Cabeçalho do arquivo

Toda exportação pelo backend sai com um cabeçalho que resume o que foi filtrado, montado por `buildExportFilters`:

- Abre com "Período", lido de `start_date`/`end_date` do filtro, sem a tela precisar declará-lo.
- Cada entrada de `exportFilterLabels` (prop da `DataTable`) liga um campo do filtro ao rótulo que aparece no arquivo, por exemplo `{ community_label: 'Condomínio', status_label: 'Status' }`.
- Um valor de enum (`{ value, description }`) entra pela `description`; uma multisseleção entra como lista unida por `", "`.

## Limites e exportação em segundo plano

O caminho pelo backend tem tetos de linha por formato, avisados no modal antes de enviar: até 5.000 linhas em PDF e 100.000 em Excel. Acima de 1.000 linhas a exportação roda em segundo plano como tarefa — o modal fecha, um aviso aparece e o arquivo chega pela aba Tarefas do sino, mesmo que a tela seja fechada no meio.

## Exemplos de exportação pelo backend

- **Conferência de recebimento** (`GoodsReceiptViewModal`, `GoodsReceiptEndpoints.itemExport`): exporta os itens da conferência aberta no modal; só oferece "Todas as páginas" (`exportScopes={[ExportScopeType.ALL]}`).
- **Necessidade de compra** (`PurchaseSuggestionListPage`, `SupplyReportEndpoints.purchaseSuggestionExport`): mesma restrição, só "Todas as páginas".
- **Repasse a condomínio** (`CommunitySettlementListPage`, `CommunitySettlementEndpoints.export`): sem restrição de escopo; `exportColumnKeys` pré-marca as colunas da tela e `exportFilterLabels` nomeia condomínio, ponto de venda, mês e status no cabeçalho do arquivo.

## Ordem de compra: exportar e enviar

A ordem de compra não usa o `ExportModal` da `DataTable`: o item de menu "Exportar e enviar" (listagem e detalhes da ordem) abre o `BuyOrderDocumentDialog` (`src/app/pages/supply/buy-order/document/`), com três formas de uso — Baixar, E-mail e WhatsApp — e formato PDF ou XLSX. Antes de gerar o documento, a tela deixa escolher o que entra nele (valores, ordenação dos itens, colunas) e mostra a prévia dos itens; por e-mail e WhatsApp a lista de destinatários e a mensagem também ficam nessa tela.

## Veja Também

- [Tabelas](/modulos/tabelas/) — Props `exportEndpoint`, `exportScopes` e `exportFilterLabels` da `DataTable`
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de exportação por domínio
- [Hooks Customizados](/modulos/hooks/) — Hook de reordenação de colunas com @dnd-kit no `ExportModal`
