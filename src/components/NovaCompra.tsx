import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Item, Purchase } from '../db/schema';
import { db, getMeta, setMeta } from '../db/schema';
import { knownItems, type KnownItem, type Product } from '../lib/selectors';
import { savePurchase } from '../db/repo';
import { canonicalUnit, fmt, todayISO, UNITS } from '../lib/format';
import { matchesQuery, searchText } from '../lib/normalize';
import { ALL_CATEGORIES, categoryIcon } from '../lib/categories';
import { buildCategoryIndex, guessCategory } from '../lib/autocat';
import { guessStore } from '../lib/stores';
import type { NfceReceipt } from '../lib/nfce';
import ImportarNota from './ImportarNota';

interface Props {
  purchases: Purchase[];
  products: Map<string, Product>;
  toast: (m: string) => void;
  onSaved: () => void;
}

interface Draft {
  uid: number;
  name: string;
  brand: string;
  category: string;
  qty: string;
  unit: string;
  unitPrice: string;
  /** Preenchido quando o item veio do autocomplete — habilita o alerta de preço. */
  known?: KnownItem;
  /** De onde saiu a categoria, quando o item veio de uma nota importada. */
  catSource?: 'historico' | 'regra' | 'padrao';
  /**
   * Total da linha como veio na nota. Em item por peso, `qtd × preço/kg` não
   * fecha com o cupom (0,282 × 29,99 = 8,457, e a nota cobrou 8,46), então o
   * valor da nota manda — enquanto você não mexer na quantidade ou no preço.
   */
  nfTotal?: number;
}

/** Total da linha: o da nota quando existe, senão o cálculo. */
function lineTotalOf(row: Draft): number {
  if (row.nfTotal !== undefined) return row.nfTotal;
  const qty = parseFloat(row.qty.replace(',', '.')) || 0;
  const price = parseFloat(row.unitPrice.replace(',', '.')) || 0;
  return qty * price;
}

let uidSeq = 0;
function emptyRow(): Draft {
  return {
    uid: ++uidSeq,
    name: '',
    brand: '',
    category: 'Outros',
    qty: '1',
    unit: 'UND',
    unitPrice: '',
  };
}

