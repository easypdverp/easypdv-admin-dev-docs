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

**Secrets/Tokens:** `GITHUB_TOKEN` (via `github.token`)

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

**Secrets/Tokens:** `GITHUB_TOKEN` (via `github.token`)

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
| `useQuery` | Busca os dados de cobrança | `isPending: isBillingLoading` |
| `useMutation` | Salva os dados de cobrança | `isPending` controla botão e envio |
| `useFormik` | Gerencia formulário | Integra `initialValues`, validação e submit |
| `SystemNotification.success` | Feedback positivo | Exibe confirmação após salvar |
| `SystemNotification.error` | Feedback de erro | Exibe mensagem retornada por `getErrorMessage(error)` |

#### Fluxo de dados

1. `useQuery` executa `getSystemBilling()`
2. A resposta preenche o formulário com `formik.setValues({ ...initialValues, ...response.data })`
3. O estado de carregamento da consulta é lido por `isBillingLoading`
4. O formulário envia os dados por `updateSystemBilling(values)` dentro de `mutationFn`
5. Durante o envio, o botão usa `updateMutation.isPending` para bloquear reenvio e exibir `Salvando...`
6. Em caso de sucesso, o componente dispara `SystemNotification.success("Dados de cobrança atualizados com sucesso")`
7. Em caso de erro, o tratamento usa `SystemNotification.error(getErrorMessage(error))`

#### Tabela de configuração

| Item | Valor | Uso |
|------|-------|-----|
| `queryKey` | `["systemBilling"]` | Cache dos dados de cobrança |
| `queryFn` | `getSystemBilling()` | Busca informações de cobrança do sistema |
| `mutationFn` | `updateSystemBilling(values)` | Persiste os dados do formulário |
| Estado de carregamento | `isPending` | Controla carregamento da consulta e da mutation |
| Botão de submit | `disabled={updateMutation.isPending}` | Bloqueia submissão durante o envio |

### SubscriptionDetailsTab

O componente `src/app/pages/subscription/components/SubscriptionDetailsTab.tsx` usa múltiplas consultas com `@tanstack/react-query` para carregar os dados da assinatura em blocos independentes.

| Consulta | `queryKey` | Função | Dado retornado |
|----------|------------|--------|----------------|
| Uso do sistema | `["getSystemUsage"]` | `getSystemUsage()` | `systemUsageData` |
| Proprietário do sistema | `["getSystemOwner"]` | `getSystemOwner()` | `systemOwnerData` |
| Módulos do sistema | `["getSystemModules"]` | `getSystemModules()` | `systemModulesData` |
| Plano da assinatura | `["getSystemPlan"]` | `getSystemPlan()` | `systemPlanData` |

#### Estados de carregamento

Cada consulta expõe `isPending`, mapeado localmente para os estados:

- `isUsageLoading`
- `isOwnerLoading`
- `isModulesLoading`
- `isPlanLoading`

Esses estados permitem renderização fragmentada dos blocos da interface, sem acoplar o carregamento de todos os dados em uma única consulta.

#### Fluxo de dados

1. Cada hook `useQuery` chama sua respectiva API
2. A resposta é retornada em `response.data`
3. O componente consome os dados por desestruturação:
   - `systemUsageData`
   - `systemOwnerData`
   - `systemModulesData`
   - `systemPlanData`
4. Erros são tratados pelos mecanismos globais de tratamento do cliente HTTP, sem handlers locais em cada consulta

#### Tabela de configuração

| Consulta | Chave | Observação |
|----------|-------|------------|
| Uso | `["getSystemUsage"]` | Consulta de métricas de uso do sistema |
| Proprietário | `["getSystemOwner"]` | Consulta de identificação do titular |
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
| `FormikProvider` / `useFormik` | Gerência de formulário | `SubscriptionBillingTab`, `SetupPage` |
| `useQuery` / `useMutation` | Acesso assíncrono a APIs | Páginas de setup e assinatura |

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