---
title: Deploy
description: Infraestrutura de deploy do Despensinha ERP.
sidebar:
  order: 2
---

O Despensinha ERP e implantado via **Cloudflare Pages** integrado com **GitHub Actions**. Nao existem configuracoes de Docker ou Nginx no repositorio — o deploy e totalmente gerenciado pela Cloudflare.

## Cloudflare Pages

O build e deploy sao disparados automaticamente quando um push e feito na branch `master`:

1. O workflow `release.yml` executa o semantic-release
2. O Cloudflare Pages detecta o novo commit em `master`
3. O build e executado no ambiente da Cloudflare

**Build command:**

```bash
vite build
```

**Output directory:** `dist/`

**Variaveis de ambiente em producao:**

As variaveis `VITE_*` sao injetadas no momento do build pela Cloudflare Pages — elas **nao** estao no arquivo `.env.production`. O arquivo `.env.production` contem apenas configuracoes locais de build. Variaveis como `VITE_APP_API_URL` sao configuradas diretamente no painel da Cloudflare Pages.

## Ambientes

| Ambiente | Branch | Plataforma | URL |
|----------|--------|-----------|-----|
| Producao | `master` | Cloudflare Pages | URL principal do ERP |
| Preview | Branches de PR | Cloudflare Pages | URLs de preview automaticas |

**Producao:** Cada merge em `master` dispara um novo build e deploy automatico.

**Preview:** PRs recebem URLs de preview geradas automaticamente pela Cloudflare Pages, permitindo revisao visual antes do merge.

## Nota sobre Docker/Nginx

O repositorio do Despensinha ERP **nao contem** arquivos de configuracao Docker (`Dockerfile`, `docker-compose.yml`) ou Nginx (`nginx.conf`). Todo o processo de build, hospedagem e CDN e gerenciado pela Cloudflare Pages.

Nao e necessario configurar servidores, containers ou proxies reversos para fazer deploy da aplicacao.
