---
title: CI/CD
description: Workflows de integracao continua e entrega continua do Despensinha ERP.
sidebar:
  order: 1
---

O Despensinha ERP utiliza **GitHub Actions** para CI/CD, com 8 workflows que cobrem release automático, validação de PRs, sincronização de branches e dispatch de documentação.

## Visão Geral

| Workflow | Arquivo | Trigger | Propósito |
|----------|---------|---------|-----------|
| Release | `release.yml` | Push em `master` | Semantic-release (changelog, git tag, GitHub release) |
| Dispatch Docs | `dispatch-docs.yml` | `workflow_dispatch` (manual) | Envia versão para ambos repositórios de docs |
| PR Build | `pr-build.yml` | `workflow_call` | Check reutilizável de build (types, lint, build) |
| PR Auto-approve | `pr-validation-auto-approve.yml` | PR em `develop` | Roda semantic PR + build, aprova e faz merge |
| Semantic PR | `semantic-pr.yml` | `workflow_call` | Valida título do PR (conventional commits) |
| Notify Changelog | `notify-changelog.yml` | Release publicada | Dispatch para repositório externo de changelog |
| Sync Develop | `sync-develop-direct.yml` | Após release workflow | Sincroniza `develop` com `master` após release |
| Sync Branch | `sync-work-branch-direct.yml` | PR merged em `develop` | Sincroniza branch de origem com `develop` |

## release.yml

**Arquivo:** `.github/workflows/release.yml`  
**Trigger:** Push em `master` (ignora commits com `[skip ci]`)  
**Concurrency:** `release-${{ github.ref }}` (sem cancelamento)

**O que faz:**

1. Checkout com `fetch-depth: 0` para o histórico completo de commits e tags
2. Configura o autor do git como `github-actions[bot]`
3. Executa semantic-release via `cycjimmy/semantic-release-action@v4`
4. Usa os plugins `conventional-changelog-conventionalcommits`, `@semantic-release/changelog` e `@semantic-release/git`
5. Gera automaticamente `CHANGELOG.md`, git tag e GitHub release

**Secrets/Tokens:** `GITHUB_TOKEN`

```yaml
# .github/workflows/release.yml
on:
  push:
    branches: [ master ]

jobs:
  release:
    if: contains(github.event.head_commit.message, '[skip ci]') == false
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Config git author
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
      - name: Semantic Release
        uses: cycjimmy/semantic-release-action@v4
        with:
          extra_plugins: |
            conventional-changelog-conventionalcommits
            @semantic-release/changelog
            @semantic-release/git
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## dispatch-docs.yml

**Arquivo:** `.github/workflows/dispatch-docs.yml`  
**Trigger:** `workflow_dispatch` (execução manual com input opcional de versão)
**Concurrency:** `dispatch-docs` (sem cancelamento)

**O que faz:**

1. Checkout com `sparse-checkout` apenas do `package.json`
2. Valida se `DISPATCH_TOKEN` está configurado como secret
3. Detecta a versão: usa o input manual quando fornecido, caso contrário lê do `package.json`
4. Envia `repository_dispatch` para o repositório de docs do usuário (`despensinha-erp-docs`)
5. Envia `repository_dispatch` para o repositório de docs dev (`despensinha-erp-dev-docs`)
6. Gera resumo no step summary com a versão e os repositórios notificados

**Secrets/Tokens:** `DISPATCH_TOKEN` (PAT com scope `repo` para cross-repo dispatch)

```yaml
# .github/workflows/dispatch-docs.yml
on:
  workflow_dispatch:
    inputs:
      version:
        type: string
        required: false
        description: "Versao do ERP (deixe vazio para usar package.json)"

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          sparse-checkout: package.json
          sparse-checkout-cone-mode: false

      - name: Validar DISPATCH_TOKEN
        run: |
          if [ -z "${{ secrets.DISPATCH_TOKEN }}" ]; then
            echo "::error::DISPATCH_TOKEN nao configurado."
            exit 1
          fi

      - name: Detectar versao
        id: version
        run: |
          if [ -n "${{ inputs.version }}" ]; then
            VERSION="${{ inputs.version }}"
          else
            VERSION=$(jq -r '.version' package.json)
          fi
          echo "value=$VERSION" >> "$GITHUB_OUTPUT"

      - name: Dispatch para docs usuario
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.DISPATCH_TOKEN }}
          repository: Despensinha/despensinha-erp-docs
          event-type: docs-version-update
          client-payload: '{"app_version": "${{ steps.version.outputs.value }}"}'

      - name: Dispatch para docs dev
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.DISPATCH_TOKEN }}
          repository: Despensinha/despensinha-erp-dev-docs
          event-type: docs-version-update
          client-payload: '{"app_version": "${{ steps.version.outputs.value }}"}'
