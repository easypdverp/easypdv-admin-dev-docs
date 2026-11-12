---
title: CI/CD
description: Workflows de integracao continua e entrega continua do Despensinha ERP.
sidebar:
  order: 1
---

## Pagina atual: CI/CD
Secao: infraestrutura


## Conteudo atual da pagina:

O Despensinha ERP utiliza **GitHub Actions** para CI/CD, com 9 workflows que cobrem release automático, validação de PRs, análise estática e de vulnerabilidades, sincronização de branches, auditoria de push direto e dispatch de documentação.

## Visão Geral

| Workflow | Arquivo | Trigger | Propósito |
|----------|---------|---------|-----------|
| Release | `release.yml` | Push em `master` | Semantic-release (changelog, git tag, GitHub release) e dispatch da versão nova para a documentação |
| Dispatch Docs | `dispatch-docs.yml` | `workflow_dispatch` (manual, ou disparado pelo `release.yml`) | Envia a versão (e a tag anterior) para os repositórios de documentação do usuário e dev |
| Notify Changelog | `notify-changelog.yml` | Release publicada | Dispatch para repositório externo de changelog |
| PR Validation | `pr-validation.yml` | PR em `develop` | Valida o título (conventional commits) e, em paralelo, roda ESLint, `tsc` e Vitest, com um único build por push |
| SonarQube | `sonarqube.yml` | PR e push em `develop`, `workflow_dispatch` | Análise estática do SonarQube, restrita à `develop` |
| Trivy - develop | `trivy-develop.yml` | Push em `develop`, `workflow_dispatch` | Varredura de vulnerabilidades na imagem Docker, via workflow reutilizável do `easypdv-scripts` |
| Sync Develop | `sync-develop-direct.yml` | Após o `release.yml` concluir em `master` | Sincroniza `develop` com `master`, empurrando com uma chave de deploy |
| Sync Branch | `sync-work-branch-direct.yml` | PR merged em `develop` | Atualiza a branch de origem do PR para o mesmo SHA de `develop` |
| Auditoria de push direto | `direct-push-audit.yml` | Push em `main`/`master` | Abre ou comenta uma issue quando o commit chega sem PR associado |

## release.yml

**Arquivo:** `.github/workflows/release.yml`  
**Trigger:** Push em `master` (ignora commits com `[skip ci]`, para não entrar em loop com o commit do próprio semantic-release)  
**Concurrency:** `release-${{ github.ref }}` (sem cancelamento)

**O que faz:**

1. Checkout com `fetch-depth: 0` para o histórico completo de commits e tags
2. Configura o autor do git como `github-actions[bot]`
3. Executa semantic-release via `cycjimmy/semantic-release-action@v4`
4. Usa os plugins `conventional-changelog-conventionalcommits`, `@semantic-release/changelog` e `@semantic-release/git`
5. Gera automaticamente `CHANGELOG.md`, git tag e GitHub release
6. Quando uma release nova é publicada, dispara o `dispatch-docs.yml` com a versão nova

**Secrets/Tokens:** `GITHUB_TOKEN`

