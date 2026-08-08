import { describe, expect, it } from 'vitest';
import { canonicalUnit, fmt, isWeighed, monthKey, monthLabel, toBR, toISO } from './format';

describe('unidades do cupom', () => {
  // Regressão: o autocomplete devolvia `UND9` para um <select> que só conhece
  // `UND`. A tela mostrava "UND" e o banco guardava "UND9" — valores diferentes.
  it.each([
    ['UND9', 'UND'],
    ['KG9', 'KG'],
    ['BDJ7', 'BDJ'],
    ['CXA1', 'CX'],
    ['PCT9', 'PCT'],
    ['UNID', 'UND'],
    ['Un', 'UND'],
    ['PC', 'PCT'],
  ])('%s vira %s', (cru, esperado) => {
    expect(canonicalUnit(cru)).toBe(esperado);
  });

  it('cai em UND quando não reconhece, em vez de inventar', () => {
    expect(canonicalUnit('ZZZ')).toBe('UND');
    expect(canonicalUnit('')).toBe('UND');
  });

  it('reconhece item vendido a peso, com ou sem dígito fiscal', () => {
    expect(isWeighed('KG')).toBe(true);
    expect(isWeighed('KG9')).toBe(true);
    expect(isWeighed('UND')).toBe(false);
  });
});

describe('datas', () => {
  it('converte nos dois sentidos', () => {
    expect(toISO('04/07/2026')).toBe('2026-07-04');
    expect(toBR('2026-07-04')).toBe('04/07/2026');
  });

  it('aceita ISO na entrada sem estragar', () => {
    expect(toISO('2026-07-04')).toBe('2026-07-04');
  });

  it('agrupa e rotula o mês', () => {
    expect(monthKey('2026-07-04')).toBe('2026-07');
    expect(monthLabel('2026-07')).toBe('Jul/26');
  });
});

describe('dinheiro', () => {
  it('usa ponto de milhar e vírgula decimal', () => {
    expect(fmt(5119.69)).toBe('R$ 5.119,69');
    expect(fmt(0)).toBe('R$ 0,00');
  });
});
