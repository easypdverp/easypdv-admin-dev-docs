---
title: Filtros por URL
description: Padrão de filtros persistidos na URL no Despensinha ERP.
sidebar:
  order: 1
---

Os filtros das listagens são persistidos na URL usando **nuqs** (`useQueryStates`). Isso permite compartilhar URLs com filtros aplicados e manter o estado ao navegar.

## Arquivos

| Arquivo | Função |
|---------|--------|
| `src/app/hooks/useUrlFilter.ts` | Hook base para filtros em URL |
| `src/app/pages/[modulo]/components/[Modulo]Filters.tsx` | Offcanvas de filtros por módulo |

## useUrlFilter

```ts
// src/app/hooks/useUrlFilter.ts
import { useQueryStates, parseAsString } from 'nuqs';

export function useUrlFilter<T extends Record<string, string>>() {
  const [filters, setFilters] = useQueryStates(
    Object.fromEntries(Object.keys(defaultFilters).map(k => [k, parseAsString.withDefault('')]))
  );

  const clearFilters = () => setFilters(defaultFilters);

  return { filters, setFilters, clearFilters };
}
```

## Offcanvas de Filtros

O padrão de filtros usa um `Offcanvas` lateral (Bootstrap) que abre ao clicar em "Filtros":

```tsx
function ClientFilters() {
  const { filters, setFilters, clearFilters } = useUrlFilter();
  const [show, setShow] = useState(false);

  return (
    <>
      <Button onClick={() => setShow(true)}>Filtros</Button>
      <Offcanvas show={show} onHide={() => setShow(false)} placement="end">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Filtros</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <TextInput
            label="Nome"
            value={filters.name}
            onChange={v => setFilters({ name: v })}
          />
          <Button variant="link" onClick={clearFilters}>Limpar filtros</Button>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
```

Os filtros são passados como parâmetros para `useDataTable` → `fetchFn`.

## Veja Também

- [Hooks Customizados](/modulos/hooks/) — Hook `useSearchHotkeys` para atalhos de teclado nos filtros
- [Tabelas](/modulos/tabelas/) — Integração dos filtros com `useDataTable`