```yaml
# .github/workflows/release.yml
on:
  push:
    branches: [master]

jobs:
  release:
    if: contains(github.event.head_commit.message, '[skip ci]') == false
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Config git author (para @semantic-release/git)
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
      - name: Semantic Release
        id: release
        uses: cycjimmy/semantic-release-action@v4
        with:
          extra_plugins: |
            conventional-changelog-conventionalcommits
            @semantic-release/changelog
            @semantic-release/git
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Dispatch docs version update
        if: steps.release.outputs.new_release_published == 'true'
        run: gh workflow run dispatch-docs.yml -f version="${{ steps.release.outputs.new_release_version }}"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## dispatch-docs.yml

**Arquivo:** `.github/workflows/dispatch-docs.yml`  
**Trigger:** `workflow_dispatch` (execução manual, com input opcional de versão, ou disparado pelo `release.yml`)  
**Concurrency:** `dispatch-docs` (sem cancelamento)

**O que faz:**

1. Checkout com `fetch-depth: 0`
2. Valida se `DISPATCH_TOKEN` está configurado como secret
3. Detecta a versão: usa o input manual quando fornecido, caso contrário lê do `package.json`
4. Detecta a tag anterior, para informar no payload de onde a versão evoluiu
5. Envia `repository_dispatch` para o repositório de docs do usuário (`easypdv-admin-docs`)
6. Envia `repository_dispatch` para o repositório de docs dev (`easypdv-admin-dev-docs`)
7. Gera resumo no step summary com a versão, a tag anterior e os repositórios notificados

**Secrets/Tokens:** `DISPATCH_TOKEN` (PAT com scope `repo` para cross-repo dispatch)

```yaml
# .github/workflows/dispatch-docs.yml
on:
  workflow_dispatch:
    inputs:
      version:
        type: string
        required: false

jobs:
  dispatch:
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Dispatch para docs usuario
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.DISPATCH_TOKEN }}
          repository: easypdverp/easypdv-admin-docs
          event-type: docs-version-update

      - name: Dispatch para docs dev
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.DISPATCH_TOKEN }}
          repository: easypdverp/easypdv-admin-dev-docs
          event-type: docs-version-update
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
    runs-on: [self-hosted, linux]
    steps:
      - uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.CHANGELOG_PAT }}
          repository: seu-org/changelog-publico
          event-type: release-published
          client-payload: '{"repo": "${{ github.repository }}", "version": "${{ github.event.release.tag_name }}"}'
```

## pr-validation.yml

**Arquivo:** `.github/workflows/pr-validation.yml`  
**Trigger:** PR em `develop` (`opened`, `edited`, `synchronize`, `reopened`, `ready_for_review`)

**O que faz:**

1. `semantic-title`: valida o título do PR no padrão conventional commits (`amannn/action-semantic-pull-request@v5`)
2. `build`: roda em qualquer evento que não seja só edição de título/descrição (`if: github.event.action != 'edited'`), com concurrency por número do PR, cancelando o build anterior
3. Em paralelo: `npm run eslint`, `npm run check-types` (`tsc`) e `npm run test:run` (Vitest, silenciando o console dos testes que passam)
4. O job falha se qualquer um dos três reprovar; o ESLint também reprova com uma supressão órfã em `eslint-suppressions.json`
5. Com os três passando, roda o `npm run build`

Lint, tipos, testes e build rodam direto neste workflow, sem job de build reutilizável separado ou gate de qualidade próprio.

**Secrets/Tokens:** `GITHUB_TOKEN`

```yaml
# .github/workflows/pr-validation.yml
on:
  pull_request:
    branches: [develop]
    types: [opened, edited, synchronize, reopened, ready_for_review]

jobs:
  semantic-title:
    runs-on: [self-hosted, linux]
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build:
    if: github.event.action != 'edited'
    concurrency:
      group: pr-build-${{ github.event.pull_request.number }}
      cancel-in-progress: true
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci --no-audit --no-fund
      - name: Lint + type check + tests (parallel)
        run: |
          npm run eslint > eslint.log 2>&1 &
          npm run check-types > tsc.log 2>&1 &
          npm run test:run -- --silent=passed-only > test.log 2>&1 &
          # aguarda os três e falha se algum deles reprovou
      - run: npm run build
