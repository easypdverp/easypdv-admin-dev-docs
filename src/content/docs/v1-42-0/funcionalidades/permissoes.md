---
title: Permissões
description: Grupos de Permissão do Despensinha ERP — categorias de capacidades e como são concedidas aos usuários.
sidebar:
  order: 2
---

Ver [RBAC](../arquitetura/rbac/) para o mecanismo (CASL, `PERMISSIONS`, `permissionGroups.ts`, construção da ability). Esta página cobre como essas capacidades são organizadas para quem administra o sistema.

## Grupos de Permissão

Em Preferências > Geral > Grupos de Permissão, cada grupo reúne um conjunto de capacidades funcionais e é atribuído a usuários e a convites. A tela de criação/edição de um grupo mostra as capacidades em uma árvore por categoria: marcar uma categoria inteira concede todas as capacidades dela de uma vez; marcar uma capacidade específica não concede automaticamente uma subação ligada a ela — por exemplo, marcar a capacidade de repasse a comunidades não concede, por si só, a capacidade de reabrir um repasse já feito, que é marcada separadamente.

`Acesso total` é uma concessão própria, separada das demais: quando marcada, dispensa qualquer outra seleção e libera todas as telas e ações do sistema.

## Categorias

As capacidades aparecem agrupadas nestas categorias:

- Dashboard
- Vendas
- Financeiro
- Operacional
- Catálogo
- Cadastros
- Suprimentos
- Relatórios
- Preferências
- Fiscal
- Documentos fiscais
- Espaço contador
- Espaço gestor
- Relacionamento com clientes
- Integrações

## Relatórios

A categoria Relatórios reúne as capacidades de cada tela de relatório, organizadas pelo mesmo domínio que aparece no menu:

- **Vendas**: Relatório de Vendas (produto, categoria, cliente ou PDV, com bruto, desconto, líquido, custo, margem e totais), Curva ABC, Vendas por Hora, Produtos não encontrados, Conversão do PDV e Notas Fiscais (Consulta Produto, Operação, Cliente, Evolução)
- **Suprimentos**: Perdas por produtos, Quebra e acuracidade por PDV, Ordem de Compra, Estoque (Entrada e Saída, Saldo, Sem Circulação, Custo da Mercadoria Vendida) e Notas de Entrada (Operação, Fornecedor, Produto, Evolução, Preço de compra por fornecedor)
- **Finanças**: Relatórios Gerais (Saldos por conta financeira, DRE, Resultado por PDV, Fluxo de Caixa), Caixa (Categoria, Cliente) e Contas (A Pagar, A Receber, Recebimento)

Na lista de capacidades não há uma entrada separada para "Venda e Finança": o conteúdo correspondente está no Relatório de Vendas. A capacidade de Visão Financeira do estoque também libera a tela Saldo, junto com a capacidade própria de Saldo.

## Veja Também

- [RBAC (Permissões)](/arquitetura/rbac/) — Mecanismo CASL por trás dos Grupos de Permissão
- [Roteamento](/arquitetura/roteamento/) — Proteção de rotas com `AbilityProtectedRoute`
