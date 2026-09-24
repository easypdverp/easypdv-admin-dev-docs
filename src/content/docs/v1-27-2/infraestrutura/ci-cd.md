---
title: CI/CD
description: Workflows de integracao continua e entrega continua do Despensinha ERP.
sidebar:
  order: 1
---

O Despensinha ERP utiliza **GitHub Actions** para CI/CD, com 8 workflows que cobrem release automatico, validacao de PRs, sincronizacao de branches e dispatch de documentacao.

## Visao Geral

| Workflow | Arquivo | Trigger | Proposito |
|----------|---------|---------|-----------|
| Release | `release.yml` | Push em `master` | Semantic-release (changelog, git tag, GitHub release) |
| Dispatch Docs | `dispatch-docs.yml` | `workflow_dispatch` (manual) | Envia versao para ambos repos de docs |
| PR Build | `pr-build.yml` | `workflow_call` | Check reutilizavel de build (types, lint, build) |
| PR Auto-approve | `pr-validation-auto-approve.yml` | PR em `develop` | Roda semantic PR + build, aprova e faz merge |
| Semantic PR | `semantic-pr.yml` | `workflow_call` | Valida titulo do PR (conventional commits) |
| Notify Changelog | `notify-changelog.yml` | Release publicada | Dispatch para repo externo de changelog |
| Sync Develop | `sync-develop-direct.yml` | Apos release workflow | Sincroniza `develop` com `master` apos release |
| Sync Branch | `sync-work-branch-direct.yml` | PR merged em `develop` | Sincroniza branch de origem com `develop` |

## release.yml

**Arquivo:** `.github/workflows/release.yml`  
**Trigger:** Push em `master` (ignora commits com `[skip ci]`)  
**Concurrency:** `release-${{ github.ref }}` (sem cancelamento)

**O que faz:**

1. Checkout com `fetch-depth: 0` para que o semantic-release leia historico e tags
2. Configura git author como `github-actions[bot]`
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
**Trigger:** `workflow_dispatch` (execucao manual com input opcional de versao)  
**Concurrency:** `dispatch-docs` (sem cancelamento)

**O que faz:**

1. Checkout com `sparse-checkout` apenas do `package.json`
2. Valida que `DISPATCH_TOKEN` esta configurado como secret
3. Detecta a versao: usa o input manual se fornecido, caso contrario le do `package.json`
4. Envia `repository_dispatch` para o repo de docs do usuario (`despensinha-erp-docs`)
5. Envia `repository_dispatch` para o repo de docs dev (`despensinha-erp-dev-docs`)
6. Gera resumo no step summary com versao e repos notificados

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
**Trigger:** `workflow_call` (reutilizavel, chamado por outros workflows)

**O que faz:**

1. Checkout do codigo
2. Configura Node.js 18
3. Instala dependencias com `npm install`
4. Verifica tipos com `npm run check-types`
5. Executa lint com `npm run lint`
6. Executa build com `npm run build`

**Secrets/Tokens:** Nenhum, usando apenas `GITHUB_TOKEN` implicito

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

1. Chama `semantic-pr.yml` para validar o titulo do PR
2. Chama `pr-build.yml` para executar o check de build
3. Quando os dois jobs concluem com sucesso:
   - ignora PRs draft e de forks
   - aprova o PR automaticamente
   - atualiza a branch com a base quando necessario
   - faz merge via squash
   - sincroniza a branch de origem com `develop` apos o merge

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
**Trigger:** `workflow_call` (reutilizavel, chamado por `pr-validation-auto-approve.yml`)

**O que faz:**

1. Valida que o titulo do PR segue a convencao de conventional commits
2. Usa `amannn/action-semantic-pull-request@v5`
3. Aceita titulos como `feat: ...`, `fix: ...` e `chore: ...`

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

1. Envia `repository_dispatch` para o repo externo de changelog publico
2. O payload inclui o nome do repositorio e a tag da release

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
**Trigger:** Apos o workflow "Release (semantic-release)" completar com sucesso em `master`

