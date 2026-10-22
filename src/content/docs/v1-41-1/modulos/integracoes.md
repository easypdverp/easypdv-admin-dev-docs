---
title: Integracoes
description: Bibliotecas externas integradas ao Despensinha ERP e seus padroes de uso.
sidebar:
  order: 6
---

O Despensinha ERP integra bibliotecas especializadas para graficos, mapas, manipulacao de canvas e drag-and-drop. Cada biblioteca tem um proposito especifico e segue padroes consistentes de integracao com React.

## Visao Geral

| Biblioteca | Versao | Uso no ERP |
|-----------|--------|------------|
| ApexCharts | 3.35.0 | Graficos interativos nos widgets do Dashboard (via Metronic) |
| react-apexcharts | 1.4.0 | Wrapper React para ApexCharts |
| Chart.js | ^4.5.0 | Graficos do Dashboard, relatorios financeiros e operacionais |
| react-chartjs-2 | ^5.3.0 | Wrapper React para Chart.js |
| Leaflet | ^1.9.4 | Mapas para selecao de coordenadas (Pontos de Venda) |
| react-leaflet | ^4.2.1 | Wrapper React para Leaflet |
| Fabric.js | ^6.9.1 | Canvas para design de etiquetas (Editor de Tags) |
| @dnd-kit/core | ^6.3.1 | Drag-and-drop para reordenacao de colunas na exportacao |
| @dnd-kit/sortable | ^10.0.0 | Estrategia de ordenacao para listas sortable |

## ApexCharts e Chart.js

O ERP utiliza duas bibliotecas de graficos complementares:

- **ApexCharts** e usado nos widgets herdados do template Metronic (`src/_metronic/partials/widgets/`). Sao graficos interativos com animacoes, utilizados em cards de estatisticas e widgets auxiliares do Dashboard.
- **Chart.js** (via react-chartjs-2) e usado nos componentes proprios da aplicacao (`src/app/components/charts/`). E a escolha principal para graficos do Dashboard, relatorios financeiros, vendas e operacionais.

### Setup do Chart.js

O Chart.js e registrado globalmente no `main.tsx` da aplicacao:

```ts
// src/main.tsx
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)
```

Componentes individuais tambem registram modulos especificos quando necessario:

```ts
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip } from "chart.js"
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)
```

### Padrao de Uso — Chart.js

O padrao tipico usa o componente `Bar`, `Line` ou `Doughnut` do react-chartjs-2 com tipagem TypeScript:

```tsx
// src/app/components/charts/ProgressBarChart.tsx
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip,
  type ChartOptions, type ChartData } from "chart.js"
import { Bar } from "react-chartjs-2"

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

type ProgressBarChartProps = {
  value: number
  goal: number
  height?: number
}

const ProgressBarChart: React.FC<ProgressBarChartProps> = ({ value, goal, height = 28 }) => {
  const percentage = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 100

  const data: ChartData<"bar", number[], string> = {
    labels: [""],
    datasets: [
      {
        label: "progress",
        data: [percentage],
        backgroundColor: ["#10b981"],
        borderRadius: { topLeft: 14, bottomLeft: 14, topRight: 14, bottomRight: 14 },
        borderSkipped: false,
        barThickness: height,
      },
    ],
  }

  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false, stacked: true, min: 0, max: 100 },
      y: { display: false, stacked: true },
    },
  }

  return <Bar data={data} options={options} />
}
```

### Padrao de Uso — ApexCharts

Os widgets Metronic utilizam ApexCharts diretamente (sem wrapper React):

```tsx
// src/_metronic/partials/widgets/charts/ChartsWidget3.tsx
import ApexCharts, { type ApexOptions } from 'apexcharts'

const chart = new ApexCharts(chartRef.current, getChartOptions())
chart.render()

// Cleanup no useEffect
return () => {
  if (chart) {
    chart.destroy()
  }
}
```

### Componentes Principais

