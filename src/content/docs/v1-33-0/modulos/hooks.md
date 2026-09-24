---
title: Hooks Customizados
description: Hooks React customizados utilizados no Despensinha ERP.
sidebar:
  order: 5
---

O Despensinha ERP utiliza hooks React customizados para encapsular comportamentos reutilizaveis em toda a aplicacao. Todos os hooks estao localizados em `src/app/hooks/` e seguem o padrao `use[NomeDoHook]`.

## Visao Geral

| Hook | Proposito | Linhas |
|------|-----------|--------|
| `useVersionCheck` | Verifica periodicamente se ha nova versao da aplicacao | 135 |
| `useNavigationBlocker` | Bloqueia navegacao quando ha alteracoes nao salvas | 53 |
| `useSearchHotkeys` | Detecta atalhos de teclado para busca (Cmd+K, Ctrl+K, /) | 41 |
| `useDataTableCleanup` | Limpa parametros da URL ao desmontar um DataTable | 64 |
| `useIsFirstRender` | Retorna `true` apenas na primeira renderizacao | 12 |

## useVersionCheck

**Proposito:** Detecta quando uma nova versao da aplicacao esta disponivel, comparando a versao atual com o arquivo `version.json` no servidor.

**Arquivo:** `src/app/hooks/useVersionCheck.ts`

**Parametros:**

```ts
interface VersionCheckOptions {
  /** Intervalo em milissegundos para verificar atualizacoes. Padrao: 60000 (1 minuto) */
  checkInterval?: number
  /** Se a verificacao esta habilitada. Padrao: true */
  enabled?: boolean
}
```

**Retorno:**

```ts
interface VersionCheckResult {
  hasNewVersion: boolean        // Se ha nova versao disponivel
  currentVersion: string        // Versao atual rodando na app
  newVersion: string | null     // Nova versao disponivel (se houver)
  checkForUpdates: () => Promise<void>  // Verificacao manual
  hardRefresh: () => void       // Recarrega a pagina limpando caches
  dismiss: () => void           // Descarta a notificacao de atualizacao
}
```

**Como Usar:**

```tsx
import { useVersionCheck } from '../hooks/useVersionCheck'

function AppLayout() {
  const { hasNewVersion, newVersion, hardRefresh, dismiss } = useVersionCheck({
    checkInterval: 60000, // verifica a cada 1 minuto
    enabled: true,
  })

  if (hasNewVersion) {
    return (
      <div>
        Nova versao {newVersion} disponivel!
        <button onClick={hardRefresh}>Atualizar</button>
        <button onClick={dismiss}>Depois</button>
      </div>
    )
  }
}
```

**Detalhes:**

- Faz polling do arquivo `/version.json` a cada 60 segundos (configuravel via `checkInterval`)
- Compara a versao do servidor com a constante de compilacao `__APP_VERSION__`
- Adiciona parametro cache-busting (`?t=timestamp`) para evitar respostas cacheadas
- Tambem verifica quando a aba volta a ficar visivel (`visibilitychange`)
- A funcao `hardRefresh` limpa todos os caches do Service Worker antes de recarregar
- Verificacao inicial acontece apos 5 segundos de delay
- Falhas na verificacao sao silenciosas (nao criticas)

## useNavigationBlocker

**Proposito:** Bloqueia a navegacao do React Router quando existem alteracoes nao salvas, exibindo um dialogo de confirmacao.

**Arquivo:** `src/app/hooks/useNavigationBlocker.ts`

**Parametros:**

```ts
function useNavigationBlocker(
  when: boolean,  // Condicao para ativar o bloqueio
  message?: string // Mensagem do dialogo (padrao: "Voce tem alteracoes nao salvas...")
): void
```

**Retorno:** Nenhum (o hook gerencia o bloqueio internamente).

**Como Usar:**

```tsx
import { useNavigationBlocker } from '../hooks/useNavigationBlocker'

function FormularioEdicao() {
  const [hasChanges, setHasChanges] = useState(false)

  useNavigationBlocker(
    hasChanges,
    'Voce tem alteracoes nao salvas. Deseja realmente sair?'
  )

  return <form onChange={() => setHasChanges(true)}>...</form>
}
```