```

## sonarqube.yml

**Arquivo:** `.github/workflows/sonarqube.yml`  
**Trigger:** PR e push em `develop`, `workflow_dispatch`  
**Concurrency:** `sonarqube-${{ github.event.pull_request.number || github.ref }}` (cancela o anterior)

**O que faz:**

1. Checkout com `fetch-depth: 0` (necessário para o analisador decorar o histórico)
2. Instala dependências com `npm ci`, para o analisador de TypeScript enxergar os tipos
3. Em PR, calcula os parâmetros de PR do Sonar (`sonar.pullrequest.key/branch/base`) e usa `sonar.scm.revision` apontando para o último commit do PR, em vez do commit de merge
4. Fora de PR, usa `sonar.branch.name`
5. Roda `SonarSource/sonarqube-scan-action@v8`, excluindo `src/_metronic/assets` e tratando os arquivos de teste como teste (`sonar.tests`), não como código

A análise fica restrita à `develop`: não roda mais em qualquer branch ou PR.

**Secrets/Tokens:** `SONAR_TOKEN`, `SONAR_HOST_URL` (o SonarQube é interno — o job roda em runner self-hosted para alcançá-lo)

```yaml
# .github/workflows/sonarqube.yml
on:
  pull_request:
    branches: [develop]
  push:
    branches: [develop]
  workflow_dispatch:

