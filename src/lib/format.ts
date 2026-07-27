const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function fmt(v: number): string {
  return (
    'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** Versão curta para eixos e rótulos de gráfico. */
export function fmtShort(v: number): string {
  return v >= 1000 ? 'R$ ' + (v / 1000).toFixed(1).replace('.', ',') + 'k' : 'R$ ' + Math.round(v);
}

export function fmtNum(v: number, decimals = 2): string {
  return v.toFixed(decimals).replace('.', ',');
}

/** ISO (yyyy-mm-dd) → dd/mm/aaaa, para exibir. */
export function toBR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** dd/mm/aaaa → ISO. Usado na importação do JSON antigo. */
export function toISO(br: string): string {
  if (!br) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(br)) return br;
  const [d, m, y] = br.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Chave de mês, ordenável: yyyy-mm. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}


export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Itens vendidos a peso: comparar preço/kg, nunca o total da linha. */
export function isWeighed(unit: string): boolean {
  return !!unit && unit.toUpperCase().startsWith('KG');
}

/** Unidades aceitas no formulário de nova compra. */
export const UNITS = ['UND', 'KG', 'PCT', 'CX', 'BDJ', 'GFA', 'FRC', 'EMB', 'PAR', 'TBO', 'VDO'];

const UNIT_ALIASES: Record<string, string> = {
  UNID: 'UND',
  UN: 'UND',
  U: 'UND',
  CXA: 'CX',
  BJ: 'BDJ',
  PC: 'PCT',
  PCTE: 'PCT',
};

/**
 * O cupom traz códigos como `UND9`, `KG9`, `BDJ7`, `CXA1` — o dígito final é
 * controle fiscal, não unidade. Sem normalizar, o autocomplete devolvia `UND9`
 * para um `<select>` que só conhece `UND`, e o campo mostrava um valor
 * diferente do que seria salvo.
 */
export function canonicalUnit(raw: string): string {
  if (!raw) return 'UND';
  const base = raw.toUpperCase().replace(/\d+$/, '').trim();
  const mapped = UNIT_ALIASES[base] ?? base;
  return UNITS.includes(mapped) ? mapped : 'UND';
}
