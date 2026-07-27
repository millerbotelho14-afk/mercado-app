/** Paleta das lojas. O MVP tinha 5 lojas fixas no código e qualquer mercado novo
 *  caía num cinza genérico — aqui a cor sai de um hash do nome, então loja nova
 *  já nasce com identidade e sempre a mesma. */

export const PALETTE = [
  '#16a34a', '#2563eb', '#d97706', '#9333ea', '#e11d48',
  '#0891b2', '#65a30d', '#c2410c', '#7c3aed', '#0f766e',
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function storeColor(store: string): string {
  return PALETTE[hash(store) % PALETTE.length];
}

/**
 * A nota traz a razão social ("WMS SUPERMERCADOS DO BRASIL LTDA"), não o nome
 * pelo qual a loja é conhecida. Estes são os CNPJs que já apareceram nos seus
 * cupons; para os demais, o app aprende o apelido na primeira importação.
 */
export const SEED_CNPJ_STORES: Record<string, string> = {
  '93.209.765/0634-61': 'Atacadão',
  '00.063.960/0075-37': "Sam's Club",
  '06.057.223/0510-86': 'Extra/Assaí',
  '14.675.643/0001-40': 'King Boi',
};

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/**
 * Descobre o apelido da loja: primeiro o que você já ensinou, depois os CNPJs
 * conhecidos, depois uma loja existente cujo nome apareça na razão social
 * ("KING BOI CENTRAL DE CARNES" → "King Boi"). Sem palpite, devolve a razão
 * social para você renomear na tela.
 */
export function guessStore(
  cnpj: string,
  razaoSocial: string,
  knownStores: string[],
  learned: Record<string, string> = {},
): string {
  if (learned[cnpj]) return learned[cnpj];
  if (SEED_CNPJ_STORES[cnpj]) return SEED_CNPJ_STORES[cnpj];

  const razao = fold(razaoSocial);
  for (const store of knownStores) {
    const first = fold(store).split(/[\s/]+/)[0];
    if (first.length >= 3 && razao.includes(first)) return store;
  }
  return razaoSocial;
}

/** Nome curto para caber em chip, coluna de tabela e legenda de gráfico. */
export function storeShort(store: string): string {
  const cleaned = store.replace(/\b(supermercado|mercado|atacado|club|clube)\b/gi, '').trim();
  const first = (cleaned || store).split(/[\s/]+/)[0];
  return first.length > 12 ? first.slice(0, 12) + '…' : first;
}
