import { useMemo, useState } from 'react';
import type { Purchase } from '../db/schema';
import {
  categoryTotals,
  priceVariations,
  storeComparisons,
  storeStats,
  type MonthBucket,
  type OverrideMap,
  type Product,
} from '../lib/selectors';
import { fmt, monthLabel, toBR } from '../lib/format';
import { categoryIcon } from '../lib/categories';
import { storeColor, storeShort } from '../lib/stores';

interface Props {
  purchases: Purchase[];
  months: MonthBucket[];
  products: Map<string, Product>;
  overrides: OverrideMap;
}

type AnalysisId = 'variacao' | 'lojas' | 'ticket' | 'projecao';

export default function Analises({ purchases, months, products, overrides }: Props) {
  const [open, setOpen] = useState<AnalysisId | null>(null);

  const variations = useMemo(() => priceVariations(products), [products]);
  const comparisons = useMemo(() => storeComparisons(products), [products]);
  const stores = useMemo(() => storeStats(purchases), [purchases]);
  const cats = useMemo(() => categoryTotals(purchases, overrides), [purchases, overrides]);

  if (purchases.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <span className="em">📈</span>
          As análises aparecem quando houver compras registradas.
        </div>
      </div>
    );
  }

  const monthTotals = months.map((m) => m.total);
  const grandTotal = monthTotals.reduce((s, v) => s + v, 0);
  const avgMonth = grandTotal / (monthTotals.length || 1);

  const subiram = variations.filter((v) => v.pct > 0).length;
  const cairam = variations.filter((v) => v.pct < 0).length;
  const maiorDiferenca = comparisons[0];

  const MENU: Array<{
    id: AnalysisId;
    icon: string;
    title: string;
    summary: string;
  }> = [
    {
      id: 'variacao',
      icon: '📈',
      title: 'Variação de preços',
      summary:
        variations.length === 0
          ? 'Ainda sem produto comprado duas vezes'
          : `${subiram} subiram, ${cairam} caíram desde a primeira compra`,
    },
    {
      id: 'lojas',
      icon: '🏪',
      title: 'Onde compensa comprar',
      summary: maiorDiferenca
        ? `${comparisons.length} produtos em 2+ lojas · maior diferença: ${maiorDiferenca.product.name}`
        : 'Compre o mesmo produto em lojas diferentes para comparar',
    },
    {
      id: 'ticket',
      icon: '🧾',
      title: 'Perfil de cada loja',
      summary: `${stores.length} ${stores.length === 1 ? 'loja' : 'lojas'} · maior ticket: ${
        stores[0] ? `${storeShort(stores[0].store)}, ${fmt(stores[0].avgTicket)}` : '—'
      }`,
    },
    {
      id: 'projecao',
      icon: '📅',
      title: 'Média e projeção',
      summary: `${fmt(avgMonth)} por mês · ${fmt(avgMonth * 12)} ao ano`,
    },
  ];

  if (open === null) {
    return (
      <>
        <p style={{ fontSize: 12.5, color: 'var(--mu)', margin: '0 0 12px 4px' }}>
          Escolha o que quer olhar. Cada análise abre sozinha, sem misturar com as outras.
        </p>
        <div className="drill-list">
          {MENU.map((m) => (
            <button key={m.id} className="drill-card" onClick={() => setOpen(m.id)}>
              <span className="drill-ic">{m.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="drill-tt">{m.title}</span>
                <span className="drill-ds">{m.summary}</span>
              </span>
              <span className="drill-go">›</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  const current = MENU.find((m) => m.id === open)!;

  return (
    <>
      <div className="backbar">
        <button className="icon-btn" onClick={() => setOpen(null)} aria-label="Voltar">
          ‹
        </button>
        <h2>
          {current.icon} {current.title}
        </h2>
      </div>

      {open === 'variacao' && <Variacao variations={variations} months={months.length} />}
      {open === 'lojas' && <Lojas comparisons={comparisons} />}
      {open === 'ticket' && <Ticket stores={stores} />}
      {open === 'projecao' && (
        <Projecao months={months} cats={cats} grandTotal={grandTotal} avgMonth={avgMonth} />
      )}
    </>
  );
}

function Variacao({
  variations,
  months,
}: {
  variations: ReturnType<typeof priceVariations>;
  months: number;
}) {
  const ups = variations.filter((v) => v.pct > 0).slice(0, 15);
  const downs = [...variations].filter((v) => v.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 15);

  return (
    <div className="card">
      <div className="sec-title">Subiram</div>
      <Tabela rows={ups} direction="up" />
      <div className="sec-title">Caíram</div>
      <Tabela rows={downs} direction="down" />
      <p className="note">
        Comparação sempre pelo preço unitário — nos itens vendidos a peso, o preço por quilo.
        Baseado em {months} {months === 1 ? 'mês' : 'meses'} de dados.
      </p>
    </div>
  );
}

function Tabela({
  rows,
  direction,
}: {
  rows: ReturnType<typeof priceVariations>;
  direction: 'up' | 'down';
}) {
  if (rows.length === 0) {
    return (
      <p style={{ color: 'var(--mu)', fontSize: 12, margin: '0 0 4px' }}>
        Sem variações significativas.
      </p>
    );
  }
  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th className="num">1ª compra</th>
            <th className="num">Última</th>
            <th className="num">Variação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.product.productKey}>
              <td>
                <div style={{ fontWeight: 500 }}>{v.product.name}</div>
                <div style={{ fontSize: 10, color: 'var(--mu)' }}>
                  {v.product.category}
                  {v.product.weighed ? ' · preço/kg' : ''}
                </div>
              </td>
              <td className="num">
                {fmt(v.first)}
                <div style={{ fontSize: 10, color: 'var(--mu)' }}>{toBR(v.firstDate)}</div>
              </td>
              <td className="num">
                {fmt(v.last)}
                <div style={{ fontSize: 10, color: 'var(--mu)' }}>{toBR(v.lastDate)}</div>
              </td>
              <td className="num">
                <span className={direction === 'up' ? 'up' : 'dn'}>
                  {direction === 'up' ? '↑ +' : '↓ '}
                  {Math.abs(v.pct).toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Lojas({ comparisons }: { comparisons: ReturnType<typeof storeComparisons> }) {
  if (comparisons.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <span className="em">🏪</span>
          Ainda não há produtos comprados em lojas diferentes. Conforme o histórico crescer, esta
          comparação fica mais rica.
        </div>
      </div>
    );
  }

  const economia = comparisons.reduce((sum, c) => sum + c.spread, 0);

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <div>
            <div className="stat-big">{comparisons.length}</div>
            <div className="stat-big-l">produtos comparáveis</div>
          </div>
          <div>
            <div className="stat-big">{fmt(economia)}</div>
            <div className="stat-big-l">diferença somada por unidade</div>
          </div>
        </div>
        <p className="note">
          Quanto você deixaria de gastar, por unidade de cada produto, comprando sempre na loja
          mais barata. Não é economia garantida — depende de a loja ter o item no dia.
        </p>
      </div>

      <div className="card">
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th className="num">Mais barato</th>
                <th className="num">Mais caro</th>
                <th className="num">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c) => {
                const sorted = Object.entries(c.avgByStore).sort((a, b) => a[1] - b[1]);
                const [cheapStore, cheapPrice] = sorted[0];
                const [dearStore, dearPrice] = sorted[sorted.length - 1];
                return (
                  <tr key={c.product.productKey}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.product.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--mu)' }}>
                        {c.product.category}
                        {c.product.weighed ? ' · preço/kg' : ''}
                      </div>
                    </td>
                    <td className="num">
                      <div style={{ fontWeight: 700, color: 'var(--g)' }}>{fmt(cheapPrice)}</div>
                      <span className="sc" style={{ background: storeColor(cheapStore) }}>
                        {storeShort(cheapStore)}
                      </span>
                    </td>
                    <td className="num">
                      <div>{fmt(dearPrice)}</div>
                      <span className="sc" style={{ background: storeColor(dearStore) }}>
                        {storeShort(dearStore)}
                      </span>
                    </td>
                    <td className="num">
                      <span className="up">+{c.spreadPct.toFixed(0)}%</span>
                      <div style={{ fontSize: 10, color: 'var(--mu)' }}>{fmt(c.spread)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Ticket({ stores }: { stores: ReturnType<typeof storeStats> }) {
  return (
    <div className="card">
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Loja</th>
              <th className="num">Visitas</th>
              <th className="num">Total</th>
              <th className="num">Ticket médio</th>
              <th className="num">Itens/compra</th>
              <th className="num">Custo/item</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.store}>
                <td>
                  <span className="sc" style={{ background: storeColor(s.store) }}>
                    {storeShort(s.store)}
                  </span>
                </td>
                <td className="num">{s.visits}</td>
                <td className="num">{fmt(s.total)}</td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {fmt(s.avgTicket)}
                </td>
                <td className="num">{s.avgItems.toFixed(0)}</td>
                <td className="num" style={{ fontWeight: 600 }}>
                  {fmt(s.costPerItem)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Custo/item = total gasto na loja ÷ itens comprados. Serve para comparar o perfil de cada
        mercado, não a qualidade do preço — atacado costuma ter itens maiores.
      </p>
    </div>
  );
}

function Projecao({
  months,
  cats,
  grandTotal,
  avgMonth,
}: {
  months: MonthBucket[];
  cats: ReturnType<typeof categoryTotals>;
  grandTotal: number;
  avgMonth: number;
}) {
  const totals = months.map((m) => m.total);
  const peak = Math.max(...totals, 0);
  const peakMonth = months.find((m) => m.total === peak);
  const avgWithoutPeak = totals.length > 1 ? (grandTotal - peak) / (totals.length - 1) : avgMonth;

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div className="stat-big">{fmt(avgMonth)}</div>
            <div className="stat-big-l">Média mensal</div>
          </div>
          <div>
            <div className="stat-big">{fmt(avgMonth * 12)}</div>
            <div className="stat-big-l">Projeção anual</div>
          </div>
          <div>
            <div className="stat-big">{fmt(grandTotal)}</div>
            <div className="stat-big-l">
              Gasto em {months.length} {months.length === 1 ? 'mês' : 'meses'}
            </div>
          </div>
        </div>
        {months.length > 1 && peakMonth && (
          <p style={{ fontSize: 12, color: 'var(--mu)', margin: 0 }}>
            O mês mais pesado foi <b>{monthLabel(peakMonth.key)}</b> ({fmt(peak)}), o que puxa a
            média para cima. Sem ele: <b>{fmt(avgWithoutPeak)}</b>/mês, ou{' '}
            {fmt(avgWithoutPeak * 12)} no ano.
          </p>
        )}
      </div>

      <div className="card">
        <div className="ct">Por categoria</div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th className="num">Média/mês</th>
                <th className="num">Projeção anual</th>
                <th className="num">% do total</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => {
                const perMonth = c.total / (months.length || 1);
                return (
                  <tr key={c.category}>
                    <td>
                      {categoryIcon(c.category)} {c.category}
                    </td>
                    <td className="num">{fmt(perMonth)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {fmt(perMonth * 12)}
                    </td>
                    <td className="num" style={{ color: 'var(--mu)' }}>
                      {c.pct.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