```

## pr-build.yml

**Arquivo:** `.github/workflows/pr-build.yml`  
**Trigger:** `workflow_call` (reutilizável, chamado por outros workflows)

**O que faz:**

1. Checkout do código
2. Configura Node.js 18
3. Instala dependências com `npm install`
4. Verifica tipos com `npm run check-types`
5. Executa o linter com `npm run lint`
6. Executa o build com `npm run build`

**Secrets/Tokens:** nenhum, além do `GITHUB_TOKEN` implícito da execução

```yaml
# .github/workflows/pr-build.yml
on:
  workflow_call:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install
      - run: npm run check-types
      - run: npm run lint
      - run: npm run build
```

## pr-validation-auto-approve.yml

**Arquivo:** `.github/workflows/pr-validation-auto-approve.yml`  
**Trigger:** Pull request em `develop` (`opened`, `synchronize`, `reopened`, `ready_for_review`)

**O que faz:**

1. Chama `semantic-pr.yml` para validar o título do PR no padrão conventional commits
2. Chama `pr-build.yml` para o check de build
3. Se ambos passam:
   - ignora PRs draft e PRs vindos de forks
   - aprova o PR automaticamente
   - atualiza a branch quando estiver defasada em relação à base
   - faz merge via squash
   - sincroniza a branch de origem com `develop` após o merge

**Secrets/Tokens:** `GITHUB_TOKEN` via `github.token`

```yaml
# .github/workflows/pr-validation-auto-approve.yml
on:
  pull_request:
    branches: [ develop ]
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  job1:
    uses: ./.github/workflows/semantic-pr.yml
  job2:
    uses: ./.github/workflows/pr-build.yml
  job3:
    runs-on: ubuntu-latest
    needs: [job1, job2]
    if: success()
    steps:
      - name: Approve and try to merge
        uses: actions/github-script@v7
        with:
          script: |
            // Aprova PR, atualiza branch se necessario, merge via squash
            // Sincroniza branch de origem com develop apos merge
```

## semantic-pr.yml

**Arquivo:** `.github/workflows/semantic-pr.yml`  
**Trigger:** `workflow_call` (reutilizável, chamado por `pr-validation-auto-approve.yml`)

**O que faz:**

1. Valida se o título do PR segue a convenção de conventional commits
2. Usa `amannn/action-semantic-pull-request@v5`
3. Aceita títulos como `feat: ...`, `fix: ...` e `chore: ...`

**Secrets/Tokens:** `GITHUB_TOKEN`

```yaml
# .github/workflows/semantic-pr.yml
on:
  workflow_call:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## notify-changelog.yml

**Arquivo:** `.github/workflows/notify-changelog.yml`  
**Trigger:** Release publicada (`release: types: [published]`)

**O que faz:**

1. Envia `repository_dispatch` para o repositório externo de changelog público
2. O payload inclui o nome do repositório e a tag da release

**Secrets/Tokens:** `CHANGELOG_PAT` (PAT para dispatch cross-repo)

```yaml
# .github/workflows/notify-changelog.yml
on:
  release:
    types: [published]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Dispatch changelog update
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.CHANGELOG_PAT }}
          repository: seu-org/changelog-publico
          event-type: release-published
          client-payload: '{"repo": "${{ github.repository }}", "version": "${{ github.event.release.tag_name }}"}'
```

## sync-develop-direct.yml

**Arquivo:** `.github/workflows/sync-develop-direct.yml`  
**Trigger:** Após o workflow `Release (semantic-release)` completar com sucesso em `master`

**O que faz:**

1. Checkout com `fetch-depth: 0` e `ref: master`
2. Configura o autor do git como `github-actions[bot]`
3. Verifica se a branch `develop` existe
4. Faz merge de `origin/master` em `develop`
5. Faz push da `develop` atualizada
6. Em caso de conflito, falha com mensagem para intervenção manual