**O que faz:**

1. Checkout com `fetch-depth: 0` e ref `master`
2. Configura git author como `github-actions[bot]`
3. Verifica se a branch `develop` existe
4. Faz merge de `origin/master` em `develop`
5. Faz push de `develop` atualizada
6. Em caso de conflito, falha com mensagem de intervencao manual

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

1. Verifica que o PR foi merged e nao apenas fechado, e que nao e de fork
2. Obtem o SHA mais recente de `develop`
3. Atualiza a branch de origem do PR para apontar para o mesmo SHA de `develop` com force update
4. Mantem a branch de trabalho sincronizada, reduzindo conflitos em iteracoes futuras

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

O pipeline completo de release segue esta sequencia:

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

O pipeline de validacao de PRs segue esta sequencia:

```
PR aberto/atualizado em develop
    |
    v
pr-validation-auto-approve.yml
    |
    +---> semantic-pr.yml (valida titulo conventional commits)
    +---> pr-build.yml (check-types, lint, build)
    |
    v (se ambos passam)
    |
    +---> Auto-approve do PR
    +---> Atualiza branch se atrasada
    +---> Squash merge automatico
    +---> Sincroniza branch de origem com develop
```

## Interface de assinatura

A pagina de assinatura concentra os dados da assinatura em blocos responsivos, organizados com grid Bootstrap e cards de informacao. O componente principal `SubscriptionDetailsTab` renderiza um conjunto de metricas e listas a partir de `systemModulesData` e `systemUsageData`, com comportamento responsivo definido diretamente nas classes utilitarias.

### Estrutura de responsividade

A composição de colunas usa classes como `col-12`, `col-sm-6`, `col-md-4` e `col-xl`, permitindo que os blocos ocupem diferentes larguras conforme o breakpoint do layout.

| Regiao da interface | Classe de coluna | Comportamento |
|---------------------|------------------|---------------|
| Lista de modulos do sistema | `col-12 col-sm-6 col-xl-3` | 1 coluna no mobile, 2 colunas em telas pequenas, 4 colunas em telas extra grandes |
| Cards de resumo operacional | `col-6 col-md-4 col-xl` | 2 colunas no mobile, 3 colunas em telas medias e distribuicao flexivel em telas extra grandes |
| Cards de indicadores complementares | `col-6 col-md-4 col-xl` | Mesma regra de largura, preservando alinhamento em grade |
| Cartoes de status e disponibilidade | `col-6 col-md-4 col-xl` | Garante encaixe consistente no bloco final da tela |

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

### Dependencias visuais e comportamento

| Recurso | Identificador | Papel no componente |
|---------|--------------|--------------------|
| Grid responsivo | classes Bootstrap `row`, `col-*`, `g-4` | Responsividade e alinhamento dos blocos |
| Tipografia | classes `fs-5`, `fs-7`, `fs-2x`, `fw-bold` | Hierarquia visual dos valores |
| Iconografia | `ki-outline ki-chart-line-up-2`, `ki-outline ki-notification-on`, `ki-outline ki-screen` | Representa metrica, alerta e tela/status |
| Cores | `text-gray-600`, `text-gray-800`, `text-gray-300` | Diferencia dados primarios e secundarios |
| Estado vazio | condicional `systemModulesData?.modules && systemModulesData.modules.length > 0` | Evita renderizacao da lista quando nao ha modulos |

### Exemplo de estrutura renderizada

| Area | Conteudo esperado |
|------|-------------------|
| Lista de modulos | Cards em grade, com 1, 2 ou 4 colunas dependendo do viewport |
| Indicadores centrais | Cards com metricas numericas e subtitulos centralizados |
| Disponibilidade do sistema | Percentual exibido em destaque com valor derivado do objeto de uso |
| Informacoes complementares | Blocos com textos auxiliares e hierarquia visual padronizada |