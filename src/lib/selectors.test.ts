import { describe, expect, it } from 'vitest';
import type { Item, Override, Purchase } from '../db/schema';
import {
  buildProducts,
  categoryTotals,
  comparableEntries,
  priceVariations,
  storeComparisons,
  toOverrideMap,
} from './selectors';

function item(over: Partial<Item> = {}): Item {
  return {
    name: 'ITEM',
    brand: null,
    category: 'Outros',
    qty: 1,
    unit: 'UND',
    unit_price: 10,
    total: 10,
    ...over,
  };
}

function compra(id: string, date: string, store: string, items: Item[]): Purchase {
  const gross = items.reduce((s, i) => s + i.total, 0);
  return {
    id,
    store,
    date,
    total_gross: gross,
    discount: 0,
    total_paid: gross,
    items,
    createdAt: 1,
    updatedAt: 1,
  };
}

const semCorrecoes = toOverrideMap([]);

describe('preço por quilo nunca se mistura com preço por unidade', () => {
  // Regressão: "coração de frango" aparecia na bandeja (R$ 27,90 a peça) e a
  // granel (R$ 32,98/kg). Comparar os dois inventava variação de preço.
  const misturado = [
    compra('1', '2026-03-01', 'Atacadão', [
      item({ name: 'CORACAO', unit: 'BDJ9', unit_price: 27.9, total: 27.9 }),
    ]),
    compra('2', '2026-04-01', 'Casa', [
      item({ name: 'CORACAO', unit: 'KG', qty: 0.5, unit_price: 32.98, total: 16.49 }),
    ]),
  ];
  const produtos = buildProducts(misturado, semCorrecoes);
  const coracao = produtos.get('CORACAO|')!;

  it('só considera a forma predominante', () => {
    expect(coracao.entries).toHaveLength(2);
    expect(comparableEntries(coracao)).toHaveLength(1);
  });

  it('não gera variação de preço a partir de formas diferentes', () => {
    expect(priceVariations(produtos)).toHaveLength(0);
  });

  it('não compara lojas a partir de formas diferentes', () => {
    expect(storeComparisons(produtos)).toHaveLength(0);
  });
});

describe('mesmo produto comprado em lojas diferentes', () => {
  const compras = [
    compra('1', '2026-03-01', 'HDN', [
      item({ name: 'MUSCULO BOVINO KG', unit: 'KG', qty: 1, unit_price: 45.99, total: 45.99 }),
    ]),
    compra('2', '2026-04-01', 'Casa', [
      item({ name: 'MUSCULO KG KG', unit: 'KG', qty: 1, unit_price: 36.98, total: 36.98 }),
    ]),
  ];

  it('sem agrupar, cada nome vira um produto solto e nada se compara', () => {
    const produtos = buildProducts(compras, semCorrecoes);
    expect(produtos.size).toBe(2);
    expect(storeComparisons(produtos)).toHaveLength(0);
  });

  it('agrupado, compara e aponta a loja mais barata', () => {
    const grupos: Override[] = [
      { key: 'MUSCULO BOVINO KG|', productKey: 'Músculo bovino', updatedAt: 1 },
      { key: 'MUSCULO KG KG|', productKey: 'Músculo bovino', updatedAt: 1 },
    ];
    const produtos = buildProducts(compras, toOverrideMap(grupos));
    const comparacao = storeComparisons(produtos);

    expect(produtos.size).toBe(1);
    expect(comparacao).toHaveLength(1);
    expect(comparacao[0].cheapest).toBe('Casa');
    expect(comparacao[0].spread).toBeCloseTo(9.01, 2);
  });
});

describe('itens repetidos na mesma nota', () => {
  // O cupom às vezes lista o mesmo produto em linhas separadas.
  const compras = [
    compra('1', '2026-03-01', 'Casa', [
      item({ name: 'CARNE MOIDA', unit: 'KG', qty: 0.282, unit_price: 29.99, total: 8.46 }),
      item({ name: 'CARNE MOIDA', unit: 'KG', qty: 0.552, unit_price: 29.99, total: 16.55 }),
    ]),
  ];
  const produto = buildProducts(compras, semCorrecoes).get('CARNE MOIDA|')!;

  it('viram uma ocorrência só, somando quantidade e valor', () => {
    expect(produto.entries).toHaveLength(1);
    expect(produto.entries[0].qty).toBeCloseTo(0.834, 3);
    expect(produto.entries[0].total).toBeCloseTo(25.01, 2);
  });

  it('mantém o preço unitário, que não se soma', () => {
    expect(produto.entries[0].unitPrice).toBe(29.99);
  });
});

describe('correções manuais', () => {
  const compras = [
    compra('1', '2026-03-01', 'Atacadão', [
      item({ name: 'AMAC.ROUPA YPE CONC.', category: 'Padaria e Cereais', total: 22.9 }),
    ]),
  ];

  it('valem sobre o que veio no cupom', () => {
    const correcao: Override[] = [
      { key: 'AMAC.ROUPA YPE CONC.|', category: 'Limpeza', updatedAt: 1 },
    ];
    const totais = categoryTotals(compras, toOverrideMap(correcao));
    expect(totais).toHaveLength(1);
    expect(totais[0].category).toBe('Limpeza');
    expect(totais[0].total).toBe(22.9);
  });

  it('sem correção, o dado do cupom é preservado', () => {
    expect(categoryTotals(compras, semCorrecoes)[0].category).toBe('Padaria e Cereais');
  });
});
