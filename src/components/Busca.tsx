import { useMemo, useState } from 'react';
import type { Product } from '../lib/selectors';
import { matchesQuery } from '../lib/normalize';
import { fmt, fmtNum, toBR } from '../lib/format';
import { categoryIcon } from '../lib/categories';
import { storeColor, storeShort } from '../lib/stores';

interface Props {
  products: Map<string, Product>;
}

export default function Busca({ products }: Props) {
  const [query, setQuery] = useState('');

  const hits = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return [...products.values()]
      .filter((p) => matchesQuery(p.search, `${p.name} ${p.variants.join(' ')}`, q))
      .sort((a, b) => b.entries.length - a.entries.length)
      .slice(0, 60);
  }, [products, query]);

  return (
    <>
      <div className="card">
        <div className="ct">Buscar produto</div>
        <div className="sw">
          <span className="si">🔍</span>
          <input
            className="in"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="queijo, frango, leite, amaciante, biscoito…"
            autoComplete="off"
          />
        </div>
        <div className="note">
          Entende as abreviações do cupom: procurar por <b>queijo</b> encontra “QJO MUSS.CEDRENSE”.
        </div>
      </div>

      {query.trim().length < 2 ? (
        <div className="card">
          <div className="empty">
            <span className="em">🛒</span>
            Digite ao menos 2 letras para ver o histórico de preços.
          </div>
        </div>
      ) : hits.length === 0 ? (
        <div className="card">
          <div className="empty">
            <span className="em">😕</span>
            Nada encontrado para “{query}”.
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: 'var(--mu)', margin: '0 0 10px 4px' }}>
            {hits.length} produto(s)
          </p>
          {hits.map((p) => (
            <ProductCard key={p.productKey} product={p} />
          ))}
        </>
      )}
    </>
  );
}

function ProductCard({ product }: { product: Product }) {
  const prices = product.entries.map((e) => e.unitPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const latest = prices[prices.length - 1];
  const first = prices[0];
  const unitNote = product.weighed ? ' por kg' : '';
  const multi = product.entries.length > 1;

  let position = null;
  if (multi) {
    if (latest <= min) position = <span className="b bg">✓ No menor preço{unitNote}</span>;
    else if (latest >= max) position = <span className="b br">⚠ No maior preço{unitNote}</span>;
    else position = <span className="b by">≈ Preço intermediário</span>;
  }

  let variation = null;
  let variationNote = '';
  if (multi && first > 0) {
    const pct = ((latest - first) / first) * 100;
    if (pct > 5) {
      variation = <span className="b br">↑ +{pct.toFixed(0)}%</span>;
      variationNote = `De ${fmt(first)} para ${fmt(latest)}${unitNote} desde ${toBR(product.entries[0].date)}`;
    } else if (pct < -5) {
      variation = <span className="b bg">↓ {pct.toFixed(0)}%</span>;
      variationNote = `De ${fmt(first)} para ${fmt(latest)}${unitNote} desde ${toBR(product.entries[0].date)}`;
    } else {
      variation = <span className="b bk">→ Estável{unitNote}</span>;
    }
  }

  const avg = prices.reduce((s, v) => s + v, 0) / prices.length;

  return (
    <div className="ic-item">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</div>
          <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>
            {product.brands.length > 0 && `${product.brands.join(', ')} · `}
            <span className="b bk">
              {categoryIcon(product.category)} {product.category}
            </span>
          </div>
          {product.variants.length > 1 && (
            <div style={{ fontSize: 10.5, color: 'var(--mu)', marginTop: 3 }}>
              Agrupa: {product.variants.join(' · ')}
            </div>
          )}
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {position}
            {variation}
          </div>
          {variationNote && (
            <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 4 }}>{variationNote}</div>
          )}
        </div>
        {multi && (
          <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--mu)' }}>
            Média {fmt(avg)}
            {unitNote}
            <br />
            {product.entries.length} compras
          </div>
        )}
      </div>

      <div className="ph">
        {product.entries.map((e, i) => {
          const isLow = multi && e.unitPrice === min;
          const isHigh = multi && e.unitPrice === max;
          const isLast = i === product.entries.length - 1;
          const cls = isLow ? 'low' : isHigh ? 'high' : isLast ? 'lat' : '';
          return (
            <div key={`${e.purchaseId}-${e.rawName}-${i}`} className={`pp ${cls}`}>
              <div className="ppv">{fmt(e.unitPrice)}</div>
              <div className="ppm">
                {product.weighed ? `${fmtNum(e.qty, 3)} kg · ${fmt(e.total)}` : `${fmtNum(e.qty, 0)}× · ${fmt(e.total)}`}
                <br />
                {toBR(e.date).slice(0, 5)}
                <br />
                <span style={{ color: storeColor(e.store), fontWeight: 600 }}>
                  {storeShort(e.store)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
