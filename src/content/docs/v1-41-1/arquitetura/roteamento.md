---
title: Roteamento
description: Sistema de roteamento por perfil de usuário no Despensinha ERP.
sidebar:
  order: 1
---

O roteamento usa **React Router DOM 6** com separação de rotas por perfil de usuário.

## Estrutura de Rotas

```
src/app/routing/
├── AppRoutes.tsx               # Entrada: seleciona o conjunto de rotas pelo perfil
├── SystemUserRoutes.tsx        # Rotas do Usuário do Sistema (acesso total)
├── ManagerRoutes.tsx           # Rotas do Gestor
├── AccountantRoutes.tsx        # Rotas do Contador
└── AbilityProtectedRoute.tsx   # HOC que verifica permissão CASL antes de renderizar
```

## AppRoutes.tsx

`AppRoutes` lê o perfil do usuário autenticado do `AuthContext` e renderiza o conjunto de rotas correspondente:

```tsx
// src/app/routing/AppRoutes.tsx (simplificado)
const { currentUser } = useAuth();

if (currentUser?.role === 'SYSTEM_USER') return <SystemUserRoutes />;
if (currentUser?.role === 'MANAGER')     return <ManagerRoutes />;
if (currentUser?.role === 'ACCOUNTANT')  return <AccountantRoutes />;
return <CommunityRoutes />;
```

## AbilityProtectedRoute

Rotas que requerem uma permissão CASL específica usam `AbilityProtectedRoute`:

```tsx
// Uso em SystemUserRoutes.tsx
<Route
  path="vendas/nfe-saida"
  element={
    <AbilityProtectedRoute action="read" subject="NfeOut">
      <NfeOutPage />
    </AbilityProtectedRoute>
  }
/>
```

Se o usuário não tiver a permissão `read NfeOut`, é redirecionado para `/403`.

## Adicionando uma Nova Rota

1. Crie a página em `src/app/pages/[modulo]/[Modulo]Page.tsx`
2. Adicione a rota no arquivo de rotas do perfil correto (`SystemUserRoutes.tsx`, etc.)
3. Se a rota precisar de proteção CASL, envolva com `AbilityProtectedRoute`
4. Adicione a ability correspondente em `src/app/casl/AbilityContext.tsx`

## Veja Também

- [API e Endpoints](/arquitetura/api-endpoints/) — Catálogo completo dos endpoints consumidos por cada rota
- [Error Handling](/arquitetura/error-handling/) — Tratamento de erros nas chamadas de API das rotas
