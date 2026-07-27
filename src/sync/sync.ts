import { db, getMeta, setMeta, type Override, type Purchase } from '../db/schema';
import { supabase, syncConfigured } from './client';

interface SyncState {
  /** Carimbo do servidor da última linha baixada — um por tabela, porque as
   *  duas avançam em ritmos diferentes. */
  purchasesCursor: string | null;
  overridesCursor: string | null;
  /** Momento local do último envio: o que mudou depois disso ainda não subiu. */
  lastPushAt: number;
  lastSyncAt: number | null;
}

const EMPTY_STATE: SyncState = {
  purchasesCursor: null,
  overridesCursor: null,
  lastPushAt: 0,
  lastSyncAt: null,
};
const STATE_KEY = 'syncState';
const CHUNK = 200;

export interface SyncResult {
  pushedPurchases: number;
  pushedOverrides: number;
  pulledPurchases: number;
  pulledOverrides: number;
  at: number;
}

export async function getSyncState(): Promise<SyncState> {
  return getMeta<SyncState>(STATE_KEY, EMPTY_STATE);
}

/** Zera os ponteiros para a próxima sincronia rebaixar tudo do servidor. */
export async function resetSyncCursor(): Promise<void> {
  const state = await getSyncState();
  await setMeta(STATE_KEY, { ...state, purchasesCursor: null, overridesCursor: null });
}

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function purchaseToRow(p: Purchase, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    store: p.store,
    date: p.date,
    total_gross: p.total_gross,
    discount: p.discount,
    total_paid: p.total_paid,
    items: p.items,
    source: p.source ?? null,
    deleted: p.deleted === 1,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function rowToPurchase(r: any): Purchase {
  return {
    id: r.id,
    store: r.store,
    date: r.date,
    total_gross: Number(r.total_gross),
    discount: Number(r.discount),
    total_paid: Number(r.total_paid),
    items: r.items ?? [],
    source: r.source ?? undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ? 1 : undefined,
  };
}

function overrideToRow(o: Override, userId: string) {
  return {
    user_id: userId,
    key: o.key,
    category: o.category ?? null,
    brand: o.brand ?? null,
    product_key: o.productKey ?? null,
    updated_at: o.updatedAt,
  };
}

function rowToOverride(r: any): Override {
  return {
    key: r.key,
    category: r.category ?? undefined,
    brand: r.brand ?? undefined,
    productKey: r.product_key ?? undefined,
    updatedAt: Number(r.updated_at),
  };
}

/**
 * Sincronia em duas etapas: sobe o que mudou aqui desde o último envio, depois
 * baixa o que mudou no servidor desde o último cursor. Em conflito vence o
 * `updatedAt` mais recente — como só esta família mexe nos dados, duas edições
 * simultâneas no mesmo item são raras, e a mais nova é a resposta certa.
 */
export async function runSync(): Promise<SyncResult> {
  if (!syncConfigured || !supabase) throw new Error('Sincronia não configurada.');

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Entre na sua conta para sincronizar.');

  const state = await getSyncState();
  const startedAt = Date.now();

  // ── 1. Enviar ──────────────────────────────────────────────────────────
  const localPurchases = await db().purchases.where('updatedAt').above(state.lastPushAt).toArray();
  for (const batch of chunks(localPurchases)) {
    const { error } = await supabase
      .from('purchases')
      .upsert(batch.map((p) => purchaseToRow(p, userId)));
    if (error) throw new Error(`Falha ao enviar compras: ${error.message}`);
  }

  const localOverrides = await db().overrides.where('updatedAt').above(state.lastPushAt).toArray();
  for (const batch of chunks(localOverrides)) {
    const { error } = await supabase
      .from('overrides')
      .upsert(batch.map((o) => overrideToRow(o, userId)));
    if (error) throw new Error(`Falha ao enviar correções: ${error.message}`);
  }

  // ── 2. Baixar ──────────────────────────────────────────────────────────
  /**
   * Percorre as páginas do servidor a partir do cursor, gravando localmente só
   * o que for mais novo que a versão daqui. Devolve o cursor onde parou.
   */
  async function pull<TRow, TLocal>(
    table: 'purchases' | 'overrides',
    startCursor: string | null,
    convert: (row: any) => TLocal,
    save: (local: TLocal) => Promise<boolean>,
  ): Promise<{ cursor: string | null; count: number }> {
    let cursor = startCursor;
    let count = 0;
    for (;;) {
      let query = supabase!
        .from(table)
        .select('*')
        .order('server_ts', { ascending: true })
        .limit(CHUNK);
      if (cursor) query = query.gt('server_ts', cursor);

      const { data, error } = await query;
      if (error) throw new Error(`Falha ao baixar ${table}: ${error.message}`);
      if (!data?.length) break;

      for (const row of data as TRow[]) {
        if (await save(convert(row))) count++;
      }
      cursor = (data[data.length - 1] as any).server_ts;
      if (data.length < CHUNK) break;
    }
    return { cursor, count };
  }

  const purchasesPull = await pull(
    'purchases',
    state.purchasesCursor,
    rowToPurchase,
    async (remote: Purchase) => {
      const local = await db().purchases.get(remote.id);
      if (local && local.updatedAt >= remote.updatedAt) return false;
      await db().purchases.put(remote);
      return true;
    },
  );

  const overridesPull = await pull(
    'overrides',
    state.overridesCursor,
    rowToOverride,
    async (remote: Override) => {
      const local = await db().overrides.get(remote.key);
      if (local && local.updatedAt >= remote.updatedAt) return false;
      await db().overrides.put(remote);
      return true;
    },
  );

  await setMeta(STATE_KEY, {
    purchasesCursor: purchasesPull.cursor,
    overridesCursor: overridesPull.cursor,
    lastPushAt: startedAt,
    lastSyncAt: startedAt,
  } satisfies SyncState);

  return {
    pushedPurchases: localPurchases.length,
    pushedOverrides: localOverrides.length,
    pulledPurchases: purchasesPull.count,
    pulledOverrides: overridesPull.count,
    at: startedAt,
  };
}
