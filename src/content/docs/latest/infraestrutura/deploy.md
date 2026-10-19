---
title: Deploy
description: Infraestrutura de deploy do Despensinha ERP.
sidebar:
  order: 2
---

O Despensinha ERP é implantado por um pipeline **Jenkins** que builda a aplicação, empacota o resultado numa imagem **Docker** com **Nginx** e publica essa imagem num registry privado. Não há integração com uma plataforma de hospedagem estática (tipo Cloudflare Pages ou Vercel) — o Jenkinsfile de cada ambiente é quem builda a imagem e a envia ao registry.

## Pipeline (Jenkins)

Cada ambiente tem o seu próprio Jenkinsfile, Dockerfile e configuração de Nginx em `scripts/<ambiente>/`:

| Etapa | Descrição |
|-------|-----------|
| Build | `npm install` e `npm run build:<ambiente>` (gera `dist/`) |
| Build & Tag da imagem | `docker build` usando `scripts/<ambiente>/Dockerfile`, que copia `dist/` para `/usr/share/nginx/html` e aplica a configuração de Nginx do ambiente |
| Push | Login no registry com `DOCKER_CREDENTIALS` e `docker push` da imagem |
| Limpeza (`post`) | `docker logout`, remoção das imagens locais e do `DOCKER_CONFIG` temporário do build |

**Variáveis de ambiente:** as variáveis `VITE_*` não são injetadas por uma plataforma externa — elas vêm do arquivo `.env.<ambiente>` versionado no repositório (`.env.production`, `.env.development`) e são embutidas no bundle no momento do `npm run build`.

## Ambientes

| Ambiente | Jenkinsfile | Dockerfile | Imagem |
|----------|-------------|------------|--------|
| Produção | `scripts/prod/Jenkinsfile` | `scripts/prod/Dockerfile` | `registry-prod.easypdv.com.br/prod/easypdv-admin-front` |
| Dev | `scripts/dev/Jenkinsfile` | `scripts/dev/Dockerfile` | `registry.easypdv.com.br/dev/easypdv-admin-front` |

**Produção:** o pipeline de `scripts/prod` é disparado por uma tag (`vX.Y.Z`), a mesma tag criada pelo `release.yml` (veja [CI/CD](/infraestrutura/ci-cd/)); também pode ser executado manualmente informando uma tag ou um ref. Builda com `npm run build:production`, versiona a imagem com `VERSION` (extraído da tag) e publica também como `:latest`.

**Dev:** o pipeline de `scripts/dev` builda com `npm run build:development` e publica somente a tag `:latest`; aborta quando o commit traz `[skip ci]` na mensagem.

Em ambos, o Dockerfile final é baseado em `nginx:alpine`: copia o `dist/` gerado e a configuração de `scripts/<ambiente>/nginx/`, que serve os arquivos estáticos e redireciona todas as rotas para `index.html` (roteamento client-side).

## Execução local com Docker

Para rodar o frontend localmente sem instalar Node ou npm na máquina, o repositório tem um `compose.yaml` próprio (não confundir com os Dockerfiles de deploy acima):

```sh
docker compose up --build -d --wait
```

Isso builda a imagem usando `scripts/local/Dockerfile` (um `node:24-alpine` que roda `npm ci` e sobe o Vite em modo development, exposto na porta 3000) e deixa a aplicação em http://localhost:3000.

Pontos relevantes dessa execução:

- O serviço recebe as variáveis do `.env.development`. Arquivos `.env` não são copiados para a imagem; `.env.development.local` e `.env.local` da máquina não interferem. A porta local é sempre 3000, independentemente de `VITE_PORT`.
- A API configurada em `VITE_APP_API_URL` precisa estar acessível pelo navegador — o Compose inicia somente o frontend. O `.env.development` versionado aponta para a API de DEV; para usar outra API, ajuste `VITE_APP_API_URL` nesse arquivo e recrie o container.
- Para o login com Google, o cliente OAuth definido no `.env.development` precisa autorizar `http://localhost:3000` como origem JavaScript.
- Acompanhar logs e parar o serviço: `docker compose logs -f admin-app` e `docker compose down`.
- Depois de alterar o código, basta rodar o comando de inicialização de novo para reconstruir a imagem. Depois de alterar o `.env.development`, recriar o container com `docker compose up -d --force-recreate --wait`.

Veja o pré-requisito de backend local e o setup em um comando (`./scripts/setup`) em [Estrutura do Projeto](/introducao/estrutura-do-projeto/).
