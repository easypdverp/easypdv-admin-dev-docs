---
title: RBAC (Permissões)
description: Sistema de controle de acesso baseado em papéis usando CASL no Despensinha ERP.
sidebar:
  order: 2
---

O sistema usa **CASL** (`@casl/ability` 6.8) para controle de acesso baseado em papéis (RBAC).

## Conceitos

- **Subject**: o recurso sendo acessado (ex.: `"NfeOut"`, `"Inventory"`)
- **Action**: a operação (ex.: `"read"`, `"create"`, `"update"`, `"delete"`)
- **Ability**: combinação de actions e subjects que um usuário pode realizar

## AbilityContext

```
src/app/casl/AbilityContext.tsx
```

Define as abilities de cada perfil:

```tsx
// Exemplo simplificado
export function defineAbilityFor(user: CurrentUser) {
  const { can, cannot, build } = new AbilityBuilder(AppAbility);

  if (user.role === 'SYSTEM_USER') {
    can('manage', 'all'); // acesso total
  } else if (user.role === 'MANAGER') {
    can('read', 'Dashboard');
    can('read', 'ManagerSpace');
    cannot('manage', 'NfeOut');
  } else if (user.role === 'ACCOUNTANT') {
    can('read', 'AccountantSpace');
    can('read', 'NfeOut');
    cannot('create', 'NfeOut');
  }

  return build();
}
```

## Uso em Componentes

```tsx
import { useAbility } from '@casl/react';
import { AbilityContext } from '../casl/AbilityContext';

function EmitirNfeButton() {
  const ability = useAbility(AbilityContext);

  if (!ability.can('create', 'NfeOut')) return null;

  return <button>Emitir NF-e</button>;
}
```

## Uso em Rotas

Ver [Roteamento](../roteamento/) — `AbilityProtectedRoute` protege rotas inteiras.

## Adicionando um Novo Subject

1. Defina o novo subject como string em `AbilityContext.tsx`
2. Adicione as abilities nos perfis que devem ter acesso
3. Use `can('action', 'NovoSubject')` nos componentes ou `AbilityProtectedRoute` nas rotas

## Veja Também

- [Permissões](/funcionalidades/permissoes/) — Como o RBAC se aplica na prática nas telas do sistema
- [Roteamento](/arquitetura/roteamento/) — Proteção de rotas com `AbilityProtectedRoute`
