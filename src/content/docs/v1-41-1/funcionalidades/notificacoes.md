---
title: Notificações
description: Sistema de notificações toast no Despensinha ERP.
sidebar:
  order: 4
---

O sistema usa **react-toastify** 11.0 para exibir notificações ao usuário.

## Configuração

O `ToastContainer` está configurado no layout principal (`src/_metronic/layout/`). Não é necessário adicioná-lo novamente.

## Uso

```tsx
import { toast } from 'react-toastify';

// Sucesso
toast.success('Cliente salvo com sucesso!');

// Erro
toast.error('Erro ao salvar. Tente novamente.');

// Aviso
toast.warning('Estoque abaixo do mínimo.');

// Informação
toast.info('Sincronização em andamento...');
```

## Notificações de API

Para erros de API, o padrão é exibir o toast no catch do formulário:

```ts
try {
  await ClientEndpoints.create(values);
  toast.success('Cliente criado com sucesso!');
  onClose();
} catch (error) {
  toast.error(getApiErrorMessage(error)); // src/app/helpers/apiErrors.ts
}
```

## Central de Notificações

Além dos toasts, o sistema tem uma central de notificações em `/notificacao` que exibe notificações persistentes do servidor. Os componentes estão em `src/app/modules/notifications/`.

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Padrões de tratamento de erros que disparam notificações
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de notificação do servidor
