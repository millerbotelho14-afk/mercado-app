import type { Item, Override, Purchase } from '../db/schema';
import { isWeighed, monthKey } from './format';
import { searchText } from './normalize';

export function itemKey(name: string, brand: string | null | undefined): string {
  return `${name}|${brand ?? ''}`;
}

/** Item com os overrides já aplicados. */
export interface EffectiveItem extends Item {
  key: string;
  /** Grupo do produto: o override de agrupamento, ou a própria chave. */
  productKey: string;
}

/** Uma ocorrência de compra do produto — a base de todo histórico de preço. */
export interface PriceEntry {
  purchaseId: string;
  date: string;
  store: string;
  /** Preço unitário (por kg nos itens a peso). É sempre isto que se compara. */
  unitPrice: number;
  total: number;
  qty: number;
  unit: string;
  /** Nome exato no cupom daquela loja — muda entre mercados. */
  rawName: string;
}

export interface Product {
  productKey: string;
  /** Nome mostrado: o do grupo, ou o do cupom quando não há grupo. */
  name: string;
  brands: string[];
  category: string;
  /** Nomes distintos que caem neste produto (só > 1 quando agrupado). */
  variants: string[];
  entries: PriceEntry[];
  weighed: boolean;
  search: string;
}

export interface MonthBucket {
  key: string;
  total: number;
  discount: number;
  purchases: Purchase[];
}

export type OverrideMap = Map<string, Override>;

export function toOverrideMap(list: Override[]): OverrideMap {
  return new Map(list.map((o) => [o.key, o]));
}

export function effectiveItem(item: Item, ov: OverrideMap): EffectiveItem {
  const key = itemKey(item.name, item.brand);
  const o = ov.get(key);
  return {
    ...item,
    brand: o?.brand !== undefined ? o.brand : item.brand,
    category: o?.category ?? item.category,
    key,
    productKey: o?.productKey ?? key,
  };
}

export function activePurchases(purchases: Purchase[]): Purchase[] {
  return purchases.filter((p) => !p.deleted);
}

