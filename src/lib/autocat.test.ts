import { describe, expect, it } from 'vitest';
import { buildCategoryIndex, guessCategory } from './autocat';
import type { Product } from './selectors';

function produto(nome: string, categoria: string): Product {
  return {
    productKey: nome,
    name: nome,
    brands: [],
    category: categoria,
    variants: [nome],
    entries: [],
    weighed: false,
    search: '',
  };
}

const historico = new Map<string, Product>([
  ['SUCO ABACAXI MARATA', produto('SUCO ABACAXI MARATA', 'Bebidas')],
  ['AMAC.ROUPA YPE CONC.', produto('AMAC.ROUPA YPE CONC.', 'Limpeza')],
]);
const indice = buildCategoryIndex(historico);

describe('categoria de item importado', () => {
  it('prefere o histórico, que já traz as suas correções', () => {
    const r = guessCategory('AMAC.ROUPA YPE CONC.', indice);
    expect(r).toEqual({ category: 'Limpeza', source: 'historico' });
  });

  it('ignora o tamanho no fim do nome ao procurar no histórico', () => {
    // A mesma loja escreve "SUCO ABACAXI MARATA" numa nota e "... 1L" noutra.
    const r = guessCategory('SUCO ABACAXI MARATA 1L', indice);
    expect(r.category).toBe('Bebidas');
    expect(r.source).toBe('historico');
  });

  // Regressão: a regra de fruta pegava "abacaxi" antes da regra de bebida,
  // e suco caía em Hortifruti.
  it.each([
    ['SUCO ABACAXI DEL VALE', 'Bebidas'],
    ['POLPA TOM.PAGANINI', 'Congelados e Prontos'],
    ['FILE PEITO FGO SEARA', 'Carnes e Proteínas'],
    ['DET.LIQ.YPE', 'Limpeza'],
    ['CR.DENTAL COLGATE', 'Higiene e Beleza'],
    ['BANANA PRATA', 'Hortifruti'],
  ])('%s → %s', (nome, esperado) => {
    expect(guessCategory(nome, indice).category).toBe(esperado);
  });

  it('admite que não sabe, em vez de chutar errado calado', () => {
    const r = guessCategory('XPTO 3000', indice);
    expect(r).toEqual({ category: 'Outros', source: 'padrao' });
  });
});