**Secrets/Tokens:** `GITHUB_TOKEN`

```yaml
# .github/workflows/sync-develop-direct.yml
on:
  workflow_run:
    workflows: ["Release (semantic-release)"]
    branches: [ master ]
    types:
      - completed

jobs:
  sync-develop:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: master
      - name: Sync develop with master
        run: |
          git fetch origin
          git checkout develop
          git pull origin develop
          git merge origin/master --no-edit
          git push origin develop
```

## sync-work-branch-direct.yml

**Arquivo:** `.github/workflows/sync-work-branch-direct.yml`  
**Trigger:** PR merged em `develop` (`pull_request` closed)

**O que faz:**

1. Verifica se o PR foi realmente merged e se não é de fork
2. Obtém o SHA mais recente de `develop`
3. Atualiza a branch de origem do PR para apontar para o mesmo SHA de `develop` com force update
4. Mantém a branch de trabalho sincronizada para evitar conflitos futuros

**Secrets/Tokens:** `GITHUB_TOKEN` via `github.token`

```yaml
# .github/workflows/sync-work-branch-direct.yml
on:
  pull_request:
    types: [closed]
    branches: [develop]

jobs:
  sync-branch:
    if: github.event.pull_request.merged == true && !github.event.pull_request.head.repo.fork
    runs-on: ubuntu-latest
    steps:
      - name: Sync source branch with develop
        uses: actions/github-script@v7
        with:
          script: |
            const developRef = await github.rest.git.getRef({
              owner, repo, ref: 'heads/develop'
            });
            await github.rest.git.updateRef({
              owner, repo,
              ref: `heads/${pr.head.ref}`,
              sha: developRef.data.object.sha,
              force: true
            });
```

## Fluxo de Release

O pipeline completo de release segue esta sequência:

```
PR merged em master
    |
    v
release.yml (semantic-release)
    |
    +---> CHANGELOG.md atualizado
    +---> Git tag criada (ex: v1.27.1)
    +---> GitHub Release publicada
    |
    v
notify-changelog.yml (disparado pela release)
    |
    +---> Dispatch para repo externo de changelog
    |
    v
sync-develop-direct.yml (disparado pelo release workflow)
    |
    +---> Merge master em develop
    +---> Push develop atualizada
```

## Fluxo de PR

O pipeline de validação de PRs segue esta sequência:

```
PR aberto/atualizado em develop
    |
    v
pr-validation-auto-approve.yml
    |
    +---> semantic-pr.yml (valida título conventional commits)
    +---> pr-build.yml (check-types, lint, build)
    |
    v (se ambos passam)
    |
    +---> Auto-approve do PR
    +---> Atualiza branch se atrasada
    +---> Squash merge automático
    +---> Sincroniza branch de origem com develop
```

## Interface de assinatura

A pagina de assinatura concentra os dados da assinatura e de cobrança em blocos responsivos, organizados com grid Bootstrap, cards de informação e uma tabela para listagem de empresas de cobrança. O componente principal `SubscriptionDetailsTab` continua renderizando métricas e listas a partir de `systemModulesData` e `systemUsageData`, enquanto `SubscriptionBillingTab` passa a organizar os dados de cobrança por empresa em uma `DataTable` e abre um modal dedicado para edição.

### Estrutura de responsividade

A composição de colunas usa classes como `col-12`, `col-sm-6`, `col-md-4` e `col-xl`, permitindo que os blocos ocupem diferentes larguras conforme o breakpoint do layout.

| Regiao da interface | Classe de coluna | Comportamento |
|---------------------|------------------|---------------|
| Lista de modulos do sistema | `col-12 col-sm-6 col-xl-3` | 1 coluna no mobile, 2 colunas em telas pequenas, 4 colunas em telas extra grandes |
| Cards de resumo operacional | `col-6 col-md-4 col-xl` | 2 colunas no mobile, 3 colunas em telas medias e distribuicao flexivel em telas extra grandes |
| Cards de indicadores complementares | `col-6 col-md-4 col-xl` | Mesma regra de largura, preservando alinhamento em grade |
| Cartoes de status e disponibilidade | `col-6 col-md-4 col-xl` | Garante encaixe consistente no bloco final da tela |
| Lista de cobranças | `DataTable` com `variant="list"` | Lista registros de empresas com ações por linha |
| Modal de edição de cobrança | `Modal` do React Bootstrap | Exibe formulário completo para edição por empresa |

