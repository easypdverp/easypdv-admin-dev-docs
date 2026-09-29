---
title: Permissões
description: Como usar o sistema de permissões CASL nos componentes do Despensinha ERP.
sidebar:
  order: 2
---

Ver [RBAC](../arquitetura/rbac/) para a configuração das abilities por perfil. Esta página cobre o uso prático nos componentes.

## Hook useAbility

```tsx
import { useAbility } from '@casl/react';
import { AbilityContext } from '../../casl/AbilityContext';

const ability = useAbility(AbilityContext);
```

## Renderização Condicional

```tsx
// Mostrar botão apenas para quem pode criar NF-e
{ability.can('create', 'NfeOut') && (
  <Button onClick={handleEmitir}>Emitir NF-e</Button>
)}
```

## Componente Can

```tsx
import { Can } from '@casl/react';

<Can I="delete" a="Client" ability={ability}>
  <Button variant="danger">Excluir</Button>
</Can>
```

## Subjects Disponíveis

Os subjects estão definidos em `src/app/casl/AbilityContext.tsx`. Exemplos:

| Subject | Descrição |
|---------|-----------|
| `NfeOut` | NF-e de saída |
| `NfeIn` | NF-e de entrada |
| `Inventory` | Gestão de estoque |
| `Finance` | Módulo financeiro |
| `Client` | Cadastro de clientes |
| `ManagerSpace` | Espaço do gestor |
| `AccountantSpace` | Espaço do contador |

## Veja Também

- [RBAC (Permissões)](/arquitetura/rbac/) — Configuração das abilities por perfil de usuário
- [Roteamento](/arquitetura/roteamento/) — Proteção de rotas com `AbilityProtectedRoute`
