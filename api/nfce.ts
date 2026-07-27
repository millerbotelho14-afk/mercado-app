import { fetchNfce, normalizeNfceInput } from '../src/lib/nfce';

export const config = { runtime: 'edge' };

/**
 * Ponte para a SEFAZ. Existe porque o portal não manda cabeçalho CORS: o
 * navegador não consegue buscar a nota sozinho, mas o servidor consegue.
 * Só aceita endereços de `fazenda.sp.gov.br` — caso contrário isto seria um
 * proxy aberto para qualquer um usar.
 */
export default async function handler(request: Request): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });

  const input = new URL(request.url).searchParams.get('u');
  if (!input) return json({ error: 'Informe o link da nota.' }, 400);

  const url = normalizeNfceInput(input);
  if (!url) return json({ error: 'Link inválido. Use o endereço do QR Code da NFC-e paulista.' }, 400);

  try {
    return json(await fetchNfce(url));
  } catch (error) {
    return json({ error: (error as Error).message }, 502);
  }
}
