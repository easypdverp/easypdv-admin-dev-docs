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
// Uso em SalesWrapper.tsx
<Route
  element={
    <AbilityProtectedRoute permission={PERMISSIONS.VENDAS_NOTAS_FISCAIS}>
      <NfeOutWrapper />
    </AbilityProtectedRoute>
  }
  path={'nota-saida/*'}
/>
```

Ver [RBAC (Permissões)](/arquitetura/rbac/) para `permission`/`permissions` e o `fallbackPath`.

## Rotas Públicas

Antes de escolher o conjunto de rotas por perfil, `RootRoutes` (em `AppRoutes.tsx`) declara rotas acessíveis sem sessão autenticada, fora do `MasterLayout`:

- `/convite/:invitationId` — aceite de convite
- `/confirmar-cadastro/:token` — confirmação do cadastro feito no Touch

## Hubs de Relatórios

As rotas de `/relatorios/*` são geradas a partir da árvore "Relatórios" de `menuConfig.ts`: cada domínio (Vendas, Suprimentos, Finanças) e cada grupo dentro dele renderiza um hub (`ReportHubPage`) com cards para os filhos, filtrados pela mesma regra de permissão do menu lateral (`canAccessMenuItem`). Sem nenhum filho permitido, o hub mostra estado vazio.

```
/relatorios/vendas                           # hub do domínio Vendas
/relatorios/vendas/conversao-pdv             # folha (Conversão do PDV)
/relatorios/vendas/nota-fiscal               # hub do grupo Notas Fiscais
/relatorios/suprimentos/quebra-acuracidade   # folha (Quebra e acuracidade por PDV)
/relatorios/financas/geral/resultado-por-pdv # folha (Resultado por PDV)
```

Necessidade de compra não fica sob `/relatorios`: `/suprimentos/necessidade-compra` é uma tela acionável em Suprimentos que lista a sugestão de compra e gera as ordens a partir dela.

## Preferências

`/preferencias/empresas/*` (`CompanyWrapper`) segue o padrão lista/cadastro/edição:

```
/preferencias/empresas/lista
/preferencias/empresas/novo
/preferencias/empresas/edita/:id
```

## Adicionando uma Nova Rota

1. Crie a página em `src/app/pages/[modulo]/[Modulo]Page.tsx`
2. Adicione a rota no arquivo de rotas do perfil correto (`SystemUserRoutes.tsx`, etc.)
3. Se a rota precisar de proteção CASL, envolva com `AbilityProtectedRoute`
4. Adicione a ability correspondente em `src/app/casl/AbilityContext.tsx`

## Veja Também

- [API e Endpoints](/arquitetura/api-endpoints/) — Catálogo completo dos endpoints consumidos por cada rota
- [Error Handling](/arquitetura/error-handling/) — Tratamento de erros nas chamadas de API das rotas
