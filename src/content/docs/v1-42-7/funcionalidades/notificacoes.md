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

## Sino de Notificações

O cabeçalho mostra as notificações do usuário no sino, pelo `NotificationsDropdown` (`src/_metronic/partials/layout/header-menus/`), renderizado pelo `FullNavbar`.

### Preferência de notificações

Em Preferências › aba Notificações, o usuário desliga os tipos de notificação que não quer receber no sino. A lista mostra os tipos disponíveis conforme a permissão do usuário, com um interruptor por tipo; o estado salvo é a lista de tipos desligados. Notificações urgentes não entram nessa lista: chegam sempre.

### Clique na notificação

Clicar numa notificação marca-a como lida e, quando ela tem origem, abre a tela correspondente:

| Origem | Tela aberta |
|--------|-------------|
| Pedido de venda | Detalhe do pedido |
| Picklist | Detalhe da picklist |
| Operação de inventário | Detalhe da operação |
| Ponto de venda | Edição do ponto de venda |
| Terminal | Edição do terminal |
| Pesquisa de satisfação | Resultados da pesquisa |
| Produto (alerta de custo) | Cadastro do produto |
| Produto (alerta de estoque) | Estoque do produto |

Sem origem registrada, o clique abre o ponto de venda associado à notificação, quando houver; sem nenhum dos dois, o clique só marca a notificação como lida.

### Urgente e resolvida

Notificação urgente mostra o selo "Urgente" no sino. Quando o alerta que gerou a notificação se encerra, o selo vira "Resolvida", que tem prioridade sobre "Urgente".

### Resumo do dia

A notificação de resumo do dia traz seções por ponto de venda (a seção Geral por último), cada uma com uma linha por atividade. O sino mostra as duas primeiras seções pelo `DailySummarySections` e avisa quantas seções ainda faltam; o clique marca a notificação como lida e abre o resumo inteiro no `DailySummaryModal`.

Uma linha do resumo pode trazer uma ação — hoje isso aparece na reposição, com o link "Gerar picklist". O link abre a tela de nova picklist já com o ponto de venda da linha carregado no formulário, e fecha o resumo (sino ou modal) de onde partiu.

## Veja Também

- [Error Handling](/arquitetura/error-handling/) — Padrões de tratamento de erros que disparam notificações
- [API e Endpoints](/arquitetura/api-endpoints/) — Endpoints de notificação do servidor
