---
title: Histórico de Versões
description: Changelog do Despensinha ERP.
sidebar:
  order: 1
---

## v1.42.0 — 2026-10-15

- Multiempresa: empresa no ponto de venda, depósito, ordem de compra, contas, conta bancária e notas; filtro de empresa no dashboard, nos relatórios e na geração do SPED
- Preferências › Empresas com configuração fiscal por empresa e contador em campo único
- Relatórios: Conversão do PDV, Resultado por PDV, Quebra e acuracidade, Vendas por dia/mês/promoção/cupom, DRE comparando meses e Vendas por Hora por dia da semana; remoção dos relatórios partilha ICMS, NF produto, consumo, maior circulação e abaixo do mínimo
- Necessidade de compra acionável em Suprimentos, com situação Excesso, ordenação por coluna e filtro de venda nos últimos N dias; preço de compra por fornecedor; saldo de estoque na data de referência
- Exportação da conferência de recebimento e dos repasses; tarifa por kWh com seis casas decimais
- Filtro por faixa de valor em pedidos de venda e ordens de compra
- Conferência de estoque restrita à tela de Conferências; preview do tema do PDV fiel ao EasyPDV Touch e ao POS
- CI com SonarQube, Trivy e gate de ESLint, tsc e Vitest; execução local com Docker Compose

## v1.41.2 — 2026-09-28

- Correção para que a quantidade alterada e não confirmada na separação volte ao valor cheio

## v1.41.1 — 2026-09-26

- Correção no alerta de estoque sem ação, que quebrava o detalhe do produto

## v1.27.1 — 2026-03-20

- Correções de estabilidade no módulo de inventário
- Ajustes na tela de histórico de preços de produtos

## v1.27.0

- Gestão de inventário com histórico de preços
- Novo Espaço do Gestor com dashboard gerencial
- Melhoria nos filtros de NF-e

## v1.26.0

- Sistema de gerenciamento de assinatura (subscription)
- Refatoração do módulo de exportação
- Redesign da página inicial com seções de dashboard

## v1.25.0

- Melhorias no módulo financeiro (competência)
- Novo padrão de filtros com offcanvas e persistência em URL
- Bulk actions em pedidos de compra