| Componente | Biblioteca | Tipo de Grafico |
|-----------|-----------|----------------|
| `ProgressBarChart` | Chart.js | Barra horizontal de progresso |
| `CashFlowChart` | Chart.js | Barra vertical (fluxo de caixa) |
| `PeakHoursChart` | Chart.js | Barra vertical (horarios de pico) |
| `BestSellerCategoriesChart` | Chart.js | Barra horizontal (categorias mais vendidas) |
| `PriceHistoryChart` | Chart.js | Linha (historico de precos) |
| `PosAvailabilityChart` | Chart.js | Doughnut (disponibilidade de PDVs) |
| `PaymentMethodsChart` | Chart.js | Doughnut (metodos de pagamento) |
| `ProfitOverviewCard` | Chart.js | Linha (visao geral de lucros) |
| `TotalSalesCard` | Chart.js | Linha (vendas totais) |
| `FinanceGrowthCard` | Chart.js | Linha (crescimento financeiro) |
| `ReceivablesAgingCard` | Chart.js | Barra (aging de recebiveis) |
| `ManagerBillsChart` | Chart.js | Barra (contas do gestor) |
| `MovementChart` | Chart.js | Barra (movimentacao de estoque) |
| `ChartsWidget1-8` | ApexCharts | Diversos (widgets Metronic) |
| `MixedWidget2-14` | ApexCharts | Diversos (widgets Metronic) |
| `StatisticsWidget3-4` | ApexCharts | Diversos (widgets Metronic) |

## Leaflet (Mapas)

**Proposito:** Renderizacao de mapas interativos para selecao de coordenadas geograficas, utilizado no cadastro de Pontos de Venda.

### Setup

O react-leaflet encapsula o Leaflet com componentes React declarativos. O CSS do Leaflet deve ser importado:

```tsx
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet"
import { type LeafletMouseEvent } from "leaflet"
import "leaflet/dist/leaflet.css"
```

### Padrao de Uso

O componente `LocationPickerModal` permite ao usuario selecionar coordenadas clicando no mapa:

```tsx
// src/app/pages/registrations/point-of-sale/modal/LocationPickerModal.tsx

// Componente para capturar cliques no mapa
const MapClickHandler = ({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click: (event: LeafletMouseEvent) => {
      const { lat, lng } = event.latlng
      onLocationSelect(lat, lng)
    },
  })
  return null
}

// Componente principal
const LocationPickerModal = ({ show, onClose, initialLatitude, initialLongitude }: Props) => {
  const [selectedLatitude, setSelectedLatitude] = useState(-15.794953)
  const [selectedLongitude, setSelectedLongitude] = useState(-47.882793)

  return (
    <MapContainer center={[selectedLatitude, selectedLongitude]} scrollWheelZoom={true}
      style={{ width: "100%", height: "400px" }} zoom={4}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[selectedLatitude, selectedLongitude]} />
      <MapClickHandler onLocationSelect={(lat, lng) => {
        setSelectedLatitude(lat)
        setSelectedLongitude(lng)
      }} />
    </MapContainer>
  )
}
```

### Funcionalidades

- **Geocodificacao**: Busca coordenadas a partir do nome da cidade via API Nominatim (OpenStreetMap)
- **Selecao por clique**: O usuario clica no mapa para definir latitude e longitude
- **Coordenadas iniciais**: Aceita coordenadas pre-existentes ou centraliza no Brasil
- **Zoom dinamico**: Ajusta o zoom automaticamente baseado no contexto (cidade encontrada vs. visao geral)

### Componentes

| Componente | Arquivo | Funcao |
|-----------|---------|--------|
| `LocationPickerModal` | `src/app/pages/registrations/point-of-sale/modal/LocationPickerModal.tsx` | Modal de selecao de coordenadas |

## Fabric.js (Canvas)

**Proposito:** Manipulacao de canvas para design de etiquetas (tags) de produtos, com suporte a texto, formas, codigos de barra e imagens.

### Setup

O Fabric.js e importado como namespace e usado para criar um canvas interativo com suporte a undo/redo, zoom e exportacao:

```tsx
import * as fabric from 'fabric'

// Inicializacao do canvas
const canvas = new fabric.Canvas(canvasRef.current, {
  width: widthPx,
  height: heightPx,
  backgroundColor: '#ffffff',
  selection: true,
  preserveObjectStacking: true,
})
```

### Padrao de Uso

O componente `TagCanvas` expoe metodos via `forwardRef` + `useImperativeHandle`:

