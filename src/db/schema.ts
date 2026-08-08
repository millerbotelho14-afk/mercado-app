import Dexie, { type EntityTable } from 'dexie';

/** Item de uma compra, do jeito que sai do cupom fiscal. */
export interface Item {
  name: string;
  brand: string | null;
  category: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
}

/** Uma ida ao mercado. Os itens ficam aninhados: é uma linha por compra,
 *  o que mantém o export/import idêntico ao JSON original e simplifica a sincronia. */
export interface Purchase {
  id: string;
  store: string;
  /** ISO yyyy-mm-dd — sempre. A formatação dd/mm/aaaa é só na tela. */
  date: string;
  total_gross: number;
  discount: number;
  total_paid: number;
  items: Item[];
  /** Chave de acesso da NFC-e, ou o PDF de origem nas compras antigas. */
  source?: string;
  createdAt: number;
  updatedAt: number;
  /** Marca exclusão para a sincronia (tombstone). */
  deleted?: 0 | 1;
}

/** Correção manual de um item: categoria, marca ou o produto ao qual ele pertence.
 *  Chave = `nome|marca` exatamente como veio do cupom. */
export interface Override {
  key: string;
  category?: string;
  brand?: string | null;
  /** Agrupa nomes diferentes que são o mesmo produto (ex.: músculo bovino nas 3 lojas). */
  productKey?: string;
  updatedAt: number;
}

/** Chave/valor para estado do app (versão do seed, preferências, cursor de sincronia). */
export interface Meta {
  key: string;
  value: unknown;
}

export type MercadoDB = Dexie & {
  purchases: EntityTable<Purchase, 'id'>;
  overrides: EntityTable<Override, 'key'>;
  meta: EntityTable<Meta, 'key'>;
};

function createDb(name: string): MercadoDB {
  const instance = new Dexie(name) as MercadoDB;
  instance.version(1).stores({
    purchases: 'id, date, store, updatedAt',
    overrides: 'key, productKey, updatedAt',
    meta: 'key',
  });
  return instance;
}

/**
 * Um banco por conta. Sem isso, duas pessoas usando o mesmo navegador veriam
 * as compras uma da outra — e a ideia é que cada um tenha as suas.
 */
const LEGACY_NAME = 'mercado';
let current: MercadoDB | null = null;
let currentUserId: string | null = null;

function dbNameFor(userId: string): string {
  return `mercado-u-${userId}`;
}

export async function openDbFor(userId: string): Promise<MercadoDB> {
  if (current && currentUserId === userId) return current;
  if (current) current.close();
  current = createDb(dbNameFor(userId));
  currentUserId = userId;
  await current.open();
  await adoptLegacyData(current);
  return current;
}

export function closeDb(): void {
  current?.close();
  current = null;
  currentUserId = null;
}

/**
 * Remove o banco local de uma conta. Usado ao excluir a conta: apagar só na
 * nuvem deixaria o histórico visível neste aparelho até alguém limpar o
 * navegador.
 */
export async function deleteDbFor(userId: string): Promise<void> {
  if (currentUserId === userId) closeDb();
  await Dexie.delete(dbNameFor(userId));
}

/** Acesso ao banco da conta aberta. Só é chamado dentro da área logada. */
export function db(): MercadoDB {
  if (!current) throw new Error('Nenhuma conta aberta.');
  return current;
}

export function hasDb(): boolean {
  return current !== null;
}

/**
 * O app guardava tudo num banco único chamado `mercado`, de antes de existir
 * login. A primeira conta que abrir num navegador com esses dados herda o
 * histórico, em vez de começar do zero e perdê-lo.
 */
async function adoptLegacyData(target: MercadoDB): Promise<void> {
  if ((await target.purchases.count()) > 0) return;

  const exists = (await Dexie.exists(LEGACY_NAME)) && LEGACY_NAME !== target.name;
  if (!exists) return;

  const legacy = createDb(LEGACY_NAME);
  try {
    await legacy.open();
    const [purchases, overrides, meta] = await Promise.all([
      legacy.purchases.toArray(),
      legacy.overrides.toArray(),
      legacy.meta.toArray(),
    ]);
    if (purchases.length === 0) return;

    await target.purchases.bulkPut(purchases);
    await target.overrides.bulkPut(overrides);
    // O estado de sincronia é do banco antigo, não vale para esta conta.
    await target.meta.bulkPut(meta.filter((m) => m.key !== 'syncState'));
  } catch {
    // Herdar é um bônus; se falhar, a conta simplesmente começa vazia.
  } finally {
    legacy.close();
  }
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db().meta.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db().meta.put({ key, value });
}
