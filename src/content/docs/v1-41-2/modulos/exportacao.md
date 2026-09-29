---
title: Exportação
description: Padrão de exportação de dados (PDF, Excel, CSV) no Despensinha ERP.
sidebar:
  order: 4
---

O sistema oferece exportação para PDF, Excel e CSV. Os utilitários estão em `src/app/utils/`.

## Arquivos

| Arquivo | Função |
|---------|--------|
| `src/app/utils/exportToPDF.ts` | Gera PDF com jsPDF + jspdf-autotable |
| `src/app/utils/exportToExcel.ts` | Gera .xlsx com biblioteca XLSX |
| `src/app/utils/exportToCSV.ts` | Gera .csv |
| `src/app/modules/export/` | Componentes de botões de exportação |

## Exportar para PDF

```ts
import { exportToPDF } from '../utils/exportToPDF';

exportToPDF({
  title: 'Relatório de Clientes',
  columns: ['Nome', 'CPF/CNPJ', 'E-mail'],
  rows: clients.map(c => [c.name, c.document, c.email]),
  fileName: 'clientes.pdf',
});
```

## Exportar para Excel

```ts
import { exportToExcel } from '../utils/exportToExcel';

exportToExcel({
  sheetName: 'Clientes',
  columns: ['Nome', 'CPF/CNPJ', 'E-mail'],
  rows: clients.map(c => [c.name, c.document, c.email]),
  fileName: 'clientes.xlsx',
});
```

## Componente ExportButtons

```tsx
import { ExportButtons } from '../modules/export';

<ExportButtons
  onExportPDF={() => exportToPDF({ ... })}
  onExportExcel={() => exportToExcel({ ... })}
  onExportCSV={() => exportToCSV({ ... })}
/>
```

## Veja Também

- [Integrações](/modulos/integracoes/) — Detalhes das bibliotecas jsPDF e XLSX
- [Hooks Customizados](/modulos/hooks/) — Hook de reordenação de colunas com @dnd-kit no ExportModal