### Dados exibidos por `SubscriptionDetailsTab`

| Fonte de dados | Propriedade | Uso na interface |
|----------------|------------|------------------|
| `systemModulesData` | `modules` | Lista os modulos disponiveis da assinatura, renderizada com `map(module => ...)` |
| `module` | `name` | Usado como `key` de cada item da lista |
| `systemUsageData` | `system_availability_percentage` | Exibe o percentual de disponibilidade do sistema |
| `systemUsageData` | demais campos consumidos pelo componente | Alimentam os cards de resumo, contadores e indicadores visuais |

### Componente e fluxo de renderizacao

O componente `SubscriptionDetailsTab` segue um fluxo direto de leitura dos dados e composicao visual:

1. Recebe os dados de assinatura e uso do sistema pelas estruturas de estado/consulta do modulo
2. Renderiza a grade de modulos quando `systemModulesData.modules.length > 0`
3. Para cada modulo, monta um card com:
   - nome do modulo
   - informacoes de apoio em layout flexivel
   - container com altura total `h-100`
4. Renderiza os cards de indicadores com:
   - icones da familia `ki-outline`
   - valores agregados
   - textos descritivos centralizados
5. Exibe disponibilidade do sistema com o valor de `systemUsageData?.system_availability_percentage || 0`

### Classes e componentes de layout

| Elemento | Classe principal | Finalidade |
|----------|------------------|-----------|
| Wrapper da lista de modulos | `row g-4` | Define grid com espacamento entre itens |
| Card de modulo | `d-flex flex-column gap-2 p-4 bg-light rounded h-100` | Estrutura vertical com fundo claro e altura uniforme |
| Cabeçalho do card | `d-flex justify-content-between align-items-center` | Alinha titulo e metadados do modulo |
| Bloco de metricas | `d-flex flex-column align-items-center justify-content-center` | Centraliza informacoes numericas e textos |
| Bloco de indicadores | `d-flex flex-column gap-4` | Organiza cards empilhados dentro da coluna |
| Card interno de status | `p-4 bg-light rounded flex-grow-1` | Mantem o bloco preenchendo toda a altura disponivel |
| Tabela de cobranças | `DataTable` | Lista os registros de `CompanyBillingDto` |
| Modal de edição | `Modal centered size="lg"` | Permite edição dos dados da empresa selecionada |

### Dependencias visuais e comportamento

| Recurso | Identificador | Papel no componente |
|---------|--------------|--------------------|
| Grid responsivo | classes Bootstrap `row`, `col-*`, `g-4` | Responsividade e alinhamento dos blocos |
| Tipografia | classes `fs-5`, `fs-7`, `fs-2x`, `fw-bold` | Hierarquia visual dos valores |
| Iconografia | `ki-outline ki-chart-line-up-2`, `ki-outline ki-notification-on`, `ki-outline ki-screen` | Representa metrica, alerta e tela/status |
| Cores | `text-gray-600`, `text-gray-800`, `text-gray-300` | Diferencia dados primarios e secundarios |
| Estado vazio | condicional `systemModulesData?.modules && systemModulesData.modules.length > 0` | Evita renderizacao da lista quando nao ha modulos |
| Indicador de status | `StatusBadge` | Exibe situação da empresa na tabela de cobrança |
| Ações por linha | `RowMenuDropdown` | Abre o menu contextual com a ação de edição |
| Modal de edição | `EditCompanyBillingModal` | Encapsula formulário, validação e submissão |

### Estrutura da cobrança por empresa

A aba `SubscriptionBillingTab` organiza os dados de cobrança em dois blocos principais:

1. **Dados de cobrança utilizados pela EasyPDV**  
   Exibe uma tabela com as empresas cadastradas para faturamento.
2. **Forma de pagamento**  
   Mantém a visualização da configuração de boleto bancário com status e detalhes do ciclo de cobrança.

A tabela usa a hook `useCompanyBillings`, o identificador de cache `subscriptionKeys.billings` e a função `getCompanyBillingColumns` para definir as colunas e o comportamento das ações.

#### Fluxo de dados da tabela

