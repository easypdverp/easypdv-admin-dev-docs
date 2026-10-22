---
title: Filtros por URL
description: Padrão de filtros persistidos na URL no Despensinha ERP.
sidebar:
  order: 1
---

Os filtros das listagens são persistidos na URL usando **nuqs** (`useQueryState`). Isso permite compartilhar URLs com filtros aplicados e manter o estado ao navegar.

## Arquivos

| Arquivo | Função |
|---------|--------|
| `src/app/modules/table/core/_helpers.ts` | Hook `useUrlFilter` — filtro da listagem espelhado na URL |
| `src/app/utils/UrlParser.ts` | Serialização do filtro (`parseAsBase64`) |
| `src/app/utils/companyFilter.ts`, `src/app/utils/companyChoice.ts` | Filtro por empresa, reaproveitado entre listagens |
| `src/app/components/inputs/AmountRangeFilter/` | Filtro de faixa de valor (`min`/`max`) |
| `src/app/pages/[modulo]/components/[Modulo]ListFilter.tsx` | Offcanvas de filtros da listagem |

## useUrlFilter

O filtro de uma listagem vira um único parâmetro de URL, `<tableKey>_f`, em vez de um parâmetro por campo:

```ts
// src/app/modules/table/core/_helpers.ts
export const useUrlFilter = <T>(key: string) => {
  const parser = parseAsBase64<T>();
  const [value, setValue] = useQueryState<T>(`${key}_f`, parser);
  return [value, setValue] as const;
};
```

`parseAsBase64` (`src/app/utils/UrlParser.ts`) serializa o objeto de filtro como JSON comprimido com `lz-string` e codificado para URL. Isso mantém a URL compartilhável mesmo com filtros compostos (datas, seleções múltiplas, faixa de valor) sem precisar de um parâmetro por campo. Os testes leem esse parâmetro com `trackUrlFilter` (`src/test/trackUrlFilter.ts`), que decodifica `<tableKey>_f` de volta ao objeto.

## Filtro Agrupado (Offcanvas)

Listagens como estoque central (`src/app/pages/preferences/warehouse/components/WarehouseListFilter.tsx`), conta financeira (`.../financial-account/components/FinancialAccountListFilter.tsx`) e conta bancária (`.../bank-account/components/BankAccountListFilter.tsx`) reúnem os filtros num único `Offcanvas`, no lugar de controles soltos na barra da tabela:

- O estado do formulário (ex.: situação, empresa) fica local ao componente; a URL (via `useUrlFilter`) é a fonte do filtro aplicado.
- "Aplicar" grava o objeto montado em `setUrlFilter`; "Limpar" grava `null`.
- Um `useEffect` lê `urlFilter` de volta para repovoar o formulário e chamar `setFilter` do `useDataTable`, para que recarregar a página ou voltar de uma tela de detalhe preserve o filtro.
- Um campo escalar guarda o rótulo ao lado do valor (`active` + `active_label`) para alimentar o chip em `AppliedFilterChips`, que remove ambos ao fechar o chip.

## Filtro por Empresa

Em ambiente com mais de uma empresa ativa (`canChooseCompany`, `src/app/utils/companyChoice.ts`), as listagens acima e o filtro de ordens de compra têm um campo "Empresa" com `CompanySelect` (seleção múltipla) e `useActiveCompanies`. Esse filtro viaja dentro do mesmo objeto serializado em `<tableKey>_f`, como `company_ids`/`company_labels` (a modelagem do par está em [Modelos e DTOs](/arquitetura/modelos-dtos/)). Por não seguir a convenção `<campo>` + `<campo>_label`, esse par não gera chip em `AppliedFilterChips`.

## Filtro por Faixa de Valor

A faixa de valor de pedidos de venda e ordens de compra também viaja dentro do objeto serializado em `<tableKey>_f`, como `min_amount`/`max_amount` (o tipo `AmountRange` está documentado em [Modelos e DTOs](/arquitetura/modelos-dtos/)). Sem nenhum dos dois preenchidos, o campo da faixa não entra no objeto serializado.

## Veja Também

- [Hooks Customizados](/modulos/hooks/) — Hook `useSearchHotkeys` para atalhos de teclado nos filtros
- [Tabelas](/modulos/tabelas/) — Integração dos filtros com `useDataTable`
- [Modelos e DTOs](/arquitetura/modelos-dtos/) — Tipos de filtro multiempresa e de faixa de valor
