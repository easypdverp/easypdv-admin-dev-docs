---
title: Versionamento Tecnico
description: Como o sistema de versionamento funciona no nivel de codigo
sidebar:
  order: 1
---

## Estrutura de Diretorios

O sistema de versionamento usa uma estrutura de diretorios onde cada versao e um diretorio completo e independente dentro de `src/content/docs/`:

```
src/content/docs/
  latest/           # Versao atual (sempre atualizada)
    introducao/
    arquitetura/
    modulos/
    funcionalidades/
    infraestrutura/
    changelog/
    versionamento/
  v1-27-1/          # Snapshot congelado da v1.27.1
    introducao/
    arquitetura/
    ...
```

- **`latest/`** — Sempre reflete o estado atual do ERP. Todo novo conteudo e adicionado aqui.
- **`v1-27-1/`** — Snapshot congelado. Nunca e modificado apos criacao. Representa o estado exato da documentacao na versao 1.27.1 do ERP.

Cada diretorio de versao contem uma copia completa e independente de todas as paginas da documentacao.

## Como Snapshots Sao Criados

Quando uma nova versao do ERP e publicada (ex: v1.28.0), o processo de snapshot e:

1. O diretorio `latest/` inteiro e copiado para um novo diretorio com o nome da versao (ex: `v1-28-0/`)
2. O snapshot e congelado — nenhuma modificacao e feita nele depois
3. O diretorio `latest/` continua sendo atualizado normalmente
4. Isso garante que cada versao tem uma fotografia exata de como a documentacao estava naquele momento

O nome do diretorio usa hifens em vez de pontos (ex: `v1-27-1` em vez de `v1.27.1`) porque o Astro remove pontos dos slugs de conteudo, o que geraria URLs como `/v1271/` em vez de `/v1-27-1/`.

## Configuracao de Versoes (versions.ts)

O arquivo `src/config/versions.ts` e a fonte unica de verdade para metadados de versao:

```typescript
export interface Version {
  slug: string;       // Segmento de URL: 'latest' ou 'v1-27-1'
  label: string;      // Label de exibicao: 'Latest' ou 'v1.27.1'
  badge?: string;     // Texto de badge opcional (ex: 'Atual')
  isCurrent: boolean; // true apenas para latest
}

export const versions: Version[] = [
  { slug: 'latest', label: 'Latest', badge: 'Atual', isCurrent: true },
  { slug: 'v1-27-1', label: 'v1.27.1', isCurrent: false },
];

export const defaultVersion = 'latest';
```

Este arquivo e consumido por:
- **VersionSelect component** — para renderizar o dropdown de versoes
- **Sidebar config** — para gerar grupos de sidebar por versao

## Sidebar Scoping

O `astro.config.mjs` usa uma funcao helper `versionSidebar()` para gerar grupos de sidebar por versao. Cada versao tem seu proprio conjunto de grupos na sidebar.

O `Header.astro` contem JavaScript client-side que detecta a versao atual pela URL e esconde os grupos de sidebar que pertencem a outras versoes. Isso e necessario porque o Starlight nao suporta sidebar condicional por rota nativamente.

```javascript
// Logica simplificada do Header.astro
const currentVersion = window.location.pathname.match(/(latest|v[\d-]+)/)?.[1];
// Esconde grupos de sidebar de outras versoes
```

Existe um flash cosmetico momentaneo ao carregar a pagina enquanto o JS esconde as versoes nao-ativas. Isso e um tradeoff aceito pela simplicidade da implementacao.

## Version Switcher (VersionSelect.astro)

O componente `VersionSelect.astro` implementa um custom element `<starlight-version-select>` que:

1. Le o array `versions` de `versions.ts`
2. Detecta a versao atual a partir do path da URL
3. Ao trocar de versao, substitui o segmento de versao na URL usando regex `/(latest|v[\d.-]+)/`
4. Se a pagina correspondente nao existir na versao selecionada, faz fallback para a raiz da versao

```html
<!-- Exemplo de uso no header -->
<starlight-version-select>
  <select>
    <option value="latest" selected>Latest (Atual)</option>
    <option value="v1-27-1">v1.27.1</option>
  </select>
</starlight-version-select>
```

## Como Adicionar uma Nova Versao

Quando o ERP publica uma nova versao (ex: v1.28.0), siga estes passos:

### 1. Criar snapshot

Copie o diretorio `latest/` inteiro para um novo diretorio com o nome da versao:

```bash
cp -r src/content/docs/latest/ src/content/docs/v1-28-0/
```

### 2. Atualizar versions.ts

Adicione a nova entrada no array `versions`:

```typescript
export const versions: Version[] = [
  { slug: 'latest', label: 'Latest', badge: 'Atual', isCurrent: true },
  { slug: 'v1-28-0', label: 'v1.28.0', isCurrent: false },
  { slug: 'v1-27-1', label: 'v1.27.1', isCurrent: false },
];
```

### 3. Atualizar astro.config.mjs

Adicione um novo bloco `versionSidebar('v1-28-0')` na configuracao de sidebar:

```javascript
sidebar: [
  ...versionSidebar('latest'),
  ...versionSidebar('v1-28-0'),
  ...versionSidebar('v1-27-1'),
],
```

### 4. Atualizar package.json

Atualize a versao no `package.json` para refletir a nova versao do ERP:

```json
{
  "version": "1.28.0"
}
```

Apos esses passos, a nova versao estara disponivel no version switcher e tera sua propria sidebar completa.