1. `useCompanyBillings()` executa `listCompanyBillings()`
2. A resposta é normalizada como `CompanyBillingDto[]`
3. `getCompanyBillingColumns({ onEdit: setEditing })` constrói as colunas com:
   - empresa
   - nome de cobrança
   - CPF/CNPJ formatado
   - e-mail
   - menu de ações
4. A seleção de **Editar** em cada linha preenche o estado `editing`
5. Quando `editing` possui valor, o componente renderiza `EditCompanyBillingModal`

### Tabela de campos de `CompanyBillingDto`

| Campo | Tipo/Origem | Uso na interface |
|-------|-------------|------------------|
| `company` | relação da empresa | Exibido na coluna **EMPRESA** com `billedCompanyName(company)` e badge de inatividade |
| `name` | string | Exibido em **NOME DE COBRANÇA** |
| `identification_document` | string | Exibido em **CPF/CNPJ** com formatação por `formatBillingDocument` |
| `email` | string | Exibido em **E-MAIL** |
| `company.id` | string | Usado como chave de atualização no formulário de edição |
| `company.active` | boolean | Define a renderização de `StatusBadge` com rótulo **Inativa** |

### `getCompanyBillingColumns`

A função `getCompanyBillingColumns` recebe um objeto de handlers e devolve a configuração das colunas da `DataTable`.

| Parâmetro | Tipo | Finalidade |
|-----------|------|-----------|
| `onEdit` | `(billing: CompanyBillingDto) => void` | Abre o modal de edição com o registro selecionado |

| Coluna | Header | Renderização |
|--------|--------|--------------|
| `company` | `EMPRESA` | Combina nome da empresa e badge de status |
| `name` | `NOME DE COBRANÇA` | Usa `accessorKey: 'name'` |
| `identification_document` | `CPF/CNPJ` | Exibe documento formatado ou `--` |
| `email` | `E-MAIL` | Usa `accessorKey: 'email'` |
| `actions` | vazio | Renderiza `RowMenuDropdown` com ação **Editar** |

### `EditCompanyBillingModal`

O componente `EditCompanyBillingModal` encapsula o fluxo de edição de cobrança por empresa com `Modal`, `Formik`, `useMutation` e `useQueryClient`.

| Elemento | Responsabilidade | Props / Estado |
|----------|------------------|----------------|
| `Modal` | Exibe a janela centralizada | `show`, `centered`, `size="lg"` |
| `Formik` | Gerencia o formulário de `CompanyBillingDto` | `initialValues`, `validationSchema`, `onSubmit` |
| `useMutation` | Persiste os dados da cobrança | `mutationFn: updateCompanyBilling(...)` |
| `useQueryClient` | Sincroniza cache | `invalidateQueries({ queryKey: subscriptionKeys.billings })` |
| `CompanyBillingForm` | Renderiza os campos do formulário | `formik` |

#### Fluxo de submissão

1. O modal recebe `billing` e `onClose`
2. `toCompanyBillingFormValues(billing)` converte o DTO para valores de formulário
3. `useFormik` valida os campos com `companyBillingSchema`
4. No submit, `updateMutation.mutate(values)` chama `updateCompanyBilling(billing.company.id, values)`
5. Em caso de sucesso:
   - `SystemNotification.success('Dados de cobrança atualizados com sucesso')`
   - `queryClient.invalidateQueries({ queryKey: subscriptionKeys.billings })`
   - `onClose()`
6. Em caso de erro:
   - `SystemNotification.error(getErrorMessage(error))`

### `CompanyBillingForm`

O componente `CompanyBillingForm` concentra os campos editáveis da cobrança da empresa. Ele recebe `formik` via prop e mantém toda a lógica de entrada, mascaramento e sincronização de valores.

| Prop | Tipo | Descrição |
|------|------|-------------|
| `formik` | `FormikProps<CompanyBillingDto>` | Objeto de estado e helpers do formulário |

#### Campos do formulário

| Campo | Componente | Comportamento |
|-------|------------|---------------|
| `person_type` | `Select` | Define se o documento exibido é CPF ou CNPJ |
| `name` | `<input type="text">` | Campo obrigatório de nome ou razão social |
| `identification_document` | `CpfInput` / `CnpjInput` | Alterna conforme `person_type` |
| `tax_regime` | `Select` | Seleção opcional de regime tributário |
| `state_registration` | `<input type="text">` | Inscrição estadual, desabilitada quando `state_registration_exempt` está marcado |
| `state_registration_exempt` | `checkbox` | Limpa `state_registration` ao marcar isenção |
| `email` | `<input type="email">` | Campo obrigatório de e-mail |
| `telephone` | `PatternFormat` | Máscara de telefone `(##) #####-####` |
| `address` | `ContactAddressInputGroup` | Grupo de campos do endereço de cobrança |

