---
title: Autenticação
description: Fluxo de autenticação JWT no Despensinha ERP.
sidebar:
  order: 1
---

A autenticação usa **JWT** com `accessToken` e `refreshToken`. O estado do usuário autenticado fica centralizado no `AuthContext`, e os interceptors do Axios tratam a inclusão automática do token nas requisições e a renovação do `accessToken` quando a API retorna `401`.

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/modules/auth/core/Auth.tsx` | Criação e exportação do `AuthContext`, provider e hook de consumo |
| `src/app/modules/auth/core/AuthHelpers.ts` | Leitura, escrita e remoção dos tokens no storage |
| `src/api/axios.ts` | Interceptors de autenticação, refresh token e retry de requisições |
| `src/app/modules/auth/index.ts` | Exportação do hook `useAuth` e do contexto de autenticação |

## Fluxo de Login

1. O usuário submete as credenciais no formulário de autenticação.
2. A aplicação executa `POST /auth/login`.
3. A API retorna `accessToken`, `refreshToken` e os dados do usuário autenticado.
4. `AuthHelpers.saveTokens()` persiste os tokens no storage.
5. O `AuthContext` decodifica o `accessToken` e atualiza `currentUser`.
6. Os componentes consumem os dados via `useAuth()`.

### Campos do payload de autenticação

| Campo | Tipo | Descrição |
|-------|------|-------------|
| `accessToken` | `string` | Token usado nas requisições autenticadas |
| `refreshToken` | `string` | Token usado na renovação da sessão |
| `currentUser` | objeto | Dados derivados do JWT e expostos pelo contexto |

## Interceptors Axios

O interceptor de requisição em `src/api/axios.ts` injeta o `accessToken` no header `Authorization` de todas as chamadas autenticadas.

```ts
axiosInstance.interceptors.request.use((config) => {
  const token = AuthHelpers.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### Responsabilidade do interceptor de requisição

| Etapa | Comportamento |
|-------|---------------|
| Leitura do token | Recupera o `accessToken` do storage via `AuthHelpers.getAccessToken()` |
| Montagem do header | Inclui `Authorization: Bearer <token>` |
| Encaminhamento | Mantém a requisição original sem alterar o restante do `config` |

Quando a API responde com `401`, o interceptor de resposta tenta renovar o token usando o `refreshToken` e reexecuta a requisição original.

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

### Responsabilidade do interceptor de resposta

| Etapa | Comportamento |
|-------|---------------|
| Detecção do `401` | Identifica falha de autenticação na resposta da API |
| Controle de repetição | Usa `error.config._retry` para evitar loop infinito |
| Renovação | Chama `refreshAccessToken()` para obter novo `accessToken` |
| Retry | Reenvia a requisição original com o novo token |

## Refresh Token

O fluxo de renovação usa o endpoint de refresh da API e mantém a sessão sem intervenção do usuário enquanto o `refreshToken` permanece válido.

### Endpoint utilizado

| Endpoint | Finalidade |
|----------|------------|
| `POST /auth/refresh` | Gera um novo `accessToken` a partir do `refreshToken` |

### Fluxo de renovação

1. A requisição retorna `401`.
2. O interceptor de resposta executa `refreshAccessToken()`.
3. O novo `accessToken` é salvo no storage.
4. O header `Authorization` da requisição original é atualizado.
5. A requisição é executada novamente.

## AuthContext

O `AuthContext` é exportado a partir de `src/app/modules/auth/core/Auth.tsx`, o que permite que outros módulos acessem o contexto autenticado diretamente quando necessário. O provider mantém a estrutura de dados da sessão e expõe as ações de autenticação para a árvore de componentes.

| Propriedade | Tipo | Responsabilidade |
|-------------|------|-----------------|
| `currentUser` | objeto autenticado | Dados do usuário derivados do JWT |
| `isAuthorized` | boolean | Indica se existe sessão válida |
| `saveAuth` | função | Persiste tokens e estado autenticado |
| `logout` | função | Remove sessão e limpa credenciais |


### Fluxo de dados

| Origem | Destino | Papel |
|--------|---------|------|
| Resposta do login | `AuthHelpers` | Persistência dos tokens |
| `accessToken` | `AuthContext` | Decodificação dos dados do usuário |
| `AuthContext` | componentes | Distribuição de `currentUser` e ações de sessão |
| `logout()` | storage + contexto | Limpeza dos tokens e do estado autenticado |

## useAuth Hook

O hook `useAuth` é exportado pelo mesmo arquivo que declara o contexto, consome `AuthContext` via `useContext(AuthContext)` e entrega os dados e ações da sessão aos componentes.

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

### Uso típico

| Valor | Uso |
|-------|-----|
| `currentUser.name` | Exibição do nome do usuário na interface |
| `currentUser.role` | Controle de permissões e visibilidade de componentes |
| `logout()` | Encerramento da sessão |
| `isAuthorized` | Proteção de rotas e renderização condicional |

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

## Logout

O logout limpa o estado autenticado e remove os tokens armazenados, encerrando a sessão local.

### Efeitos do logout

| Ação | Resultado |
|------|-----------|
| Remoção de `accessToken` | Interceptores deixam de enviar autenticação |
| Remoção de `refreshToken` | Renovação de sessão fica indisponível |
| Limpeza do `currentUser` | Interface volta ao estado anônimo |
| Redirecionamento | Usuário retorna para a tela de acesso |

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Tratamento centralizado de erros, incluindo erros de autenticação
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de autenticação (`/auth/login`, `/auth/refresh`)
- [Hooks Customizados](/modulos/hooks/) — Outros hooks do sistema