export default function NovaCompra({ purchases, products, toast, onSaved }: Props) {
  const [store, setStore] = useState('');
  const [date, setDate] = useState(todayISO());
  const [discount, setDiscount] = useState('0');
  const [rows, setRows] = useState<Draft[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  /** Origem da compra quando veio de uma nota: chave de acesso + CNPJ. */
  const [nfce, setNfce] = useState<{ chave: string; cnpj: string } | null>(null);

  const stores = useMemo(
    () => [...new Set(purchases.map((p) => p.store))].sort(),
    [purchases],
  );
  const catalog = useMemo(() => knownItems(products), [products]);
  const categoryIndex = useMemo(() => buildCategoryIndex(products), [products]);

  /**
   * Duas checagens: a chave de acesso, e — para as compras que vieram do
   * arquivo antigo e não têm chave — a coincidência de data e valor.
   */
  const findDuplicate = useMemo(
    () => (receipt: NfceReceipt) => {
      if (purchases.some((p) => p.source === receipt.chave)) {
        return 'Esta nota já foi importada';
      }
      const similar = purchases.find(
        (p) => p.date === receipt.date && Math.abs(p.total_paid - receipt.totalPaid) < 0.01,
      );
      return similar ? `Já existe uma compra igual no ${similar.store}` : null;
    },
    [purchases],
  );
  const storeAliases =
    useLiveQuery(() => db().meta.get('storeAliases').then((r) => (r?.value ?? {}) as Record<string, string>), [], {}) ?? {};

  /** Uma nota inteira vira o formulário preenchido: você confere e salva. */
  function loadReceipt(receipt: NfceReceipt) {
    setStore(guessStore(receipt.cnpj, receipt.razaoSocial, stores, storeAliases));
    setDate(receipt.date || todayISO());
    setDiscount(receipt.discount ? String(receipt.discount).replace('.', ',') : '0');
    setNfce({ chave: receipt.chave, cnpj: receipt.cnpj });
    setRows(
      receipt.items.map((item) => {
        const guess = guessCategory(item.name, categoryIndex);
        return {
          uid: ++uidSeq,
          name: item.name,
          brand: '',
          category: guess.category,
          catSource: guess.source,
          qty: String(item.qty).replace('.', ','),
          unit: canonicalUnit(item.unit),
          unitPrice: item.unitPrice.toFixed(2).replace('.', ','),
          nfTotal: item.total,
        };
      }),
    );
    const semCategoria = receipt.items.filter(
      (i) => guessCategory(i.name, categoryIndex).source === 'padrao',
    ).length;
    toast(
      `${receipt.items.length} itens importados` +
        (semCategoria ? ` · ${semCategoria} sem categoria, confira` : ''),
    );
  }

  const total = useMemo(() => rows.reduce((sum, r) => sum + lineTotalOf(r), 0), [rows]);

  const discountNum = parseFloat(discount.replace(',', '.')) || 0;
  const filledRows = rows.filter((r) => r.name.trim() && parseFloat(r.unitPrice.replace(',', '.')));
  const canSave = store.trim().length > 0 && date && filledRows.length > 0 && !saving;

  function update(uid: number, patch: Partial<Draft>) {
    setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  }

  function applyKnown(uid: number, k: KnownItem) {
    update(uid, {
      name: k.name,
      brand: k.brand ?? '',
      category: k.category,
      unit: canonicalUnit(k.unit),
      unitPrice: k.lastPrice.toFixed(2).replace('.', ','),
      known: k,
    });
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const items: Item[] = filledRows.map((r) => ({
        name: r.name.trim(),
        brand: r.brand.trim() || null,
        category: r.category,
        qty: parseFloat(r.qty.replace(',', '.')) || 0,
        unit: r.unit,
        unit_price: parseFloat(r.unitPrice.replace(',', '.')) || 0,
        total: +lineTotalOf(r).toFixed(2),
      }));
      const gross = +items.reduce((s, i) => s + i.total, 0).toFixed(2);
      await savePurchase({
        store: store.trim(),
        date,
        total_gross: gross,
        discount: discountNum,
        total_paid: +(gross - discountNum).toFixed(2),
        items,
        // A chave de acesso identifica a nota — é por ela que uma reimportação
        // é reconhecida como repetida.
        source: nfce?.chave,
      });
      // Aprende o apelido que você deu à loja para a próxima nota do mesmo CNPJ.
      if (nfce?.cnpj) {
        const aliases = await getMeta<Record<string, string>>('storeAliases', {});
        await setMeta('storeAliases', { ...aliases, [nfce.cnpj]: store.trim() });
      }
      toast(`Compra salva: ${items.length} itens, ${fmt(gross - discountNum)}`);
      setNfce(null);
      setStore('');
      setDate(todayISO());
      setDiscount('0');
      setRows([emptyRow()]);
      onSaved();
    } catch (err) {
      toast(`Erro ao salvar: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ImportarNota findDuplicate={findDuplicate} onLoaded={loadReceipt} />

      <div className="card">
        <div className="ct">
          Dados da compra
          {nfce && <span className="sub">nota {nfce.chave.slice(-8)} importada</span>}
        </div>
        <div className="frow c3">
          <div className="field">
            <label className="lb" htmlFor="nv-store">
              Loja / mercado
            </label>
            <input
              id="nv-store"
              className="in"
              list="store-list"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              placeholder="Atacadão, Porto Seguro…"
            />
            <datalist id="store-list">
              {stores.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label className="lb" htmlFor="nv-date">
              Data
            </label>
            <input
              id="nv-date"
              className="in"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="lb" htmlFor="nv-disc">
              Desconto (R$)
            </label>
            <input
              id="nv-disc"
              className="in"
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="ct">
          Itens
          <span className="sub">{filledRows.length} preenchido(s)</span>
        </div>

        {rows.map((row) => (
          <ItemRow
            key={row.uid}
            row={row}
            catalog={catalog}
            onChange={(patch) => update(row.uid, patch)}
            onPick={(k) => applyKnown(row.uid, k)}
            onRemove={() => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.uid !== row.uid) : rs))}
            canRemove={rows.length > 1}
          />
        ))}

        <button className="btn" style={{ width: '100%' }} onClick={() => setRows((rs) => [...rs, emptyRow()])}>
          + Adicionar item
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--mu)' }}>
              Total {discountNum > 0 && `(− ${fmt(discountNum)} de desconto)`}
            </div>
            <div className="stat-big">{fmt(Math.max(0, total - discountNum))}</div>
          </div>
          <div className="row-actions">
            <button
              className="btn"
              onClick={() => {
                setRows([emptyRow()]);
                setDiscount('0');
                setNfce(null);
              }}
            >
              ✕ Limpar
            </button>
            <button className="btn pri" onClick={handleSave} disabled={!canSave}>
              {saving ? 'Salvando…' : '✓ Salvar compra'}
            </button>
          </div>
        </div>
        {!canSave && !saving && (
          <p className="note" style={{ marginTop: 8 }}>
            {!store.trim()
              ? 'Informe a loja para salvar.'
              : filledRows.length === 0
                ? 'Cada item precisa de nome e preço unitário.'
                : ''}
          </p>
        )}
      </div>
    </>
  );
}

function ItemRow({
  row,
  catalog,
  onChange,
  onPick,
  onRemove,
  canRemove,
}: {
  row: Draft;
  catalog: KnownItem[];
  onChange: (patch: Partial<Draft>) => void;
  onPick: (k: KnownItem) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<number | undefined>(undefined);

  const suggestions = useMemo(() => {
    const q = row.name.trim();
    if (q.length < 2) return [];
    return catalog
      .filter((k) => matchesQuery(searchText(k.name, k.brand, k.category), k.name, q))
      .slice(0, 8);
  }, [catalog, row.name]);

  const price = parseFloat(row.unitPrice.replace(',', '.')) || 0;
  const lineTotal = lineTotalOf(row);

  // Alerta só faz sentido para item já comprado antes e com preço digitado.
  const alert = useMemo(() => {
    const k = row.known;
    if (!k || !price || k.timesBought < 1) return null;
    const diff = ((price - k.avgPrice) / k.avgPrice) * 100;
    if (price > k.maxPrice) {
      return {
        cls: 'hi',
        text: `Mais caro que qualquer compra anterior. Máximo era ${fmt(k.maxPrice)}${k.weighed ? '/kg' : ''}.`,
      };
    }
    if (price <= k.minPrice) {
      return {
        cls: 'lo',
        text: `Melhor preço do histórico — o menor até agora era ${fmt(k.minPrice)}${k.weighed ? '/kg' : ''}.`,
      };
    }
    if (diff > 10) {
      return {
        cls: 'hi',
        text: `${diff.toFixed(0)}% acima da média (${fmt(k.avgPrice)}). Menor preço: ${fmt(k.minPrice)} no ${k.lastStore}.`,
      };
    }
    if (diff < -10) {
      return { cls: 'lo', text: `${Math.abs(diff).toFixed(0)}% abaixo da média (${fmt(k.avgPrice)}).` };
    }
    return { cls: 'mid', text: `Na média do histórico (${fmt(k.avgPrice)}, ${k.timesBought} compras).` };
  }, [row.known, price]);

  return (
    <div className="item-card">
      <div className="item-head">
        <div className="ac-wrap" style={{ flex: 1, minWidth: 0 }}>
          <input
            className="in"
            value={row.name}
            placeholder="Nome do item"
            autoComplete="off"
            onFocus={() => setFocused(true)}
            onBlur={() => {
              // Espera o clique na sugestão acontecer antes de fechar a lista.
              blurTimer.current = window.setTimeout(() => setFocused(false), 150);
            }}
            onChange={(e) => onChange({ name: e.target.value, known: undefined })}
          />
          {focused && suggestions.length > 0 && (
            <div className="ac">
              {suggestions.map((k) => (
                <button
                  key={k.key + k.lastDate}
                  className="ac-item"
                  onMouseDown={() => {
                    window.clearTimeout(blurTimer.current);
                    onPick(k);
                    setFocused(false);
                  }}
                >
                  <div className="ac-n">{k.name}</div>
                  <div className="ac-m">
                    {categoryIcon(k.category)} {k.category}
                    {k.brand && ` · ${k.brand}`} · último {fmt(k.lastPrice)}
                    {k.weighed ? '/kg' : ''} no {k.lastStore}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="item-total">{fmt(lineTotal)}</div>
        {canRemove && (
          <button
            className="btn sm"
            onClick={onRemove}
            aria-label="Remover item"
            style={{ padding: '5px 9px' }}
          >
            ✕
          </button>
        )}
      </div>

      <div className="mini-grid">
        <div>
          <label className="lb">Qtde</label>
          <input
            className="in"
            inputMode="decimal"
            value={row.qty}
            // Mexeu na quantidade: o total da nota não vale mais, volta a calcular.
            onChange={(e) => onChange({ qty: e.target.value, nfTotal: undefined })}
          />
        </div>
        <div>
          <label className="lb">Unid.</label>
          <select className="in" value={row.unit} onChange={(e) => onChange({ unit: e.target.value })}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lb">{row.unit.startsWith('KG') ? 'Preço/kg' : 'Preço unit.'}</label>
          <input
            className="in"
            inputMode="decimal"
            value={row.unitPrice}
            placeholder="0,00"
            onChange={(e) => onChange({ unitPrice: e.target.value, nfTotal: undefined })}
          />
        </div>
      </div>

      <div className="mini-grid" style={{ marginTop: 8, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <label className="lb">Marca</label>
          <input
            className="in"
            value={row.brand}
            placeholder="opcional"
            onChange={(e) => onChange({ brand: e.target.value })}
          />
        </div>
        <div>
          <label className="lb">
            Categoria
            {row.catSource === 'padrao' && (
              <span className="b br" style={{ marginLeft: 6 }}>
                confira
              </span>
            )}
            {row.catSource === 'regra' && (
              <span className="b by" style={{ marginLeft: 6 }}>
                palpite
              </span>
            )}
          </label>
          <select
            className="in"
            value={row.category}
            onChange={(e) => onChange({ category: e.target.value, catSource: undefined })}
          >
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {alert && <div className={`alert-price ${alert.cls}`}>{alert.text}</div>}
    </div>
  );
}
