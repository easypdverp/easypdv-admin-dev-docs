---
title: Versionamento Runtime
description: Sistema de verificacao de versao em tempo de execucao do Despensinha ERP.
sidebar:
  order: 3
---

O Despensinha ERP possui um sistema de verificacao de versao em tempo de execucao que detecta quando uma nova versao e implantada e oferece ao usuario um hard refresh para carregar a versao mais recente.

## version.json

**Localizacao:** `public/version.json`

O arquivo `version.json` e servido como arquivo estatico e contem a versao atual da aplicacao e o timestamp do build:

```json
{
  "version": "1.27.3",
  "buildTime": "2026-03-26T12:27:27.531Z"
}
```

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `version` | `string` | Versao semantica da aplicacao (corresponde ao `package.json`) |
| `buildTime` | `string` | Timestamp ISO 8601 do momento do build |

O arquivo e atualizado a cada novo build — quando o semantic-release incrementa a versao no `package.json`, o proximo build gera um novo `version.json` com a versao atualizada.

## useVersionCheck Hook

**Arquivo:** `src/app/hooks/useVersionCheck.ts`

O hook `useVersionCheck` e responsavel por detectar novas versoes em tempo de execucao. Ele faz polling periodico do `version.json` e compara com a constante de build `__APP_VERSION__`.

### Interface

```typescript
interface VersionCheckOptions {
  /** Intervalo em milissegundos para verificar atualizacoes. Padrao: 60000 (1 minuto) */
  checkInterval?: number
  /** Se a verificacao esta habilitada. Padrao: true */
  enabled?: boolean
}

interface VersionCheckResult {
  hasNewVersion: boolean        // Se uma nova versao esta disponivel
  currentVersion: string        // Versao atual rodando no app
  newVersion: string | null     // Nova versao disponivel (se houver)
  checkForUpdates: () => Promise<void>  // Verificar manualmente
  hardRefresh: () => void       // Forcar reload da pagina
  dismiss: () => void           // Dispensar notificacao
}
```

### Logica de Polling

O hook busca o `version.json` periodicamente com cache-busting para evitar respostas cacheadas:

```typescript
const checkForUpdates = useCallback(async () => {
  const response = await fetch(`${VERSION_FILE_PATH}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
  })

  const data = await response.json() as VersionJsonResponse
  const serverVersion = data.version

  if (serverVersion && serverVersion !== currentVersion) {
    setNewVersion(serverVersion)
    setHasNewVersion(true)
  }
}, [currentVersion])
```

### Triggers de Verificacao

O hook verifica por novas versoes em tres situacoes:

1. **Check inicial:** 5 segundos apos montagem do componente
2. **Polling periodico:** A cada 60 segundos (configuravel via `checkInterval`)
3. **Visibilidade da aba:** Quando o usuario retorna a aba do navegador (evento `visibilitychange`)

### Hard Refresh

Quando o usuario aceita a atualizacao, o `hardRefresh` limpa todos os caches do Service Worker e forca um reload completo:

```typescript
const hardRefresh = useCallback(() => {
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name)
      })
    })
  }
  window.location.reload()
}, [])
```

## Fluxo Completo

```
Build (vite build)
    |
    +---> __APP_VERSION__ injetado via Vite define
    +---> version.json atualizado em public/
    |
    v
Deploy (Cloudflare Pages)
    |
    v
App rodando no navegador do usuario
    |
    +---> useVersionCheck inicia polling (60s)
    +---> Fetch /version.json com cache-busting
    |
    v
Compara version.json.version com __APP_VERSION__
    |
    +---> Se iguais: nada acontece
    +---> Se diferentes: notifica usuario
              |
              v
         Usuario aceita -> hardRefresh
              |
              v
         Caches limpos + window.location.reload()
              |
              v
         Nova versao carregada
```

## Configuracao

### Constante __APP_VERSION__

A constante `__APP_VERSION__` e definida no `vite.config.ts` usando a opcao `define` do Vite:

```typescript
// vite.config.ts
define: {
  __APP_VERSION__: JSON.stringify(env.npm_package_version),
}
```

Isso substitui todas as ocorrencias de `__APP_VERSION__` no codigo pelo valor da versao do `package.json` no momento do build.

### Intervalo de Polling

O intervalo padrao e de **60 segundos** (60000ms). Para alterar:

```typescript
const versionCheck = useVersionCheck({
  checkInterval: 120000, // verificar a cada 2 minutos
  enabled: true,         // habilitado por padrao
})
```

### Desabilitar Verificacao

Para desabilitar a verificacao de versao (util em desenvolvimento):

```typescript
const versionCheck = useVersionCheck({
  enabled: false,
})
```