```tsx
// src/app/pages/preferences/tag-editor/components/TagCanvas.tsx

export interface TagCanvasRef {
  addElement: (item: TagToolbarItem) => void
  deleteSelected: () => void
  getCanvasJson: () => string
  loadFromJson: (json: string) => Promise<void>
  undo: () => void
  redo: () => void
  zoomIn: () => void
  zoomOut: () => void
  toImageBase64: (options?: { format?: 'png' | 'jpeg'; quality?: number }) => string
}

// Adicionar elementos ao canvas
switch (item.type) {
  case 'placeholder_text':
  case 'static_text': {
    const text = new fabric.IText(textContent, {
      left: centerX - 50,
      top: centerY - 10,
      fontFamily: defaultFont,
      fontSize: defaultFontSize,
      fill: '#000000',
    })
    canvas.add(text)
    break
  }
  case 'placeholder_barcode':
  case 'static_barcode': {
    // Gera SVG do codigo de barras com JsBarcode, converte para base64
    // e carrega como fabric.FabricImage
    const barcodeImg = await createBarcodeImage(value, 'EAN13', true)
    canvas.add(barcodeImg)
    break
  }
}
```

### Funcionalidades

- **Elementos**: Texto editavel (`IText`), retangulos, linhas, codigos de barra (via JsBarcode), imagens
- **Placeholders**: Tokens dinamicos (`{productName}`, `{price}`) substituidos na impressao
- **Undo/Redo**: Pilha de estados JSON com limite de 50 entradas
- **Zoom**: Zoom in/out com incrementos de 0.25x (range 0.25x a 3x)
- **Exportacao**: Canvas para base64 (PNG/JPEG) com multiplicador de resolucao
- **Grid e bordas**: Grade visual de 10mm e bordas de corte (tracejadas em vermelho)
- **Atalhos**: Delete/Backspace para remover, Ctrl+Z para undo, Ctrl+Y/Ctrl+Shift+Z para redo
- **Serializacao**: Salva/carrega via JSON (`toObject`/`loadFromJSON`) preservando dados customizados (`tagData`)

### Componentes

| Componente | Arquivo | Funcao |
|-----------|---------|--------|
| `TagCanvas` | `src/app/pages/preferences/tag-editor/components/TagCanvas.tsx` | Canvas principal do editor de etiquetas |
| `TagPreviewModal` | `src/app/pages/preferences/tag-editor/modal/TagPreviewModal.tsx` | Pre-visualizacao da etiqueta |
| `_tagRenderer.ts` | `src/app/pages/preferences/tag-editor/core/_tagRenderer.ts` | Renderizacao para impressao |

## dnd-kit (Drag and Drop)

**Proposito:** Drag-and-drop para reordenacao de colunas no modal de exportacao de dados, permitindo ao usuario definir a ordem das colunas exportadas.

### Setup

O @dnd-kit utiliza um contexto (`DndContext`) com sensores e uma estrategia de ordenacao:

```tsx
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
```

### Padrao de Uso

O `ExportModal` utiliza `DndContext` + `SortableContext` para permitir reordenacao de colunas:

```tsx
// src/app/modules/export/components/ExportModal.tsx

const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
)

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const oldIndex = config.selectedKeys.indexOf(String(active.id))
  const newIndex = config.selectedKeys.indexOf(String(over.id))
  if (oldIndex !== -1 && newIndex !== -1) {
    config.reorderColumns(oldIndex, newIndex)
  }
}

return (
  <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
    <SortableContext items={config.selectedKeys} strategy={verticalListSortingStrategy}>
      {config.selectedKeys.map((key) => (
        <ExportColumnItem key={key} fieldKey={key} ... />
      ))}
    </SortableContext>
  </DndContext>
)
```

Cada item sortable utiliza o hook `useSortable`:

```tsx
// src/app/modules/export/components/ExportColumnItem.tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const ExportColumnItem = ({ fieldKey, label, isSelected }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: fieldKey })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <i className="bi bi-grip-vertical" {...attributes} {...listeners} />
      {label}
    </div>
  )
}
```

### Funcionalidades

- **Sensores**: PointerSensor (mouse/touch) e KeyboardSensor (acessibilidade via teclado)
- **Deteccao de colisao**: `closestCenter` para determinar posicao de drop
- **Estrategia**: `verticalListSortingStrategy` para listas verticais
- **Feedback visual**: Opacidade reduzida durante o arraste (`isDragging`)
- **Acessibilidade**: Suporte completo a navegacao por teclado via `sortableKeyboardCoordinates`

### Componentes

| Componente | Arquivo | Funcao |
|-----------|---------|--------|
| `ExportModal` | `src/app/modules/export/components/ExportModal.tsx` | Modal de exportacao com colunas reordenaveis |
| `ExportColumnItem` | `src/app/modules/export/components/ExportColumnItem.tsx` | Item sortable individual |
