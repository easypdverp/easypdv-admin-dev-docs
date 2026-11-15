---
title: RBAC (Permissões)
description: Modelo de capacidades funcionais com CASL no Despensinha ERP — permissões, grupos compostos e resolução da ability no frontend.
sidebar:
  order: 2
---

O sistema usa **CASL** (`@casl/ability` 6.8) para controle de acesso baseado em capacidades funcionais. Cada tela ou ação do frontend é protegida por uma permissão vinda do backend; não há papéis fixos como "gerente" ou "financeiro" embutidos no código — quem define isso são os Grupos de Permissão configurados por cada empresa (ver [Permissões](/funcionalidades/permissoes/)).

## Conceitos

- **Subject**: a capacidade funcional sendo verificada — uma das constantes de `PERMISSIONS` (ex.: `CATALOGO_PRODUTOS`, `RELATORIOS_FINANCEIRO_DRE`) ou o subject especial `'all'`
- **Action**: `'access'` (verificação usada pelos componentes e rotas) ou `'manage'` (ação usada ao conceder a permissão; no CASL, `'manage'` é uma ação-curinga que satisfaz qualquer verificação, incluindo `'access'`)
- **Ability**: o conjunto de regras `(action, subject)` que o usuário autenticado possui

## Capacidades (`permissions.ts`)

```
src/app/casl/permissions.ts
```

Define `PERMISSIONS`, um espelho exato das chaves de permissão que vêm do backend — a fonte única de valores usada em todo o frontend (rotas, menu, botões). Cada entrada corresponde a uma página ou a uma ação específica dentro de uma página (ex.: `FINANCEIRO_REPASSE_COMUNIDADES` para a tela de repasse e `FINANCEIRO_REPASSE_COMUNIDADES_REABRIR` para a ação de reabrir um repasse já feito). `ACESSO_TOTAL` é a permissão de super-acesso: quando presente, o usuário recebe `can('manage', 'all')` e nenhuma outra verificação é feita.

## permissionGroups.ts

```
src/app/casl/permissionGroups.ts
```

Agrupa capacidades relacionadas em listas, para pontos do frontend em que uma tela ou um item de menu depende de mais de uma permissão ao mesmo tempo. Exemplos:

- `DASHBOARD_PERMISSIONS` (e as variantes `DASHBOARD_SALES_PERMISSIONS`, `DASHBOARD_FINANCE_PERMISSIONS`, `DASHBOARD_OPERATION_PERMISSIONS`): o item "Dashboard" do menu e cada aba do dashboard aparecem se o usuário tiver qualquer uma das permissões de cards daquela aba
- `PICKLIST_PERMISSIONS` e `WAREHOUSE_TASK_PERMISSIONS`: picking, abastecimento e separação, usados tanto no menu de Suprimentos quanto nas rotas de `SupplyWrapper`
- `PURCHASE_INVOICE_READ_PERMISSIONS`: leitura de notas fiscais de entrada, que hoje é concedida por mais de uma permissão (consulta e recebimento de mercadorias)

Essas listas são passadas para `AbilityProtectedRoute` via a prop `permissions` (acesso concedido se o usuário tiver qualquer uma delas) e para a mesma verificação usada pelo menu lateral.

## Construção da ability

```
src/app/casl/ability.ts
src/app/casl/ability-context.ts
src/app/casl/AbilityContext.tsx
```

`AbilityProvider` lê `currentUser.permissions` (as capacidades do usuário logado, devolvidas pelo backend) e chama `defineAbilitiesFor`:

```ts
// src/app/casl/ability.ts (simplificado)
export function defineAbilitiesFor(userPermissions: PermissionDto[]): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (userPermissions.some((p) => p.value === PERMISSIONS.ACESSO_TOTAL)) {
    can('manage', 'all');
    return build();
  }

  for (const permission of userPermissions) {
    can('manage', permission.value as Permission);
  }

  return build();
}
```

Ou seja: a ability não deriva de um papel fixo no código — ela é montada dinamicamente a partir da lista de capacidades que o backend já resolveu para aquele usuário (a composição de capacidades em Grupos de Permissão acontece do lado do backend/da tela de administração, não aqui). A instância fica disponível via `AbilityContext` (criado em `ability-context.ts`, separado de `AbilityContext.tsx` para sobreviver ao Fast Refresh do Vite).

## Uso em Componentes

```tsx
import { useCan } from '../casl/AbilityContext';
import { PERMISSIONS } from '../casl/permissions';

function EditProductButton() {
  if (!useCan(PERMISSIONS.CATALOGO_PRODUTOS)) return null;

  return <button>Editar produto</button>;
}
```

`AbilityContext.tsx` também expõe `useAbility`, `useCannot`, `useCanAny`, `useCanAll` e o componente `Can`:

```tsx
import { Can } from '../casl/AbilityContext';
import { PERMISSIONS } from '../casl/permissions';

<Can I="access" a={PERMISSIONS.CADASTROS_CLIENTES}>
  <ClientForm />
</Can>;
```

## Uso em Rotas

```tsx
<AbilityProtectedRoute permission={PERMISSIONS.CATALOGO_PRODUTOS}>
  <ProductPage />
</AbilityProtectedRoute>
```

`permission` exige uma única capacidade; `permissions` aceita uma lista (qualquer uma delas basta, ou todas com `requireAll`). Sem acesso, a rota redireciona para `fallbackPath` (padrão `/inicio/indice`). Ver [Roteamento](../roteamento/) para como isso se combina com os hubs de relatórios construídos sobre a árvore de `menuConfig.ts`.

## Adicionando uma Nova Capacidade

1. Adicione a chave em `PERMISSIONS` (`permissions.ts`), espelhando exatamente o valor que o backend expõe para essa capacidade
2. Proteja a página ou o botão com `useCan`/`Can`/`AbilityProtectedRoute` usando essa constante
3. Se a tela ou o item de menu depender de mais de uma capacidade, agrupe-as em `permissionGroups.ts`
4. Referencie a permissão em `menuConfig.ts` (ou `SettingsOptions.ts`) para que o item apareça no menu certo

## Veja Também

- [Permissões](/funcionalidades/permissoes/) — Como as capacidades são organizadas em Grupos de Permissão na prática
- [Roteamento](/arquitetura/roteamento/) — Proteção de rotas com `AbilityProtectedRoute` e os hubs de relatórios
