---
title: Error Handling
description: Padrões de tratamento de erros no Despensinha ERP com mapeamento de mensagens amigáveis.
sidebar:
  order: 7
---

O ERP centraliza o tratamento de erros em `src/api/core/`, com mapeamento automático de erros Axios para mensagens amigáveis em pt-BR.

## Arquitetura

```
src/api/core/
├── _models.ts           # ApiResponseError (classe base de erro)
├── axiosErrorMapper.ts  # Mapeamento de erros -> mensagens amigáveis
└── errorHandlers.ts     # (deprecated) Handler legado
```

O fluxo de erro segue este caminho:

1. API retorna resposta com `success: false` (ou erro HTTP)
2. Response interceptor cria `ApiResponseError` e rejeita a Promise
3. O código chamador captura o erro e usa `getErrorMessage()` para exibir

## axiosErrorMapper (Recomendado)

```
src/api/core/axiosErrorMapper.ts
```

### Interface FriendlyError

```ts
interface FriendlyError {
  message: string;
  title?: string;
  code?: string;
}
```

### Funções Principais

| Função | Retorno | Uso |
|--------|---------|-----|
| `mapAxiosErrorToFriendlyMessage(error)` | `FriendlyError` | Mapeamento completo com title e code |
| `getErrorMessage(error)` | `string` | Apenas a mensagem (para formulários) |
| `getErrorTitle(error, default?)` | `string` | Apenas o título |

### Uso Recomendado

```ts
import { getErrorMessage } from '@/api/core/axiosErrorMapper';
import { SystemNotification } from '@/app/components/feedback/SystemNotification';

// Em um handler de erro (ex.: onError do React Query)
onError: (error) => {
  SystemNotification.error(getErrorMessage(error));
}
```

### Tipos de Erro Tratados

O mapper identifica automaticamente o tipo de erro e gera mensagem apropriada:

| Tipo de Erro | Detecção | Exemplo de Mensagem |
|-------------|----------|---------------------|
| `ApiResponseError` | `instanceof ApiResponseError` | Mensagem da API ou fallback |
| Erro de rede | `error.code === 'ERR_NETWORK'` | "Não foi possível conectar ao servidor" |
| Timeout | `error.code === 'ECONNABORTED'` | "A requisição demorou muito para responder" |
| Requisição cancelada | `error.code === 'ERR_CANCELED'` | "A operação foi cancelada" |
| HTTP 400 | Status code | "Os dados enviados são inválidos" |
| HTTP 401 | Status code | "Sua sessão expirou. Faça login novamente" |
| HTTP 403 | Status code | "Você não tem permissão para realizar esta ação" |
| HTTP 404 | Status code | "O recurso solicitado não foi encontrado" |
| HTTP 409 | Status code | "Já existe um registro com essas informações" |
| HTTP 429 | Status code | "Você fez muitas requisições" |
| HTTP 500 | Status code | "Ocorreu um erro interno" |
| Erro genérico | `instanceof Error` | `error.message` ou fallback |

### Extração de Mensagem do Servidor

O mapper tenta extrair a mensagem de erro da resposta do servidor em ordem de prioridade:

1. Campo `message` (string) na resposta
2. Array `error` com objetos `{ field, message }` — concatenados com `;`
3. Campo `error` (string)
4. Campo `errors` (string)
5. Resposta inteira se for string

## Fluxo de Refresh Token

O response interceptor em `axios.ts` trata automaticamente erros 401:

```
Requisição → API retorna 401 → Interceptor detecta
  ├── Tem refresh_token? → Tenta renovar
  │   ├── Sucesso → Reenvia requisição original com novo token
  │   └── Falha → Remove auth, rejeita erro
  └── Não tem refresh_token → Rejeita erro
```

A flag `_retry` evita loops infinitos — cada requisição tenta refresh apenas uma vez.

## errorHandlers.ts (Deprecated)

```
src/api/core/errorHandlers.ts
```

Handler legado que exibe erros via `SystemNotification` diretamente. Marcado como `@deprecated`.

**Migração:** Substitua por `getErrorMessage` do `axiosErrorMapper`:

```ts
// Antes (deprecated)
import handleApiError from '@/api/core/errorHandlers';
handleApiError(error);

// Depois (recomendado)
import { getErrorMessage } from '@/api/core/axiosErrorMapper';
SystemNotification.error(getErrorMessage(error));
```

## Boas Práticas

1. **Sempre use `getErrorMessage()`** — nunca exiba `error.message` diretamente ao usuário
2. **Não capture erros 401** — o interceptor já trata com refresh automático
3. **Use `FriendlyError` completo** quando precisar de título e código (ex.: modais de erro)
4. **Erros de validação de campo** chegam como `FieldError[]` — use para validação inline em formulários
