---
title: Tabelas
description: Padrão de tabelas com paginação e filtros no Despensinha ERP.
sidebar:
  order: 2
---

As listagens do sistema usam **TanStack React Table 8** com paginação server-side via React Query.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/hooks/useDataTable.ts` | Hook central: paginação, sort, React Query |
| `src/app/modules/table/` | Componentes de tabela reutilizáveis |

## useDataTable

```ts
// src/app/hooks/useDataTable.ts (interface)
function useDataTable<T>(options: {
  queryKey: string[];
  fetchFn: (params: TableParams) => Promise<PagedResponse<T>>;
  defaultPageSize?: number;
}): {
  data: T[];
  total: number;
  isLoading: boolean;
  pagination: PaginationState;
  setPagination: (p: PaginationState) => void;
  sorting: SortingState;
  setSorting: (s: SortingState) => void;
}
```

## Exemplo de Uso

```tsx
const { data, total, isLoading, pagination, setPagination } = useDataTable({
  queryKey: ['clients'],
  fetchFn: ({ page, pageSize, sort }) =>
    ClientEndpoints.list({ page, pageSize, sort }),
});

return (
  <DataTable
    columns={columns}
    data={data}
    total={total}
    isLoading={isLoading}
    pagination={pagination}
    onPaginationChange={setPagination}
  />
);
```

## Colunas

Defina colunas com `createColumnHelper` do TanStack:

```ts
const columnHelper = createColumnHelper<Client>();

const columns = [
  columnHelper.accessor('name', { header: 'Nome' }),
  columnHelper.accessor('document', { header: 'CPF/CNPJ' }),
  columnHelper.display({
    id: 'actions',
    cell: ({ row }) => <ActionsMenu item={row.original} />,
  }),
];
```

## Veja Também

- [Hooks Customizados](/modulos/hooks/) — Detalhes do `useDataTableCleanup` e outros hooks de tabela
- [Filtros por URL](/funcionalidades/filtros-url/) — Persistência de filtros na URL com nuqs
