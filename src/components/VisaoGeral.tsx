import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Purchase } from '../db/schema';
import { categoryTotals, effectiveItem, itemKey, type MonthBucket, type OverrideMap } from '../lib/selectors';
import { fmt, fmtShort, monthLabel, toBR } from '../lib/format';
import { ALL_CATEGORIES, categoryIcon } from '../lib/categories';
import { storeColor, storeShort } from '../lib/stores';
import { setOverride } from '../db/repo';

interface Props {
  purchases: Purchase[];
  months: MonthBucket[];
  overrides: OverrideMap;
  toast: (m: string) => void;
}

export default function VisaoGeral({ purchases, months, overrides, toast }: Props) {
  const [selMonth, setSelMonth] = useState<string>('all');
  const [openCat, setOpenCat] = useState<string | null>(null);

  const filtered = useMemo(
    () => (selMonth === 'all' ? purchases : purchases.filter((p) => p.date.startsWith(selMonth))),
    [purchases, selMonth],
  );

  const stats = useMemo(() => {
    let total = 0;
    let discount = 0;
    let items = 0;
    for (const p of filtered) {
      total += p.total_paid;
      discount += p.discount;
      items += p.items.length;
    }
    return { total, discount, items, count: filtered.length };
  }, [filtered]);

  const monthChart = useMemo(
    () => months.map((m) => ({ name: monthLabel(m.key), key: m.key, total: +m.total.toFixed(2) })),
    [months],
  );

  const storeChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filtered) map.set(p.store, (map.get(p.store) ?? 0) + p.total_paid);
    return [...map.entries()]
      .map(([name, value]) => ({ name, short: storeShort(name), value: +value.toFixed(2) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const cats = useMemo(() => categoryTotals(filtered, overrides), [filtered, overrides]);
  const maxCat = cats[0]?.total ?? 1;

  if (purchases.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <span className="em">🛒</span>
          Nenhuma compra ainda. Vá em <strong>Nova</strong> e cole o link do QR Code de um cupom —
          a nota entra inteira. Se você já tem um backup, importe o JSON em <strong>Conta</strong>.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mpills">
        <button
          className={`mp${selMonth === 'all' ? ' active' : ''}`}
          onClick={() => setSelMonth('all')}
        >
          Todos
        </button>
        {months.map((m) => (
          <button
            key={m.key}
            className={`mp${selMonth === m.key ? ' active' : ''}`}
            onClick={() => setSelMonth(m.key)}
          >
            {monthLabel(m.key)}
          </button>
        ))}
      </div>

      <div className="stats-row">
        <div className="ss">
          <div className="ss-v">{fmt(stats.total)}</div>
          <div className="ss-l">{selMonth === 'all' ? 'Total geral' : monthLabel(selMonth)}</div>
        </div>
        <div className="ss">
          <div className="ss-v">{stats.count}</div>
          <div className="ss-l">Compras</div>
        </div>
        <div className="ss">
          <div className="ss-v">{stats.items}</div>
          <div className="ss-l">Itens</div>
        </div>
        <div className="ss">
          <div className="ss-v" style={{ color: stats.discount > 0 ? 'var(--g)' : undefined }}>
            {fmt(stats.discount)}
          </div>
          <div className="ss-l">Economia</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="ct">
            Gasto por mês
            <span className="sub">clique para filtrar</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthChart} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--mu)' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--mu)' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                  tickFormatter={(v) => fmtShort(Number(v))}
                />
                <Tooltip
                  formatter={(v) => fmt(Number(v))}
                  labelStyle={{ fontWeight: 600, color: 'var(--tx)' }}
                  contentStyle={{
                    borderRadius: 10,
                    fontSize: 12,
                    border: '1px solid var(--line)',
                    background: 'var(--card)',
                    color: 'var(--tx)',
                  }}
                />
                <Bar
                  dataKey="total"
                  radius={[6, 6, 0, 0]}
                  onClick={(d: any) => setSelMonth(d.key === selMonth ? 'all' : d.key)}
                  cursor="pointer"
                  // Sem isto as barras ficam com a geometria da primeira medição
                  // do container e não reposicionam quando ele cresce.
                  isAnimationActive={false}
                >
                  {monthChart.map((m) => (
                    <Cell
                      key={m.key}
                      fill={selMonth === 'all' || selMonth === m.key ? 'var(--g)' : 'var(--line)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="ct">
            Por loja
            <span className="sub">{selMonth === 'all' ? 'todo o período' : monthLabel(selMonth)}</span>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={storeChart}
                  dataKey="value"
                  nameKey="short"
                  innerRadius="45%"
                  outerRadius="75%"
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {storeChart.map((s) => (
                    <Cell key={s.name} fill={storeColor(s.name)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, _n, p: any) => [fmt(Number(v)), p?.payload?.name]}
                  contentStyle={{
                    borderRadius: 10,
                    fontSize: 12,
                    border: '1px solid var(--line)',
                    background: 'var(--card)',
                    color: 'var(--tx)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {storeChart.map((s) => (
              <span key={s.name} className="sc" style={{ background: storeColor(s.name) }}>
                {s.short} · {fmt(s.value)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="ct">
          Por categoria
          <span className="sub">toque para ver os itens</span>
        </div>
        {cats.map((c) => (
          <div key={c.category}>
            <button className="cat-row" onClick={() => setOpenCat(openCat === c.category ? null : c.category)}>
              <span className="cat-ic">{categoryIcon(c.category)}</span>
              <span className="cat-name">
                {c.category}
                <div className="cat-bar">
                  <div
                    className="cat-fill"
                    style={{ width: `${(c.total / maxCat) * 100}%`, background: 'var(--g)' }}
                  />
                </div>
              </span>
              <span className="cat-val">
                {fmt(c.total)}
                <div className="cat-pct">
                  {c.pct.toFixed(0)}% · {c.count} itens
                </div>
              </span>
            </button>
            {openCat === c.category && (
              <CategoryItems
                purchases={filtered}
                overrides={overrides}
                category={c.category}
                toast={toast}
              />
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="ct">
          Compras do período
          <span className="sub">{filtered.length} registro(s)</span>
        </div>
        {[...filtered].reverse().map((p) => (
          <div key={p.id} className="acc">
            <PurchaseSummary purchase={p} overrides={overrides} />
          </div>
        ))}
      </div>
    </>
  );
}

/** Itens da categoria no período, agregados por produto, com correção de categoria inline. */
function CategoryItems({
  purchases,
  overrides,
  category,
  toast,
}: {
  purchases: Purchase[];
  overrides: OverrideMap;
  category: string;
  toast: (m: string) => void;
}) {
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; brand: string | null; total: number; qty: number }>();
    for (const p of purchases) {
      for (const raw of p.items) {
        const it = effectiveItem(raw, overrides);
        if (it.category !== category) continue;
        const r = map.get(it.key) ?? { name: it.name, brand: it.brand, total: 0, qty: 0 };
        r.total += it.total;
        r.qty += it.qty;
        map.set(it.key, r);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [purchases, overrides, category]);

  async function recategorize(key: string, name: string, next: string) {
    if (!next || next === category) return;
    await setOverride(key, { category: next });
    toast(`${name} → ${next}`);
  }

  return (
    <div className="drill">
      <div className="tw">
        <table>
          <tbody>
            {rows.map(([key, r]) => (
              <tr key={key}>
                <td>
                  <div style={{ fontWeight: 500 }}>{r.name}</div>
                  {r.brand && <div style={{ fontSize: 10.5, color: 'var(--mu)' }}>{r.brand}</div>}
                </td>
                <td style={{ width: 150 }}>
                  <select
                    className="in"
                    style={{ padding: '4px 6px', fontSize: 11 }}
                    value={category}
                    onChange={(e) => recategorize(key, r.name, e.target.value)}
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="num" style={{ fontWeight: 600 }}>
                  {fmt(r.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseSummary({ purchase, overrides }: { purchase: Purchase; overrides: OverrideMap }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="acc-h" onClick={() => setOpen(!open)}>
        <span className="sc" style={{ background: storeColor(purchase.store) }}>
          {storeShort(purchase.store)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{toBR(purchase.date)}</div>
          <div style={{ fontSize: 10.5, color: 'var(--mu)' }}>{purchase.items.length} itens</div>
        </span>
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {fmt(purchase.total_paid)}
        </span>
        <span style={{ color: 'var(--mu)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="acc-b">
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Categoria</th>
                  <th className="num">Qtd</th>
                  <th className="num">Unit.</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((raw, i) => {
                  const it = effectiveItem(raw, overrides);
                  return (
                    <tr key={`${itemKey(raw.name, raw.brand)}-${i}`}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{it.name}</div>
                        {it.brand && (
                          <div style={{ fontSize: 10, color: 'var(--mu)' }}>{it.brand}</div>
                        )}
                      </td>
                      <td>
                        <span className="b bk">
                          {categoryIcon(it.category)} {it.category}
                        </span>
                      </td>
                      <td className="num">
                        {it.qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {it.unit}
                      </td>
                      <td className="num">{fmt(it.unit_price)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>
                        {fmt(it.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
