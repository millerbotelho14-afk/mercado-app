import { useState } from 'react';
import type { Purchase } from '../db/schema';
import { deletePurchase } from '../db/repo';
import { effectiveItem, type OverrideMap } from '../lib/selectors';
import { fmt, toBR } from '../lib/format';
import { categoryIcon } from '../lib/categories';
import { storeColor, storeShort } from '../lib/stores';

interface Props {
  purchases: Purchase[];
  overrides: OverrideMap;
  toast: (m: string) => void;
}

export default function Historico({ purchases, overrides, toast }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  /** Exclusão em dois toques, em vez de um confirm() nativo. */
  const [confirmId, setConfirmId] = useState<string | null>(null);



  async function handleDelete(p: Purchase) {
    if (confirmId !== p.id) {
      setConfirmId(p.id);
      return;
    }
    await deletePurchase(p.id);
    setConfirmId(null);
    toast(`Compra de ${toBR(p.date)} excluída`);
  }

  return (
    <>
      <div className="card">
        <div className="ct">
          Compras registradas
          <span className="sub">{purchases.length} no total</span>
        </div>
        {purchases.length === 0 ? (
          <div className="empty">
            <span className="em">🧾</span>
            Nenhuma compra ainda.
          </div>
        ) : (
          [...purchases].reverse().map((p) => (
            <div key={p.id} className="acc">
              <button className="acc-h" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                <span className="sc" style={{ background: storeColor(p.store) }}>
                  {storeShort(p.store)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{p.store}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--mu)' }}>
                    {toBR(p.date)} · {p.items.length} itens
                    {p.discount > 0 && ` · ${fmt(p.discount)} de desconto`}
                  </div>
                </span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(p.total_paid)}
                </span>
                <span style={{ color: 'var(--mu)', fontSize: 11 }}>
                  {openId === p.id ? '▲' : '▼'}
                </span>
              </button>
              {openId === p.id && (
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
                        {p.items.map((raw, i) => {
                          const it = effectiveItem(raw, overrides);
                          return (
                            <tr key={`${it.key}-${i}`}>
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
                                {it.qty.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}{' '}
                                {it.unit}
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
                  <div className="row-actions" style={{ marginTop: 10 }}>
                    <button className="btn sm danger" onClick={() => handleDelete(p)}>
                      {confirmId === p.id ? 'Confirmar exclusão' : 'Excluir compra'}
                    </button>
                    {confirmId === p.id && (
                      <button className="btn sm" onClick={() => setConfirmId(null)}>
                        Cancelar
                      </button>
                    )}
                    {p.source && (
                      <span style={{ fontSize: 11, color: 'var(--mu)', alignSelf: 'center' }}>
                        origem: {p.source}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