#### Regras de comportamento

| Regra | Implementação |
|-------|---------------|
| Alternar CPF/CNPJ | Verifica `formik.values.person_type?.value === 'PHYSICAL'` |
| Limpar documento ao trocar tipo | `formik.setFieldValue('identification_document', '')` |
| Exibir máscara de telefone | `PatternFormat` com `format="(##) #####-####"` |
| Controlar IE isento | Checkbox `state_registration_exempt` |
| Limpar inscrição estadual ao isentar | `formik.setFieldValue('state_registration', '')` |
| Validar endereço obrigatório | `requiredFields={['zip_code', 'street', 'number', 'neighborhood', 'city', 'state']}` |
| Validar após submit | `shouldValidate={formik.submitCount > 0}` |

### `companyBillingSchema`

A validação do formulário usa Yup em `companyBillingSchema`.

| Campo | Regra | Mensagem |
|-------|-------|----------|
| `name` | obrigatório | `Nome é obrigatório` |
| `identification_document` | obrigatório | `CPF/CNPJ é obrigatório` |
| `email` | obrigatório e formato e-mail | `E-mail inválido` / `E-mail é obrigatório` |
| `telephone` | opcional | sem validação obrigatória |
| `address.zip_code` | obrigatório | `CEP é obrigatório` |
| `address.street` | obrigatório | `Endereço é obrigatório` |
| `address.number` | obrigatório | `Número é obrigatório` |
| `address.neighborhood` | obrigatório | `Bairro é obrigatório` |
| `address.city` | obrigatório | `Cidade é obrigatório` |
| `address.state.value` | obrigatório | `Estado é obrigatório` |

### Tabela de configuração da edição de cobrança

| Item | Valor | Uso |
|------|-------|-----|
| `queryKey` | `subscriptionKeys.billings` | Cache da lista de cobranças |
| `queryFn` | `listCompanyBillings()` | Busca as empresas de cobrança |
| `mutationFn` | `updateCompanyBilling(companyId, billing)` | Persiste a cobrança da empresa selecionada |
| `tableKey` | `company-billings` | Identificador da tabela na `DataTable` |
| `variant` | `list` | Apresentação em formato de lista |
| `hasMinHeight` | `false` | Remove altura mínima da tabela |
| `isSearchable` | `false` | Desabilita busca interna |
| `size` do modal | `lg` | Exibe o formulário com área suficiente para os campos |

### Dependências visuais e comportamento da cobrança

| Recurso | Identificador | Papel no componente |
|---------|--------------|--------------------|
| `MetronicCard` | `className="h-auto"` | Contêiner visual dos blocos de cobrança |
| `DataTable` | `variant="list"` | Lista registros com ações por linha |
| `StatusBadge` | `tone="danger"` | Destaca empresa inativa |
| `RowMenuDropdown` | ação `Editar` | Dispara a edição do registro |
| `Modal` | `react-bootstrap/Modal` | Edição em contexto sobreposto |
| `Button` | `react-bootstrap/Button` | Ações de cancelar e salvar |
| `PatternFormat` | `react-number-format` | Máscara de telefone |
| `Select` | `react-select` | Campos de enumeração |
| `CpfInput` / `CnpjInput` | inputs customizados | Máscara do documento conforme o tipo |
| `ContactAddressInputGroup` | grupo de endereço | Subformulário de endereço de cobrança |

### Exemplo de estrutura renderizada

| Area | Conteudo esperado |
|------|-------------------|
| Lista de modulos | Cards em grade, com 1, 2 ou 4 colunas dependendo do viewport |
| Indicadores centrais | Cards com metricas numericas e subtitulos centralizados |
| Disponibilidade do sistema | Percentual exibido em destaque com valor derivado do objeto de uso |
| Lista de cobranças | Tabela com empresa, nome de cobrança, documento, e-mail e menu de ações |
| Edição de cobrança | Modal com formulário completo e validação por campo |
| Forma de pagamento | Bloco fixo com boleto bancário, badge de status e botão de ação desabilitado |