jobs:
  sonarqube:
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci --no-audit --no-fund
      - uses: SonarSource/sonarqube-scan-action@v8
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ vars.SONAR_HOST_URL }}
        with:
          args: >
            -Dsonar.projectKey=easypdverp_easypdv-admin-app
            -Dsonar.sources=.
            -Dsonar.exclusions=src/_metronic/assets/**,**/*.test.*,**/__tests__/**,**/test/**
            -Dsonar.tests=.
            -Dsonar.test.inclusions=**/*.test.*,**/__tests__/**,**/test/**
```

## trivy-develop.yml

**Arquivo:** `.github/workflows/trivy-develop.yml`  
**Trigger:** Push em `develop`, `workflow_dispatch`  
**Concurrency:** `trivy-develop-${{ github.ref }}` (cancela o anterior)

**O que faz:**

1. Chama o workflow reutilizável `trivy-image.yml` do repositório `easypdverp/easypdv-scripts`
2. Builda a imagem usando `scripts/local/Dockerfile`, no contexto raiz do repositório
3. Ignora vulnerabilidades sem correção disponível (`ignore-unfixed: true`)

**Secrets/Tokens:** nenhum próprio (herda do workflow reutilizável)

```yaml
# .github/workflows/trivy-develop.yml
on:
  push:
    branches: [develop]
  workflow_dispatch:

jobs:
  trivy:
    if: github.ref == 'refs/heads/develop'
    uses: easypdverp/easypdv-scripts/.github/workflows/trivy-image.yml@master
    with:
      dockerfile: scripts/local/Dockerfile
      build-context: '.'
      ignore-unfixed: true
```

## sync-develop-direct.yml

**Arquivo:** `.github/workflows/sync-develop-direct.yml`  
**Trigger:** Após o workflow `Release (semantic-release)` completar com sucesso em `master`

**O que faz:**

1. Checkout com `fetch-depth: 0` e `ref: master`, autenticado com `SYNC_DEPLOY_KEY` em vez do `GITHUB_TOKEN`
2. Configura o autor do git como `github-actions[bot]`
3. Verifica se a branch `develop` existe
4. Faz merge de `origin/master` em `develop`
5. Faz push da `develop` atualizada
6. Em caso de conflito, falha com mensagem para intervenção manual

A branch `develop` só aceita push de quem está na exceção da regra de proteção: a chave de deploy está na exceção, o `GITHUB_TOKEN` não está — por isso o checkout usa `ssh-key: ${{ secrets.SYNC_DEPLOY_KEY }}`.

**Secrets/Tokens:** `SYNC_DEPLOY_KEY`

```yaml
# .github/workflows/sync-develop-direct.yml
on:
  workflow_run:
    workflows: ['Release (semantic-release)']
    branches: [master]
    types: [completed]

jobs:
  sync-develop:
    if: github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ssh-key: ${{ secrets.SYNC_DEPLOY_KEY }}
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
3. Atualiza a branch de origem do PR para apontar para o mesmo SHA de `develop`, com force update
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
    runs-on: [self-hosted, linux]
    steps:
      - uses: actions/github-script@v7
        with:
          github-token: ${{ github.token }}
          script: |
            const developRef = await github.rest.git.getRef({ owner, repo, ref: 'heads/develop' });
            await github.rest.git.updateRef({
              owner, repo,
              ref: `heads/${pr.head.ref}`,
              sha: developRef.data.object.sha,
              force: true,
            });
```

## direct-push-audit.yml

**Arquivo:** `.github/workflows/direct-push-audit.yml`  
**Trigger:** Push em `main`/`master`

**O que faz:**

1. Consulta a API do GitHub para ver se o commit chegou associado a algum PR
2. Quando não há PR associado, abre uma issue "Auditoria: pushes diretos na branch principal" (ou comenta na issue já aberta) registrando autor, horário, mensagem e SHA do commit

**Secrets/Tokens:** `GITHUB_TOKEN` via `github.token`

```yaml
# .github/workflows/direct-push-audit.yml
on:
  push:
    branches: [main, master]

jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: read
      pull-requests: read
    steps:
      - name: Registrar push sem PR
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          PRS=$(gh api "repos/${{ github.repository }}/commits/${{ github.sha }}/pulls" --jq length)
          if [ "$PRS" != "0" ]; then exit 0; fi
          # abre ou comenta a issue de auditoria
```

## Template de PR

`.github/pull_request_template.md` preenche a descrição de todo PR novo com três seções: **Resumo** (o que muda e por quê), **Como testei** (os comandos rodados e o resultado — "CI verde" não conta como teste) e **Fora desta PR** (o que ficou de fora de propósito, removida quando não há nada a listar), terminando com `Closes #`.

## Fluxo de Release

O pipeline completo de release segue esta sequência:

```
Push em master
    |
    v
release.yml (semantic-release)
    |
    +---> CHANGELOG.md atualizado
    +---> Git tag criada (ex: v1.42.0)
    +---> GitHub Release publicada
    +---> dispatch-docs.yml disparado com a versão nova
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
    +---> Push da develop (com SYNC_DEPLOY_KEY)
```

## Fluxo de PR

O pipeline de validação de PRs segue esta sequência:

```
                         PR aberto/atualizado em develop
                                     |
                 +-------------------+-------------------+
                 |                                       |
                 v                                       v
          pr-validation.yml                        sonarqube.yml
                 |                                       |
    +---> semantic-title: valida o título      +---> Análise estática do SonarQube,
    |     (conventional commits)                |     decorando o PR
    +---> build: ESLint + tsc + Vitest em
          paralelo, depois o build
          (pulado quando só o título/
          descrição é editado)
                 |
                 v (ao fazer merge)
                 |
                 +---> sync-work-branch-direct.yml sincroniza a branch de origem com develop
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

#### Upload de logotipo no setup

A rotina `setupLogo(image, onUploadProgress)` envia o arquivo de imagem diretamente como `multipart/form-data` para o endpoint de logo do setup.

| Item | Tipo | Descrição |
|------|------|-------------|
| `image` | `File` | Arquivo selecionado no formulário de upload |
| `onUploadProgress` | `(progressEvent: AxiosProgressEvent) => void` | Callback de progresso da requisição HTTP |
| `formData.append('file', image)` | `FormData` | Envia o `File` original sem reconstrução do nome do arquivo |
| `SetupEndpoints.setLogo` | endpoint | Destino da requisição de upload |

O fluxo preserva o arquivo recebido do input de upload, mantendo nome, tipo MIME e metadados do objeto `File` no payload enviado ao backend.

### SubscriptionPage

A página `src/app/pages/subscription/SubscriptionPage.tsx` usa o componente `PageShell` para encapsular o conteúdo da assinatura com título padronizado.

| Componente | Responsabilidade | Props |
|------------|------------------|-------|
| `PageShell` | Estrutura de página com cabeçalho | `title="Minha Assinatura"` |
| `Outlet` | Renderização das abas-filhas | Recebe a rota ativa de assinatura |
| `Link` | Navegação entre abas | Gera links para detalhes e cobrança |

O `PageShell` fornece a moldura da página e substitui a estrutura manual com container dedicado. O conteúdo interno mantém a navegação por tabs e o `Outlet` continua responsável por renderizar a aba selecionada.

### SubscriptionBillingTab

O componente `src/app/pages/subscription/components/SubscriptionBillingTab.tsx` controla os dados de cobrança do sistema e integra permissões de edição por meio do contexto de capacidade da aplicação.

| Hook/Componente | Função | Estado/prop observado |
|-----------------|--------|-----------------------|
| `useCan` | Verifica permissão de ação | `RESOURCES.GERENCIAR_ASSINATURA` + `AdminAction.ALTERAR` |
| `useCompanyBillings` | Busca os dados de cobrança | `data: billings`, `isPending` |
| `getCompanyBillingColumns` | Monta colunas da tabela | Recebe `setEditing` e `canChangeBilling` |
| `EditCompanyBillingModal` | Edição do billing selecionado | Recebe `billing` e `onClose` |
| `DataTable` | Exibe os registros de cobrança | Usa colunas dinâmicas e lista retornada pela query |

#### Fluxo de dados

1. O hook `useCan(RESOURCES.GERENCIAR_ASSINATURA, AdminAction.ALTERAR)` define se o usuário pode alterar dados de cobrança
2. `useCompanyBillings()` carrega a lista de registros exibidos na `DataTable`
3. `useMemo` monta as colunas com `getCompanyBillingColumns(setEditing, canChangeBilling)`
4. A coluna de ações renderiza `RowMenuDropdown` com o rótulo:
   - `Editar` quando há permissão de alteração
   - `Visualizar` quando a ação é apenas de leitura
5. Ao selecionar um item, `setEditing` armazena o registro em edição
6. O modal `EditCompanyBillingModal` usa o mesmo controle de permissão para bloquear o envio e ocultar o botão de submissão quando a ação não é permitida

#### Tabela de configuração

| Item | Valor | Uso |
|------|-------|-----|
| Fonte da tabela | `useCompanyBillings()` | Carrega os registros de cobrança |
| Colunas | `getCompanyBillingColumns(setEditing, canChangeBilling)` | Define exibição e ações por linha |
| Controle de acesso | `useCan(RESOURCES.GERENCIAR_ASSINATURA, AdminAction.ALTERAR)` | Determina se o usuário pode editar |
| Modal de edição | `EditCompanyBillingModal` | Edita o billing selecionado |
| Ação de linha | `RowMenuDropdown` | Exibe `Editar` ou `Visualizar` conforme permissão |

### SubscriptionDetailsTab

O componente `src/app/pages/subscription/components/SubscriptionDetailsTab.tsx` usa múltiplas consultas com `@tanstack/react-query` para carregar os dados da assinatura em blocos independentes.

| Consulta | `queryKey` | Função | Dado retornado |
|----------|------------|--------|----------------|
| Módulos do sistema | `["getSystemModules"]` | `getSystemModules()` | `systemModulesData` |
| Plano da assinatura | `["getSystemPlan"]` | `getSystemPlan()` | `systemPlanData` |

#### Estados de carregamento

Cada consulta expõe `isPending`, mapeado localmente para os estados:

- `isModulesLoading`
- `isPlanLoading`

Esses estados permitem renderização fragmentada dos blocos da interface, sem acoplar o carregamento de todos os dados em uma única consulta.

#### Fluxo de dados

1. Cada hook `useQuery` chama sua respectiva API
2. A resposta é retornada em `response.data`
3. O componente consome os dados por desestruturação:
   - `systemModulesData`
   - `systemPlanData`
4. Erros são tratados pelos mecanismos globais de tratamento do cliente HTTP, sem handlers locais em cada consulta

#### Tabela de configuração

| Consulta | Chave | Observação |
|----------|-------|------------|
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