export function byMonth(purchases: Purchase[]): MonthBucket[] {
  const map = new Map<string, MonthBucket>();
  for (const p of purchases) {
    const k = monthKey(p.date);
    let b = map.get(k);
    if (!b) {
      b = { key: k, total: 0, discount: 0, purchases: [] };
      map.set(k, b);
    }
    b.total += p.total_paid;
    b.discount += p.discount;
    b.purchases.push(p);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Índice de produtos com histórico de preço.
 * Duas linhas do mesmo item na mesma compra viram uma só (cupom às vezes repete
 * o produto), somando quantidade e total mas mantendo o preço unitário.
 */
export function buildProducts(purchases: Purchase[], ov: OverrideMap): Map<string, Product> {
  const products = new Map<string, Product>();

  for (const p of purchases) {
    for (const raw of p.items) {
      const it = effectiveItem(raw, ov);
      const groupName = ov.get(it.key)?.productKey;

      let prod = products.get(it.productKey);
      if (!prod) {
        prod = {
          productKey: it.productKey,
          // Um grupo tem nome próprio ("Músculo bovino"); item solto usa o nome do cupom.
          name: groupName && groupName !== it.key ? groupName : it.name,
          brands: [],
          category: it.category,
          variants: [],
          entries: [],
          weighed: false,
          search: '',
        };
        products.set(it.productKey, prod);
      }

      if (it.brand && !prod.brands.includes(it.brand)) prod.brands.push(it.brand);
      if (!prod.variants.includes(it.name)) prod.variants.push(it.name);
      if (isWeighed(it.unit)) prod.weighed = true;

      const existing = prod.entries.find((e) => e.purchaseId === p.id && e.rawName === it.name);
      if (existing) {
        existing.total += it.total;
        existing.qty += it.qty;
      } else {
        prod.entries.push({
          purchaseId: p.id,
          date: p.date,
          store: p.store,
          unitPrice: it.unit_price,
          total: it.total,
          qty: it.qty,
          unit: it.unit,
          rawName: it.name,
        });
      }
    }
  }

  for (const prod of products.values()) {
    prod.entries.sort((a, b) => a.date.localeCompare(b.date));
    prod.search = searchText(
      `${prod.name} ${prod.variants.join(' ')}`,
      prod.brands.join(' ') || null,
      prod.category,
    );
  }
  return products;
}

/**
 * Preço por quilo e preço por unidade não se comparam. Quando um produto
 * aparece nas duas formas (coração de frango na bandeja e a granel, por
 * exemplo), só a forma predominante entra nas comparações.
 */
export function unitClass(unit: string): 'KG' | 'UN' {
  return isWeighed(unit) ? 'KG' : 'UN';
}

export function comparableEntries(prod: Product): PriceEntry[] {
  const kg = prod.entries.filter((e) => unitClass(e.unit) === 'KG');
  const un = prod.entries.filter((e) => unitClass(e.unit) === 'UN');
  return kg.length >= un.length ? kg : un;
}

export interface Variation {
  product: Product;
  first: number;
  last: number;
  firstDate: string;
  lastDate: string;
  pct: number;
}

/** Variação do preço unitário entre a primeira e a última compra do produto. */
export function priceVariations(products: Map<string, Product>, minPct = 2): Variation[] {
  const out: Variation[] = [];
  for (const prod of products.values()) {
    const entries = comparableEntries(prod);
    if (entries.length < 2) continue;
    const first = entries[0];
    const last = entries[entries.length - 1];
    if (!first.unitPrice) continue;
    const pct = ((last.unitPrice - first.unitPrice) / first.unitPrice) * 100;
    if (Math.abs(pct) < minPct) continue;
    out.push({
      product: prod,
      first: first.unitPrice,
      last: last.unitPrice,
      firstDate: first.date,
      lastDate: last.date,
      pct,
    });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

export interface StoreComparison {
  product: Product;
  /** Preço unitário médio em cada loja. */
  avgByStore: Record<string, number>;
  cheapest: string;
  /** Quanto se economiza por unidade comprando na loja mais barata. */
  spread: number;
  spreadPct: number;
}

/** Produtos comprados em 2+ lojas — onde a comparação de preço faz sentido. */
export function storeComparisons(products: Map<string, Product>): StoreComparison[] {
  const out: StoreComparison[] = [];
  for (const prod of products.values()) {
    const byStore = new Map<string, number[]>();
    for (const e of comparableEntries(prod)) {
      const arr = byStore.get(e.store) ?? [];
      arr.push(e.unitPrice);
      byStore.set(e.store, arr);
    }
    if (byStore.size < 2) continue;

    const avgByStore: Record<string, number> = {};
    for (const [store, prices] of byStore) {
      avgByStore[store] = prices.reduce((s, v) => s + v, 0) / prices.length;
    }
    const sorted = Object.entries(avgByStore).sort((a, b) => a[1] - b[1]);
    const [cheapest, min] = sorted[0];
    const max = sorted[sorted.length - 1][1];
    out.push({
      product: prod,
      avgByStore,
      cheapest,
      spread: max - min,
      spreadPct: min > 0 ? ((max - min) / min) * 100 : 0,
    });
  }
  return out.sort((a, b) => b.spreadPct - a.spreadPct);
}

export interface StoreStats {
  store: string;
  visits: number;
  total: number;
  items: number;
  avgTicket: number;
  avgItems: number;
  costPerItem: number;
}

export function storeStats(purchases: Purchase[]): StoreStats[] {
  const map = new Map<string, { visits: number; total: number; items: number }>();
  for (const p of purchases) {
    const s = map.get(p.store) ?? { visits: 0, total: 0, items: 0 };
    s.visits++;
    s.total += p.total_paid;
    s.items += p.items.length;
    map.set(p.store, s);
  }
  return [...map.entries()]
    .map(([store, d]) => ({
      store,
      visits: d.visits,
      total: d.total,
      items: d.items,
      avgTicket: d.total / d.visits,
      avgItems: d.items / d.visits,
      costPerItem: d.items ? d.total / d.items : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
  pct: number;
}

export function categoryTotals(purchases: Purchase[], ov: OverrideMap): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  let grand = 0;
  for (const p of purchases) {
    for (const raw of p.items) {
      const it = effectiveItem(raw, ov);
      const c = map.get(it.category) ?? { total: 0, count: 0 };
      c.total += it.total;
      c.count++;
      map.set(it.category, c);
      grand += it.total;
    }
  }
  return [...map.entries()]
    .map(([category, d]) => ({
      category,
      total: d.total,
      count: d.count,
      pct: grand ? (d.total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Último preço conhecido de cada item — alimenta o autocomplete e o alerta de preço alto. */
export interface KnownItem {
  key: string;
  name: string;
  brand: string | null;
  category: string;
  unit: string;
  lastPrice: number;
  lastDate: string;
  lastStore: string;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  timesBought: number;
  weighed: boolean;
}

export function knownItems(products: Map<string, Product>): KnownItem[] {
  const out: KnownItem[] = [];
  for (const prod of products.values()) {
    // Um grupo pode ter nomes diferentes por loja; o autocomplete oferece cada um.
    const byName = new Map<string, PriceEntry[]>();
    for (const e of prod.entries) {
      const arr = byName.get(e.rawName) ?? [];
      arr.push(e);
      byName.set(e.rawName, arr);
    }
    for (const [name, entries] of byName) {
      const prices = entries.map((e) => e.unitPrice);
      const last = entries[entries.length - 1];
      out.push({
        key: itemKey(name, prod.brands[0] ?? null),
        name,
        brand: prod.brands[0] ?? null,
        category: prod.category,
        unit: last.unit,
        lastPrice: last.unitPrice,
        lastDate: last.date,
        lastStore: last.store,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        avgPrice: prices.reduce((s, v) => s + v, 0) / prices.length,
        timesBought: entries.length,
        weighed: prod.weighed,
      });
    }
  }
  return out.sort((a, b) => b.timesBought - a.timesBought);
}