## Integração com React Query na aplicação

A aplicação usa **@tanstack/react-query** nas páginas de setup e assinatura para controle de requisições assíncronas, mutações e estados de carregamento. O padrão centraliza chamadas HTTP, sincronização de dados e tratamento de erros por meio de `queryKey`, `queryFn`, `mutationFn` e estados como `isPending` e `isError`.

### SetupPage

A página `src/app/pages/setup/SetupPage.tsx` utiliza `useMutation` e `useQuery` de `@tanstack/react-query` para controlar o fluxo de inicialização da empresa.

| Componente/Hook | Função | Fluxo de dados |
|-----------------|--------|----------------|
| `useMutation` | Executa `setupCompany(data)` | Recebe `SetupRequestDto` e envia os dados de configuração da empresa |
| `useQuery` | Carrega os detalhes da configuração | Busca o estado de setup via `getSetupDetails()` |
| `SystemNotification.error` | Exibe erro de configuração | Recebe `getErrorMessage(error)` no `onError` da mutation |
| `StepperComponent` | Navegação entre etapas | Avança para a etapa correta quando a API retorna `404` |

#### Fluxo de carregamento

1. `setupDetailsQuery` executa quando o `StepperComponent` está disponível
2. `queryFn` chama `getSetupDetails()`
3. Se a API responde com `404`, o fluxo interpreta que o setup ainda não foi concluído e chama `stepper?.goto(1)`
4. O estado `isLoading` da página é encerrado quando `setupDetailsQuery.isSuccess` ou `setupDetailsQuery.isError` fica verdadeiro
5. `meta: { suppressGlobalError: true }` evita toast global para o caso de `404`, mantendo o tratamento local da tela

#### Tabela de configuração

| Propriedade | Valor | Descrição |
|------------|-------|-------------|
| `queryKey` | `['setupPage']` | Chave de cache da consulta de setup |
| `queryFn` | `getSetupDetails()` | Busca os detalhes da configuração da empresa |
| `retry` | `false` | Desabilita repetição automática da consulta |
| `enabled` | `!!stepper` | Executa somente após a instância do stepper existir |
| `meta.suppressGlobalError` | `true` | Mantém erro sem toast global |

### SubscriptionPage

A página `src/app/pages/subscription/SubscriptionPage.tsx` usa o componente `PageShell` para encapsular o conteúdo da assinatura com título padronizado.

| Componente | Responsabilidade | Props |
|------------|------------------|-------|
| `PageShell` | Estrutura de página com cabeçalho | `title="Minha Assinatura"` |
| `Outlet` | Renderização das abas-filhas | Recebe a rota ativa de assinatura |
| `Link` | Navegação entre abas | Gera links para detalhes e cobrança |

O `PageShell` fornece a moldura da página e substitui a estrutura manual com container dedicado. O conteúdo interno mantém a navegação por tabs e o `Outlet` continua responsável por renderizar a aba selecionada.

### SubscriptionBillingTab

O componente `src/app/pages/subscription/components/SubscriptionBillingTab.tsx` controla os dados de cobrança do sistema.

| Hook | Função | Estado observado |
|------|--------|------------------|
| `useQuery` | Busca os dados de cobrança | `isPending` controla o carregamento da lista |
| `useMutation` | Salva os dados de cobrança | `isPending` controla botão e envio |
| `useFormik` | Gerencia formulário | Integra `initialValues`, validação e submit |
| `useQueryClient` | Sincroniza cache | Invalida `subscriptionKeys.billings` após salvar |
| `SystemNotification.success` | Feedback positivo | Exibe confirmação após salvar |
| `SystemNotification.error` | Feedback de erro | Exibe mensagem retornada por `getErrorMessage(error)` |

#### Fluxo de dados

1. `useQuery` executa `listCompanyBillings()`
2. A resposta preenche a tabela com `CompanyBillingDto[]`
3. `getCompanyBillingColumns({ onEdit })` define a coluna de ações e o acionamento do modal
4. Ao selecionar **Editar**, o estado `editing` recebe o registro da linha
5. `EditCompanyBillingModal` abre com os dados da cobrança selecionada
6. O submit do modal chama `updateCompanyBilling(billing.company.id, values)`
7. Após sucesso, a lista é invalidada por `subscriptionKeys.billings` e a tela recarrega os registros

