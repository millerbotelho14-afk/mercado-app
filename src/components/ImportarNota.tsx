import { useState } from 'react';
import type { NfceReceipt } from '../lib/nfce';
import { normalizeNfceInput } from '../lib/nfce';
import { fmt, toBR } from '../lib/format';

interface Props {
  /**
   * Diz se a nota já está lançada. Confere a chave de acesso e também data +
   * valor, porque as compras que vieram do arquivo antigo não têm chave.
   */
  findDuplicate: (receipt: NfceReceipt) => string | null;
  onLoaded: (receipt: NfceReceipt) => void;
}

export default function ImportarNota({ findDuplicate, onLoaded }: Props) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ receipt: NfceReceipt; reason: string } | null>(null);

  async function handleImport(force = false) {
    setError(null);
    setDuplicate(null);

    const url = normalizeNfceInput(input);
    if (!url) {
      setError(
        'Não reconheci o endereço. Cole o link inteiro do QR Code do cupom, o que começa com https://www.nfce.fazenda.sp.gov.br.',
      );
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/nfce?u=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? `Erro ${response.status}.`);

      const receipt = data as NfceReceipt;
      const reason = force ? null : findDuplicate(receipt);
      if (reason) {
        setDuplicate({ receipt, reason });
        return;
      }
      onLoaded(receipt);
      setInput('');
    } catch (e) {
      const message = (e as Error).message;
      setError(
        message.includes('Failed to fetch')
          ? 'Não consegui falar com o servidor. Sem internet, dá para lançar a compra à mão e importar depois.'
          : message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="ct">
        🧾 Importar nota fiscal
        <span className="sub">traz todos os itens de uma vez</span>
      </div>
      <div className="field">
        <label className="lb" htmlFor="nf-url">
          Link do QR Code do cupom
        </label>
        <input
          id="nf-url"
          className="in"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleImport()}
          placeholder="https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/..."
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {error && <div className="alert-price hi">{error}</div>}

      {duplicate && (
        <div className="alert-price mid">
          {duplicate.reason} — {toBR(duplicate.receipt.date)}, {fmt(duplicate.receipt.totalPaid)}.
          <div className="row-actions" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={() => handleImport(true)}>
              Importar assim mesmo
            </button>
            <button className="btn sm" onClick={() => setDuplicate(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="row-actions" style={{ marginTop: 4 }}>
        <button className="btn pri" onClick={() => handleImport()} disabled={busy || !input.trim()}>
          {busy ? 'Buscando na SEFAZ…' : '⬇ Importar nota'}
        </button>
        <button
          className="btn"
          onClick={async () => {
            try {
              setInput((await navigator.clipboard.readText()).trim());
              setError(null);
            } catch {
              setError('O navegador não deixou ler a área de transferência. Cole com o teclado.');
            }
          }}
        >
          Colar
        </button>
      </div>

      <p className="note">
        No mercado: aponte a câmera do celular para o QR Code do cupom, abra o link, copie o
        endereço e cole aqui. Os itens vêm com categoria preenchida — confira e salve.
      </p>
    </div>
  );
}
