/**
 * Leitura da NFC-e pelo link do QR Code do cupom.
 *
 * A página de consulta da SEFAZ-SP vem pronta do servidor (sem JavaScript) e
 * usa um HTML de classes fixas, então dá para ler direto. O que ela NÃO permite
 * é ser buscada pelo navegador: não manda cabeçalho CORS. Por isso a busca
 * acontece no servidor (`/api/nfce`) e só o resultado já limpo chega ao app.
 */

export interface NfceItem {
  name: string;
  code: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface NfceReceipt {
  chave: string;
  cnpj: string;
  /** Razão social como está na nota. O apelido da loja é escolhido no app. */
  razaoSocial: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  totalPaid: number;
  discount: number;
  items: NfceItem[];
}

/** Só a SEFAZ paulista. Sem isto, `/api/nfce` viraria um proxy aberto. */
const ALLOWED_HOST = /(^|\.)fazenda\.sp\.gov\.br$/i;

export function isAllowedNfceUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && ALLOWED_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/** Aceita a URL inteira do QR Code ou só o parâmetro `p`. */
export function normalizeNfceInput(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    const url = raw.replace(/^http:/i, 'https:');
    return isAllowedNfceUrl(url) ? url : null;
  }
  // Conteúdo cru do QR: chave|versão|ambiente|token|hash
  if (/^\d{44}\|/.test(raw)) {
    return `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${encodeURIComponent(raw)}`;
  }
  return null;
}

export function chaveFromUrl(url: string): string {
  const p = new URL(url).searchParams.get('p') ?? '';
  const match = p.match(/\d{44}/);
  return match ? match[0] : '';
}

/** "1.245,42" → 1245.42 */
function num(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? text(m[1]) : '';
}

export function parseNfce(html: string, chave: string): NfceReceipt {
  const items: NfceItem[] = [];
  // Cada item é uma <tr> da tabela de resultado.
  const rows = html.match(/<tr[^>]*id="Item[^"]*"[\s\S]*?<\/tr>/g) ?? [];

  for (const row of rows) {
    const name = pick(row, /<span class="txtTit">([\s\S]*?)<\/span>/);
    if (!name) continue;
    items.push({
      name,
      code: pick(row, /<span class="RCod">[\s\S]*?Código:\s*([\w.\-/]+)/),
      qty: num(pick(row, /<span class="Rqtd">[\s\S]*?<\/strong>\s*([\d.,]+)/)),
      unit: pick(row, /<span class="RUN">[\s\S]*?<\/strong>\s*([^<]+)/),
      unitPrice: num(pick(row, /<span class="RvlUnit">[\s\S]*?<\/strong>[\s\S]*?([\d.,]+)\s*<\/span>/)),
      total: num(pick(row, /<span class="valor">\s*([\d.,]+)\s*<\/span>/)),
    });
  }

  const emissao = html.match(/Emissão:\s*<\/strong>\s*(\d{2})\/(\d{2})\/(\d{4})/);
  const date = emissao ? `${emissao[3]}-${emissao[2]}-${emissao[1]}` : '';

  return {
    chave,
    cnpj: pick(html, /CNPJ:\s*([\d.\/-]+)/),
    razaoSocial: pick(html, /<div id="u20"[^>]*>([\s\S]*?)<\/div>/),
    date,
    totalPaid: num(pick(html, /Valor a pagar R\$:\s*<\/label>\s*<span[^>]*>\s*([\d.,]+)/)),
    // Nem toda nota traz desconto; quando traz, é uma linha igual às outras.
    discount: num(pick(html, /<label[^>]*>\s*Descontos?\s*R\$:?\s*<\/label>\s*<span[^>]*>\s*([\d.,]+)/i)),
    items,
  };
}

/** A SEFAZ responde em segundos; passou disso, algo está errado. */
const TIMEOUT_MS = 15_000;
/** A página da nota tem ~20 KB. O teto evita puxar uma resposta enorme. */
const MAX_BYTES = 2_000_000;

/**
 * Busca e interpreta. Roda no servidor — no navegador o CORS bloqueia.
 *
 * Este é um endpoint público depois do deploy, então vale a desconfiança:
 * a origem é conferida, redirecionamento não é seguido (senão a SEFAZ poderia
 * mandar o servidor para outro endereço e a checagem viraria decoração), há
 * prazo máximo e há teto de tamanho.
 */
export async function fetchNfce(url: string): Promise<NfceReceipt> {
  if (!isAllowedNfceUrl(url)) throw new Error('Endereço não é da SEFAZ-SP.');

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'manual',
      signal: abort.signal,
      headers: {
        // Sem User-Agent de navegador o portal responde página de erro.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
  } catch (error) {
    throw new Error(
      (error as Error).name === 'AbortError'
        ? 'A SEFAZ demorou demais para responder. Tente de novo em instantes.'
        : 'Não consegui falar com a SEFAZ.',
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new Error('A SEFAZ redirecionou a consulta. Confira se o link está completo.');
  }
  if (!response.ok) throw new Error(`A SEFAZ respondeu ${response.status}.`);

  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) throw new Error('Resposta da SEFAZ maior que o esperado.');

  const html = (await response.text()).slice(0, MAX_BYTES);
  const receipt = parseNfce(html, chaveFromUrl(url));

  if (receipt.items.length === 0) {
    throw new Error(
      'A SEFAZ não devolveu os itens. O link pode estar incompleto — copie o endereço inteiro do QR Code, incluindo o trecho depois de "p=".',
    );
  }
  return receipt;
}