#### Tabela de configuração

| Item | Valor | Uso |
|------|-------|-----|
| `queryKey` | `subscriptionKeys.billings` | Cache dos dados de cobrança |
| `queryFn` | `listCompanyBillings()` | Busca informações de cobrança do sistema |
| `mutationFn` | `updateCompanyBilling(companyId, values)` | Persiste os dados do formulário |
| Estado de carregamento | `isPending` | Controla carregamento da consulta |
| Botão de submit | `disabled={updateMutation.isPending}` | Bloqueia submissão durante o envio |
| Invalidação de cache | `invalidateQueries({ queryKey: subscriptionKeys.billings })` | Recarrega a lista após salvar |

### SubscriptionDetailsTab

O componente `src/app/pages/subscription/components/SubscriptionDetailsTab.tsx` usa múltiplas consultas com `@tanstack/react-query` para carregar os dados da assinatura em blocos independentes.

| Consulta | `queryKey` | Função | Dado retornado |
|----------|------------|--------|----------------|
| Uso do sistema | `["getSystemUsage"]` | `getSystemUsage()` | `systemUsageData` |
| Módulos do sistema | `["getSystemModules"]` | `getSystemModules()` | `systemModulesData` |
| Plano da assinatura | `["getSystemPlan"]` | `getSystemPlan()` | `systemPlanData` |

#### Estados de carregamento

Cada consulta expõe `isPending`, mapeado localmente para os estados:

- `isUsageLoading`
- `isModulesLoading`
- `isPlanLoading`

Esses estados permitem renderização fragmentada dos blocos da interface, sem acoplar o carregamento de todos os dados em uma única consulta.

#### Fluxo de dados

1. Cada hook `useQuery` chama sua respectiva API
2. A resposta é retornada em `response.data`
3. O componente consome os dados por desestruturação:
   - `systemUsageData`
   - `systemModulesData`
   - `systemPlanData`
4. Erros são tratados pelos mecanismos globais de tratamento do cliente HTTP, sem handlers locais em cada consulta

#### Tabela de configuração

| Consulta | Chave | Observação |
|----------|-------|------------|
| Uso | `["getSystemUsage"]` | Consulta de métricas de uso do sistema |
| Módulos | `["getSystemModules"]` | Consulta da lista de módulos habilitados |
| Plano | `["getSystemPlan"]` | Consulta dos dados do plano contratado |

### Padrões de React Query no ERP

O código da aplicação segue alguns padrões consistentes no uso de `@tanstack/react-query`.

| Padrão | Componente/Hook | Propósito |
|--------|------------------|-----------|
| `mutationFn` em objeto | `useMutation({ mutationFn, onError, onSuccess })` | Organiza a mutação e seus callbacks em uma única configuração |
| `isPending` | `useQuery` e `useMutation` | Representa estados de carregamento em consultas e mutações |
| `queryKey` explícita | `useQuery({ queryKey: [...] })` | Identifica e cacheia cada consulta |
| Tratamento local de erro | `onError` com `SystemNotification.error` | Exibe feedback contextual para o usuário |
| Tratamento local de sucesso | `onSuccess` com `SystemNotification.success` | Confirma operação concluída |
| `meta.suppressGlobalError` | `useQuery` | Controla se o erro deve gerar notificação global |

### Componentes relacionados

| Componente | Papel no fluxo | Dependências |
|------------|----------------|-------------|
| `SystemNotification` | Feedback visual de erro e sucesso | `getErrorMessage(error)` |
| `PageShell` | Layout de página com título | `SubscriptionPage` |
| `StepperComponent` | Navegação da etapa de setup | `SetupPage` |
| `FormikProvider` / `useFormik` | Gerência de formulário | `SubscriptionBillingTab`, `SetupPage`, `EditCompanyBillingModal` |
| `useQuery` / `useMutation` | Acesso assíncrono a APIs | Páginas de setup e assinatura |
| `DataTable` | Exibição tabular de cobrança | `SubscriptionBillingTab` |
| `EditCompanyBillingModal` | Edição dos dados da empresa | `SubscriptionBillingTab` |
| `CompanyBillingForm` | Formulário de cobrança | `EditCompanyBillingModal` |