**Detalhes:**

- Utiliza o `UNSAFE_NavigationContext` do React Router DOM para acessar o `navigator.block`
- Exibe `window.confirm()` com a mensagem configurada quando o usuario tenta navegar
- Se o usuario confirmar, a navegacao prossegue normalmente; se cancelar, permanece na pagina
- O bloqueio e removido automaticamente quando `when` muda para `false` ou o componente desmonta

## useSearchHotkeys

**Proposito:** Detecta atalhos de teclado para abrir a busca global: Cmd+K (Mac), Ctrl+K (Windows/Linux) ou a tecla `/`.

**Arquivo:** `src/app/hooks/useSearchHotkeys.ts`

**Parametros:**

```ts
function useSearchHotkeys(
  onOpen: () => void  // Funcao executada quando o atalho e acionado
): void
```

**Retorno:** Nenhum (o hook gerencia os event listeners internamente).

**Como Usar:**

```tsx
import { useSearchHotkeys } from '../hooks/useSearchHotkeys'

function Header() {
  const [searchOpen, setSearchOpen] = useState(false)

  useSearchHotkeys(() => setSearchOpen(true))

  return <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
}
```

**Detalhes:**

- Ignora atalhos quando o usuario esta digitando em `<input>`, `<textarea>` ou elementos `contentEditable`
- Detecta `metaKey` (Command no Mac) ou `ctrlKey` combinado com a tecla `k`
- Detecta a tecla `/` como atalho alternativo
- Previne o comportamento padrao do navegador (ex: digitar "/" ou focar na barra de endereco)
- O listener e adicionado ao `window` e removido automaticamente ao desmontar

## useDataTableCleanup

**Proposito:** Limpa automaticamente os parametros da URL relacionados a um DataTable quando o componente e desmontado, evitando parametros orfaos.

**Arquivo:** `src/app/hooks/useDataTableCleanup.ts`

**Parametros:**

```ts
function useDataTableCleanup(
  tableKey?: string  // Chave unica do DataTable
): void
```

**Retorno:** Nenhum (a limpeza ocorre automaticamente no unmount).

**Como Usar:**

```tsx
import { useDataTableCleanup } from '../hooks/useDataTableCleanup'

function ListagemProdutos() {
  useDataTableCleanup('produtos')

  // Os parametros filter_produtos, page_produtos, sort_produtos, etc.
  // serao removidos da URL ao sair da pagina
  return <DataTable tableKey="produtos" ... />
}
```

**Detalhes:**

- Remove os seguintes padroes de parametros da URL no unmount:
  - `filter_{tableKey}`
  - `page_{tableKey}`
  - `pageSize_{tableKey}`
  - `sort_{tableKey}`
  - `direction_{tableKey}`
  - `search_{tableKey}`
- Utiliza `useSearchParams` do React Router para atualizar a URL
- A atualizacao e feita via `setTimeout` para evitar problemas durante o ciclo de desmontagem
- Usa `useRef` para manter a referencia da `tableKey` atualizada sem recriar o efeito

## useIsFirstRender

**Proposito:** Retorna `true` apenas na primeira renderizacao do componente, util para evitar efeitos colaterais em renders subsequentes.

**Arquivo:** `src/app/hooks/useIsFirstRender.ts`

**Parametros:** Nenhum.

**Retorno:**

```ts
function useIsFirstRender(): boolean  // true na primeira renderizacao, false nas seguintes
```

**Como Usar:**

```tsx
import { useIsFirstRender } from '../hooks/useIsFirstRender'

function Componente() {
  const isFirst = useIsFirstRender()

  useEffect(() => {
    if (!isFirst) {
      // Executa apenas em re-renders, nao na montagem inicial
      salvarAlteracoes()
    }
  }, [dependencia])
}
```

**Detalhes:**

- Implementacao baseada em `useRef` — nao causa re-renders adicionais
- Na primeira chamada, retorna `true` e marca a ref como `false`
- Em todas as chamadas subsequentes, retorna `false`
- Hook mais simples do projeto com apenas 12 linhas
