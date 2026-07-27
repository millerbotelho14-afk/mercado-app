import { db, getMeta, setMeta, type Override } from './schema';
import { SEED_BRAND_FIXES, SEED_CATEGORY_FIXES, SEED_PRODUCT_GROUPS } from '../lib/categories';

const SEED_VERSION = 3;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * v3: as compras antigas nasceram com id do tipo `seed-0-0506pdf`, de quando os
 * dados vinham de um arquivo. A tabela na nuvem usa `uuid`, então a sincronia
 * recusava essas linhas. Aqui elas ganham um uuid de verdade — nada aponta para
 * o id antigo, então trocar é seguro.
 */
async function migrateIdsToUuid(): Promise<void> {
  // Precisa ser uma transação: em desenvolvimento o React monta o efeito duas
  // vezes, e duas execuções simultâneas liam a mesma lista e gravavam duas
  // cópias de cada compra. Dentro da transação a segunda já vê o resultado da
  // primeira e não encontra nada para fazer.
  await db().transaction('rw', db().purchases, async () => {
    const legacy = (await db().purchases.toArray()).filter((p) => !UUID_RE.test(p.id));
    if (legacy.length === 0) return;

    await db().purchases.bulkDelete(legacy.map((p) => p.id));
    await db().purchases.bulkPut(
      legacy.map((p) => ({ ...p, id: crypto.randomUUID(), updatedAt: Date.now() })),
    );
  });
}

/**
 * Conserta as cópias criadas antes de a migração virar transação. Duas compras
 * são a mesma quando coincidem loja, data, valor e a lista de itens.
 */
async function dedupePurchases(): Promise<number> {
  return db().transaction('rw', db().purchases, async () => {
    const all = (await db().purchases.toArray()).filter((p) => !p.deleted);
    const seen = new Set<string>();
    const doomed: typeof all = [];

    for (const p of [...all].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))) {
      const fingerprint = [
        p.store,
        p.date,
        p.total_paid.toFixed(2),
        p.items.length,
        p.items.map((i) => `${i.name}:${i.total}`).join('|'),
      ].join('#');
      if (seen.has(fingerprint)) doomed.push(p);
      else seen.add(fingerprint);
    }
    // Marca em vez de apagar: assim a limpeza viaja para os outros aparelhos
    // pela sincronia, em vez de a cópia voltar na próxima descida.
    if (doomed.length) {
      const now = Date.now();
      await db().purchases.bulkPut(doomed.map((p) => ({ ...p, deleted: 1 as const, updatedAt: now })));
    }
    return doomed.length;
  });
}

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
  // Fora do controle de versão de propósito: é barato, não faz nada quando não
  // há o que corrigir, e assim conserta sozinho qualquer banco que tenha
  // escapado da migração.
  await migrateIdsToUuid();
  await dedupePurchases();

  const version = await getMeta('seedVersion', 0);
  if (version >= SEED_VERSION) return;

  if (version === 0) {
    if ((await db().overrides.count()) === 0) {
      await db().overrides.bulkPut(seedOverrides());
    }
  } else if (version < 2) {
    await regroupToV2();
  }
  await setMeta('seedVersion', SEED_VERSION);
}

