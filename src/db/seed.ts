import { db, getMeta, setMeta, type Override } from './schema';
import { SEED_BRAND_FIXES, SEED_CATEGORY_FIXES, SEED_PRODUCT_GROUPS } from '../lib/categories';

const SEED_VERSION = 2;

export function seedOverrides(): Override[] {
  const now = Date.now();
  const map = new Map<string, Override>();

  const touch = (key: string): Override => {
    let o = map.get(key);
    if (!o) {
      o = { key, updatedAt: now };
      map.set(key, o);
    }
    return o;
  };

  for (const [key, category] of SEED_CATEGORY_FIXES) touch(key).category = category;
  for (const [key, brand] of SEED_BRAND_FIXES) touch(key).brand = brand;
  for (const [groupName, keys] of SEED_PRODUCT_GROUPS) {
    for (const key of keys) touch(key).productKey = groupName;
  }
  return [...map.values()];
}

/**
 * v2: os agrupamentos foram revisados para só juntar itens de fato comparáveis.
 * Refaz os grupos a partir da lista atual, preservando as correções de
 * categoria e marca que já estavam gravadas.
 */
async function regroupToV2(): Promise<void> {
  const current = await db().overrides.toArray();
  const groupOf = new Map<string, string>();
  for (const [groupName, keys] of SEED_PRODUCT_GROUPS) {
    for (const key of keys) groupOf.set(key, groupName);
  }

  const now = Date.now();
  const keep: typeof current = [];
  const drop: string[] = [];

  for (const o of current) {
    const next = { ...o, productKey: groupOf.get(o.key), updatedAt: now };
    if (next.category === undefined && next.brand === undefined && next.productKey === undefined) {
      drop.push(o.key);
    } else {
      keep.push(next);
    }
    groupOf.delete(o.key);
  }
  // Grupos novos que ainda não tinham linha de override.
  for (const [key, groupName] of groupOf) {
    keep.push({ key, productKey: groupName, updatedAt: now });
  }

  if (drop.length) await db().overrides.bulkDelete(drop);
  if (keep.length) await db().overrides.bulkPut(keep);
}

/**
 * Roda uma única vez por versão, ao abrir a conta.
 *
 * Compras não são semeadas: elas pertencem a quem as fez. Conta nova começa
 * vazia e enche pela importação de nota, pelo arquivo JSON ou pela sincronia.
 * As correções de categoria e os agrupamentos, sim, entram para todo mundo —
 * são conhecimento sobre produtos, não dados pessoais, e para quem nunca
 * comprou aqueles itens simplesmente não têm efeito.
 */
export async function ensureSeeded(): Promise<void> {
  const version = await getMeta('seedVersion', 0);
  if (version >= SEED_VERSION) return;

  if (version === 0) {
    if ((await db().overrides.count()) === 0) {
      await db().overrides.bulkPut(seedOverrides());
    }
  } else {
    await regroupToV2();
  }
  await setMeta('seedVersion', SEED_VERSION);
}

