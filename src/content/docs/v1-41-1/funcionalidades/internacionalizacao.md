---
title: Internacionalização
description: Sistema de i18n com react-intl no Despensinha ERP.
sidebar:
  order: 3
---

O sistema usa **react-intl** 6.4 para internacionalização. Os arquivos de mensagens estão em `src/_metronic/i18n/`.

## Estrutura

```
src/_metronic/i18n/
├── messages/
│   ├── pt.ts   # Português (padrão)
│   └── en.ts   # Inglês
└── I18nProvider.tsx   # Provider que envolve o App
```

## Adicionando uma Mensagem

1. Adicione a chave em `src/_metronic/i18n/messages/pt.ts`:

```ts
export const ptMessages = {
  // ... mensagens existentes
  'client.form.name.label': 'Nome do cliente',
};
```

2. Repita para `en.ts` com a tradução em inglês.

## Usando uma Mensagem

```tsx
import { useIntl } from 'react-intl';

function ClientForm() {
  const intl = useIntl();

  return (
    <label>
      {intl.formatMessage({ id: 'client.form.name.label' })}
    </label>
  );
}
```

## Ou com FormattedMessage

```tsx
import { FormattedMessage } from 'react-intl';

<FormattedMessage id="client.form.name.label" />
```

## Veja Também

- [Integrações](/modulos/integracoes/) — Bibliotecas de formatação (dayjs, luxon, react-number-format)
- [Variáveis de Ambiente](/arquitetura/variaveis-ambiente/) — Configuração de locale padrão
