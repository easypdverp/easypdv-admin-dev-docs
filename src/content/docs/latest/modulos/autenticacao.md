---
title: Autenticação
description: Fluxo de autenticação JWT no Despensinha ERP.
sidebar:
  order: 1
---

A autenticação usa **JWT** com **refresh token**. O estado do usuário autenticado é mantido no `AuthContext`.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/modules/auth/core/Auth.tsx` | Criação e exportação do `AuthContext`, provider e hook de consumo |
| `src/app/modules/auth/core/AuthHelpers.ts` | Leitura e escrita dos tokens no storage |
| `src/api/axios.ts` | Interceptors de auth, injeção de token e renovação de sessão |

## Fluxo de Login

1. Usuário submete credenciais → `POST /auth/login`
2. A API retorna `accessToken` e `refreshToken`
3. Os tokens são armazenados via `AuthHelpers.saveTokens()`
4. `AuthContext` atualiza `currentUser` com os dados decodificados do JWT
5. O estado de autenticação fica disponível para componentes e páginas via `useAuth`

## Interceptors Axios

O interceptor em `src/api/axios.ts` injeta o `accessToken` em cada requisição autenticada:

```ts
axiosInstance.interceptors.request.use((config) => {
  const token = AuthHelpers.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

Quando a API retorna `401`, o interceptor de resposta tenta renovar o token com o `refreshToken` e repetir a requisição original:

```ts
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const newToken = await refreshAccessToken();
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return axiosInstance(error.config);
    }
    return Promise.reject(error);
  }
);
```

### Fluxo de renovação

| Etapa | Descrição |
|------|-------------|
| 1 | Uma requisição autenticada retorna `401` |
| 2 | O interceptor marca a requisição com `_retry` |
| 3 | `refreshAccessToken()` consulta o endpoint de refresh |
| 4 | Um novo `accessToken` é retornado e reaplicado no `Authorization` |
| 5 | A requisição original é reenviada com o novo token |

## useAuth Hook

O módulo de autenticação exporta o hook `useAuth` a partir do mesmo arquivo que declara o contexto. Ele consome o `AuthContext` via `useContext(AuthContext)` e disponibiliza o estado autenticado para os componentes da aplicação.

```tsx
import { useAuth } from '../modules/auth';

function MyComponent() {
  const { currentUser, logout } = useAuth();
  // currentUser.role, currentUser.name, etc.
}
```

### Contrato do hook

| Propriedade | Tipo | Responsabilidade |
|------------|------|-----------------|
| `currentUser` | objeto | Representa o usuário autenticado disponível no contexto |
| `logout` | função | Finaliza a sessão e limpa os dados de autenticação |

### AuthContext

O `AuthContext` é exportado a partir de `src/app/modules/auth/core/Auth.tsx`, o que permite que outros módulos acessem o contexto autenticado diretamente quando necessário. O provider mantém a estrutura de dados da sessão e expõe as ações de autenticação para a árvore de componentes.

| Propriedade | Tipo | Responsabilidade |
|-------------|------|-----------------|
| `currentUser` | objeto autenticado | Dados do usuário derivados do JWT |
| `isAuthorized` | boolean | Indica se existe sessão válida |
| `saveAuth` | função | Persiste tokens e estado autenticado |
| `logout` | função | Remove sessão e limpa credenciais |


## Permissões de Acesso

O módulo de autenticação também participa do controle de acesso por permissões por meio de `AbilityProtectedRoute`. A navegação e a renderização de páginas protegidas dependem do conjunto de permissões disponível no usuário autenticado.

### Componentes e responsabilidades

| Componente | Responsabilidade |
|------------|-----------------|
| `AbilityProtectedRoute` | Valida se o usuário possui a permissão exigida para renderizar a rota |
| `PERMISSIONS` | Constantes de autorização usadas nas rotas protegidas |
| `AuthContext` | Disponibiliza o usuário atual para regras de acesso e hooks consumidores |

### Fluxo de autorização

1. A aplicação lê o usuário autenticado a partir do `AuthContext`.
2. As rotas protegidas recebem a permissão esperada em `permission`.
3. `AbilityProtectedRoute` verifica se o usuário possui a permissão.
4. Se a permissão existir, o componente filho é renderizado; caso contrário, a navegação é bloqueada pela regra de acesso da aplicação.

### Exemplos de uso

#### Dashboard
A rota `dashboard/*` é encapsulada por `AbilityProtectedRoute` com a permissão `PERMISSIONS.DASHBOARD`.

```tsx
<Route
  element={
    <AbilityProtectedRoute permission={PERMISSIONS.DASHBOARD}>
      <DashboardWrapper />
    </AbilityProtectedRoute>
  }
  path="dashboard/*"
/>
```

#### Relatórios
O módulo de relatórios usa permissões específicas para cada grupo de páginas e subrotas. Cada rota recebe uma permissão do objeto `PERMISSIONS`, como:

| Rota | Permissão |
|------|------------|
| `/relatorios/vendas/geral` | `PERMISSIONS.RELATORIOS_VENDAS_VENDAS` |
| `/relatorios/vendas/produtos-nao-encontrados` | `PERMISSIONS.RELATORIOS_VENDAS_PRODUTOS_NAO_ENCONTRADOS` |
| `/relatorios/vendas/venda-financa` | `PERMISSIONS.RELATORIOS_VENDAS_VENDA_E_FINANCA` |
| `/relatorios/suprimentos/estoque/entrada-saida` | `PERMISSIONS.RELATORIOS_SUPRIMENTOS_ESTOQUE_ENTRADA_SAIDA` |
| `/relatorios/financeiro/geral/balancete` | `PERMISSIONS.RELATORIOS_FINANCEIRO_BALANCETE` |

### Estrutura de rota protegida

```tsx
<Route
  element={
    <AbilityProtectedRoute permission={PERMISSIONS.RELATORIOS_FINANCEIRO}>
      <Routes>
        ...
      </Routes>
    </AbilityProtectedRoute>
  }
/>
```

## Permissões e integração com a sessão

A sessão autenticada alimenta a camada de autorização. O `currentUser` exposto pelo `AuthContext` serve como base para as decisões de acesso nas rotas protegidas e nos componentes que consultam permissões na interface.

## Autenticação em componentes de formulário

Componentes de tela consomem o estado global de autenticação para tomar decisões de acesso, personalização e exibição de informações do usuário. O `AuthContext` centraliza esse fluxo e evita leitura direta de storage nos componentes.

## Módulo de Códigos de Barras de Produto

O módulo de autenticação é consumido por páginas protegidas, e a área de cadastro de produtos usa o mesmo padrão de estado centralizado para carregar dados vinculados ao usuário autenticado. No fluxo de produto, o sistema trabalha com uma coleção de códigos de barras em `ProductDto.barcodes`, com identificação de código principal, tipo do código e validações específicas.

### Componentes Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/pages/catalog/product/components/ProductGeneralSection.tsx` | Seção geral do formulário de produto com `BarcodeSection` |
| `src/app/pages/catalog/product/components/BarcodeSection.tsx` | Campo principal de código de barras e acesso ao modal de gerenciamento |
| `src/app/pages/catalog/product/modal/barcode-management/BarcodeManagementModal.tsx` | Modal de listagem e edição dos códigos de barras do produto |
| `src/app/pages/catalog/product/modal/barcode-management/BarcodeForm.tsx` | Formulário de inclusão/edição de um código de barras |
| `src/app/pages/catalog/product/modal/barcode-management/BarcodeListItem.tsx` | Item visual da lista de códigos |
| `src/app/pages/catalog/product/modal/barcode-management/_useGtinValidation.ts` | Validação remota de GTIN com consulta por código |
| `src/app/pages/catalog/product/core/_validation.ts` | Schema Yup do formulário de produto |

### Estrutura de Dados

O formulário de produto passa a trabalhar com `barcodes` como lista de `ProductBarcodeDto`.

| Campo | Tipo | Responsabilidade |
|-------|------|-----------------|
| `gtin` | string | Código de barras ou código interno, dependendo do tipo |
| `type` | `EnumType` | Tipo do código de barras |
| `primary` | boolean | Indica o código principal do produto |
| `id` | string/number | Identificador persistido do registro, quando existente |

### Fluxo do Formulário de Produto

1. `ProductGeneralSection` renderiza `BarcodeSection`.
2. `BarcodeSection` usa `getPrimaryBarcode(formik.values.barcodes)` para exibir o código principal no `GtinEanInput`.
3. Ao digitar ou pesquisar um código, `handlePrimaryGtinChange` e `handleSearchResult` atualizam o primeiro item marcado como `primary`.
4. O botão **Gerenciar códigos** abre `BarcodeManagementModal`.
5. O modal carrega os códigos em `barcodeList`, permite inclusão, edição, remoção e definição do principal.
6. Ao salvar, `BarcodeManagementModal` retorna a lista completa para o `Formik` do produto via `onSave`.

### BarcodeSection

O componente `BarcodeSection` encapsula o input principal de código de barras e o acesso ao gerenciamento completo dos códigos.

| Prop | Tipo | Responsabilidade |
|------|------|-----------------|
| `formik` | `FormikProps<ProductDto>` | Estado e validação do formulário de produto |
| `showSearchButton` | `boolean` | Exibe o botão de busca no `GtinEanInput` |
| `triggerSearchOnMount` | `boolean` | Dispara busca no carregamento do componente |
| `onSearchResult` | função | Recebe o resultado da busca remota por GTIN |

#### Comportamento

- Lê o código principal com `getPrimaryBarcode`.
- Mostra badge com a quantidade de códigos secundários quando há mais de um item.
- Ao perder foco, emite `SystemNotification.warning` quando o código principal tem aparência de GTIN dinâmico.
- Exibe mensagens de erro vindas de `formik.errors.barcodes`.

### BarcodeManagementModal

O modal de gerenciamento centraliza a lista de códigos do produto.

| Prop | Tipo | Responsabilidade |
|------|------|-----------------|
| `show` | `boolean` | Controla a visibilidade do modal |
| `barcodes` | `ProductBarcodeDto[]` | Lista recebida do formulário principal |
| `onClose` | função | Fecha o modal |
| `onSave` | função | Retorna a lista final de códigos |

#### Ações Disponíveis

| Ação | Resultado |
|------|-----------|
| Adicionar código | Abre `BarcodeForm` com um registro vazio |
| Editar | Carrega os dados do item selecionado no formulário |
| Definir como principal | Marca o item selecionado como `primary` e remove a marcação dos demais |
| Remover | Remove o item da lista quando não é o principal |
| Salvar | Envia a lista atualizada ao `Formik` do produto |

### BarcodeForm

O formulário de código de barras trata tanto códigos estáticos quanto dinâmicos.

| Prop | Tipo | Responsabilidade |
|------|------|-----------------|
| `initialValues` | `ProductBarcodeDto` | Valores iniciais do formulário |
| `editingIndex` | `number \| null` | Índice do item em edição |
| `existingBarcodes` | `ProductBarcodeDto[]` | Lista usada para validação de duplicidade |
| `disablePrimaryToggle` | `boolean` | Bloqueia a opção de marcar como principal |
| `onSubmit` | função | Confirma o registro do código |
| `onCancel` | função | Cancela a edição |

#### Regras de UI e validação

| Regra | Descrição |
|-------|-------------|
| Tipo dinâmico | Exibe banner informativo quando o tipo indica código dinâmico |
| Código interno | Para tipos dinâmicos, o campo trabalha como `Código interno` |
| Duplicidade | O GTIN não pode repetir outro código da mesma lista |
| Código de produto vinculado | `useGtinValidation()` consulta a API e sinaliza quando o código pertence a outro produto |
| Extração de código interno | Para códigos dinâmicos, `extractInternalCode()` normaliza o valor salvo |

### BarcodeListItem

Cada item da lista exibe o código, o tipo e o estado principal.

| Elemento | Comportamento |
|----------|---------------|
| Código | Mostra `gtin` ou `Cód. interno: gtin` quando o tipo é dinâmico |
| Badge de tipo | Usa `getTypeBadgeClass(barcode.type)` |
| Badge principal | Exibe ícone de estrela quando `primary` é `true` |
| Botão principal | Define o item como principal |
| Botão editar | Abre o formulário com os dados do item |
| Botão remover | Remove o item, respeitando as regras de proteção do principal |

### Validação de Produto

O schema `productFormSchema` valida a coleção de códigos em `barcodes`.

| Campo | Validação |
|-------|-----------|
| `barcodes` | array obrigatório com pelo menos um item |
| `barcodes[].gtin` | obrigatório |
| `barcodes[].type` | obrigatório |
| `barcodes[].primary` | booleano |

### Fluxo de Busca por GTIN

O componente `GtinEanInput` é usado para consulta de produto por código de barras.

1. O usuário informa um código.
2. O componente dispara a busca remota.
3. O retorno é tratado em `handleSearchResult`.
4. O código encontrado atualiza:
   - o item principal em `barcodes`
   - `sku`
   - `description`
   - `brand`
   - demais campos derivados do retorno da API

### useGtinValidation

O hook `useGtinValidation` usa `react-query` para consultar o backend por um GTIN informado.

| Estado/ação | Responsabilidade |
|-------------|-----------------|
| `validate(gtin)` | Inicia a consulta por código |
| `error` | Mensagem de validação exibida no formulário |
| `setError()` | Define mensagens de erro específicas |
| `clear()` | Remove erro e cancela a consulta corrente |

Se a API retorna um produto, o formulário exibe a mensagem:

| Situação | Mensagem |
|----------|-----------|
| GTIN localizado | `Este código pertence ao produto: <nome>` |
| GTIN inexistente/erro | Sem mensagem de bloqueio |

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Tratamento centralizado de erros, incluindo erros de autenticação
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de autenticação (`/auth/login`, `/auth/refresh`)
- [Hooks Customizados](/modulos/hooks/) — Outros hooks do sistema