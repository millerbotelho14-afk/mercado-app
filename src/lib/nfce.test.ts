import { describe, expect, it } from 'vitest';
import { isAllowedNfceUrl, normalizeNfceInput, parseNfce } from './nfce';

/**
 * Trecho real da página de consulta da SEFAZ-SP, reduzido ao que o parser lê.
 * Se a SEFAZ mudar o HTML, é aqui que o teste quebra — e é isso que queremos:
 * descobrir pelo teste, não pelo usuário no caixa do mercado.
 */
const PAGINA = `
<div class="txtCenter">
  <div id="u20" class="txtTopo">KING BOI CENTRAL DE CARNES LTDA</div>
  <div class="text">CNPJ: 14.675.643/0001-40</div>
</div>
<table id="tabResult">
  <tr id="Item + 1">
    <td><span class="txtTit">PEITO DE FRANGO</span>
      <span class="RCod">(Código: 00238 )</span>
      <span class="Rqtd"><strong>Qtde.:</strong>1,136</span>
      <span class="RUN"><strong>UN: </strong>KG</span>
      <span class="RvlUnit"><strong>Vl. Unit.:</strong> 12,99</span></td>
    <td class="txtTit noWrap">Vl. Total<br><span class="valor">14,76</span></td>
  </tr>
  <tr id="Item + 2">
    <td><span class="txtTit">SUCO ABACAXI MARATA 1L</span>
      <span class="RCod">(Código: 979007 )</span>
      <span class="Rqtd"><strong>Qtde.:</strong>1</span>
      <span class="RUN"><strong>UN: </strong>UN</span>
      <span class="RvlUnit"><strong>Vl. Unit.:</strong> 7,49</span></td>
    <td class="txtTit noWrap">Vl. Total<br><span class="valor">7,49</span></td>
  </tr>
</table>
<div id="totalNota">
  <div id="linhaTotal"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">1.234,56</span></div>
</div>
<div id="infos"><strong>Número: </strong>70606<strong> Série: </strong>1<strong> Emissão: </strong>04/07/2026 14:59:56</div>
`;

describe('trava de origem (o endpoint é público)', () => {
  it('aceita a SEFAZ paulista por https', () => {
    expect(isAllowedNfceUrl('https://www.nfce.fazenda.sp.gov.br/x')).toBe(true);
  });

  it.each([
    ['http, sem TLS', 'http://www.nfce.fazenda.sp.gov.br/x'],
    ['outro domínio', 'https://evil.com/x'],
    ['sufixo falsificado', 'https://fazenda.sp.gov.br.evil.com/x'],
    ['rede interna', 'https://localhost/x'],
    ['metadados da nuvem', 'https://169.254.169.254/latest/meta-data'],
    ['texto qualquer', 'sei la'],
  ])('recusa %s', (_caso, url) => {
    expect(isAllowedNfceUrl(url)).toBe(false);
  });
});

describe('entrada do usuário', () => {
  it('aceita a URL inteira do QR Code', () => {
    const url =
      'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=352607146756430001406500100007060610027328057|2|1|1|abc';
    expect(normalizeNfceInput(url)).toContain('fazenda.sp.gov.br');
  });

  it('monta a URL a partir do conteúdo cru do QR Code', () => {
    const cru = '35260714675643000140650010000706061002732805|2|1|1|528cbb4f';
    expect(normalizeNfceInput(cru)).toContain('ConsultaQRCode.aspx?p=');
  });

  it('devolve nulo para lixo, em vez de tentar buscar', () => {
    expect(normalizeNfceInput('não é link')).toBeNull();
    expect(normalizeNfceInput('')).toBeNull();
  });
});

describe('leitura da nota', () => {
  const nota = parseNfce(PAGINA, '35260714675643000140650010000706061002732805');

  it('identifica a loja e a data', () => {
    expect(nota.razaoSocial).toBe('KING BOI CENTRAL DE CARNES LTDA');
    expect(nota.cnpj).toBe('14.675.643/0001-40');
    expect(nota.date).toBe('2026-07-04');
  });

  it('lê todos os itens com quantidade, unidade e preço', () => {
    expect(nota.items).toHaveLength(2);
    expect(nota.items[0]).toMatchObject({
      name: 'PEITO DE FRANGO',
      qty: 1.136,
      unit: 'KG',
      unitPrice: 12.99,
      total: 14.76,
    });
  });

  it('entende milhar com ponto e centavo com vírgula', () => {
    expect(nota.totalPaid).toBe(1234.56);
  });

  it('guarda o total que a nota cobrou, e não um cálculo próprio', () => {
    expect(nota.items[0].total).toBe(14.76);
    expect(nota.items[1].total).toBe(7.49);
  });
});

describe('por que o total da linha vem da nota', () => {
  // Regressão: o app somava `qtd × preço` sem arredondar linha a linha, e o
  // erro se acumulava — a compra do King Boi fechava em R$ 210,79 quando a
  // nota cobrou R$ 210,78. Um centavo, mas o número tem de bater com o cupom.
  const linhas = [
    { qty: 1.136, unitPrice: 12.99, total: 14.76 },
    { qty: 0.282, unitPrice: 29.99, total: 8.46 },
    { qty: 0.742, unitPrice: 34.99, total: 25.96 },
    { qty: 0.58, unitPrice: 39.99, total: 23.19 },
    { qty: 0.268, unitPrice: 29.99, total: 8.04 },
    { qty: 0.552, unitPrice: 29.99, total: 16.55 },
    { qty: 1.058, unitPrice: 57.99, total: 61.35 },
    { qty: 0.548, unitPrice: 39.99, total: 21.91 },
    { qty: 1.154, unitPrice: 19.99, total: 23.07 },
    { qty: 1, unitPrice: 7.49, total: 7.49 },
  ];

  it('somar os totais da nota bate com o que foi pago', () => {
    const soma = linhas.reduce((s, l) => s + l.total, 0);
    expect(+soma.toFixed(2)).toBe(210.78);
  });

  it('somar quantidade × preço erra por um centavo', () => {
    const soma = linhas.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    expect(+soma.toFixed(2)).toBe(210.79);
  });
});
