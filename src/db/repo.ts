import { db, type Item, type Purchase } from './schema';
import { toBR, toISO } from '../lib/format';

export function newId(): string {
  return crypto.randomUUID();
}

export async function savePurchase(
  input: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<string> {
  const now = Date.now();
  const id = input.id ?? newId();
  const existing = input.id ? await db().purchases.get(input.id) : undefined;
  await db().purchases.put({
    ...input,
    id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  return id;
}

/** Exclusão marcada, não apagada: é o que permite a sincronia propagar a remoção. */
export async function deletePurchase(id: string): Promise<void> {
  const p = await db().purchases.get(id);
  if (!p) return;
  await db().purchases.put({ ...p, deleted: 1, updatedAt: Date.now() });
}

export async function setOverride(
  key: string,
  patch: { category?: string; brand?: string | null; productKey?: string },
): Promise<void> {
  const existing = await db().overrides.get(key);
  await db().overrides.put({ ...existing, ...patch, key, updatedAt: Date.now() });
}


/** Export no mesmo formato do JSON original — o arquivo continua legível fora do app. */
export async function exportJSON(): Promise<string> {
  const purchases = await db().purchases.toArray();
  const overrides = await db().overrides.toArray();
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    purchases: purchases
      .filter((p) => !p.deleted)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({
        file: p.source,
        store: p.store,
        date: toBR(p.date),
        total_gross: p.total_gross,
        discount: p.discount,
        total_paid: p.total_paid,
        items: p.items,
      })),
    overrides,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadJSON(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  added: number;
  skipped: number;
  overrides: number;
}

/**
 * Aceita tanto o array puro do MVP quanto o export novo.
 * Compra já existente (mesma loja + data + total) é ignorada, para poder
 * reimportar o mesmo arquivo sem duplicar nada.
 */
export async function importJSON(text: string): Promise<ImportResult> {
  const parsed = JSON.parse(text);
  const list: any[] = Array.isArray(parsed) ? parsed : (parsed.purchases ?? []);
  if (!Array.isArray(list)) throw new Error('Arquivo sem lista de compras.');

  const existing = await db().purchases.toArray();
  const fingerprint = new Set(
    existing.map((p) => `${p.store}|${p.date}|${p.total_paid.toFixed(2)}`),
  );

  const now = Date.now();
  const toAdd: Purchase[] = [];
  let skipped = 0;

  for (const p of list) {
    if (!p?.store || !p?.date || !Array.isArray(p.items)) {
      skipped++;
      continue;
    }
    const date = toISO(p.date);
    const totalPaid = Number(p.total_paid ?? 0);
    const fp = `${p.store}|${date}|${totalPaid.toFixed(2)}`;
    if (fingerprint.has(fp)) {
      skipped++;
      continue;
    }
    fingerprint.add(fp);
    toAdd.push({
      id: newId(),
      store: String(p.store),
      date,
      total_gross: Number(p.total_gross ?? totalPaid),
      discount: Number(p.discount ?? 0),
      total_paid: totalPaid,
      items: p.items as Item[],
      source: p.file,
      createdAt: now,
      updatedAt: now,
    });
  }
  if (toAdd.length) await db().purchases.bulkPut(toAdd);

  let overrides = 0;
  if (!Array.isArray(parsed) && Array.isArray(parsed.overrides)) {
    for (const o of parsed.overrides) {
      if (!o?.key) continue;
      const current = await db().overrides.get(o.key);
      // Na dúvida, vence a versão mais recente.
      if (!current || (o.updatedAt ?? 0) > current.updatedAt) {
        await db().overrides.put({ ...o, updatedAt: o.updatedAt ?? now });
        overrides++;
      }
    }
  }

  return { added: toAdd.length, skipped, overrides };
}
