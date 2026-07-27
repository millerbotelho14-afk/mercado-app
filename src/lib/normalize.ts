/** Cupom fiscal abrevia tudo. Estas regras traduzem para o que uma pessoa digita
 *  na busca: quem procura "queijo" precisa achar "QJO MUSS.CEDRENSE". */
const RULES: Array<[RegExp, string]> = [
  [/\bqjo\.?\b/gi, 'queijo'],
  [/\bmuss\.?\b/gi, 'mussarela'],
  [/\bfgo\b/gi, 'frango'],
  [/\bbov\.?\b/gi, 'bovino'],
  [/\bsuin\b/gi, 'suino'],
  [/\bcar\b/gi, 'carne'],
  [/\bshamp\.\b/gi, 'shampoo'],
  [/\bcond\.seda\b/gi, 'condicionador'],
  [/\bcr\.leite\b/gi, 'creme de leite'],
  [/\bbisc\.\b/gi, 'biscoito'],
  [/\bmac\.\b/gi, 'macarrão'],
  [/\bdet\.?\b/gi, 'detergente'],
  [/\bsab\.liq\b/gi, 'sabonete'],
  [/\bsab\.dove\b/gi, 'sabonete dove'],
  [/\bsab\.\b/gi, 'sabão'],
  [/\bamac\.roupa\b/gi, 'amaciante roupa'],
  [/\bdes\.\b/gi, 'desodorante'],
  [/\besc\.dental\b/gi, 'escova dental'],
  [/\bcr\.dental\b/gi, 'creme dental'],
  [/\bcr\.d\.\b/gi, 'creme dental'],
  [/\blimp\.\b/gi, 'limpador'],
  [/\bdesinf\.\b/gi, 'desinfetante'],
  [/\bdeseng\.\b/gi, 'desengordurante'],
  [/\bachoc\.\b/gi, 'achocolatado'],
  [/\bacuc\.?\b/gi, 'açúcar'],
  [/\bp\.hig\.\b/gi, 'papel higienico'],
  [/\bsac inst\.\b/gi, 'saco de lixo'],
  [/\btoalha umed\.\b/gi, 'toalha umedecida'],
  [/\bfilezinho fgo\b/gi, 'filezinho frango'],
  [/\bcox\.asa\b/gi, 'coxinha da asa'],
  [/\bmeio asa\b/gi, 'meio da asa'],
  [/\bsobrecoxa\b/gi, 'sobrecoxa frango'],
  [/\bsalg\.\b/gi, 'salgadinho'],
  [/\bpolpa\b/gi, 'polpa de fruta'],
  [/\bref\.\b/gi, 'refrigerante'],
  [/\bref\b/gi, 'refrigerante'],
  [/\bling\.\b/gi, 'linguica'],
  [/\bpao\b/gi, 'pão'],
  [/\bgoma mandioca\b/gi, 'tapioca goma'],
  [/\bmandioca\b/gi, 'mandioca aipim'],
  [/\bcereal mat\.?\b/gi, 'cereal matinal'],
  [/\bt\.manchas\b/gi, 'tira manchas'],
  [/\bmaion\.?\b/gi, 'maionese'],
  [/\boleo soja\b/gi, 'óleo de soja'],
  [/\bferm\.\b/gi, 'fermento'],
  [/\bd\.leite\b/gi, 'doce de leite'],
  [/\bl\.cond\.\b/gi, 'leite condensado'],
  [/\bleite coco\b/gi, 'leite de coco'],
  [/\bcoronita\b/gi, 'cerveja coronita'],
  [/\bimperio\b/gi, 'cerveja império'],
  [/\bfralda\b/gi, 'fralda pampers'],
  [/\bbatata palha\b/gi, 'batata palha salgadinho'],
  [/\bacém|acem\b/gi, 'acém carne'],
  [/\bmusculo\b/gi, 'músculo carne'],
  [/\bfigado\b/gi, 'fígado bovino'],
  [/\bcoracao\b/gi, 'coração'],
  [/\bchimichurri\b/gi, 'chimichurri tempero'],
  [/\babs\.\b/gi, 'absorvente'],
  [/\bprot\.diario\b/gi, 'protetor diário'],
  [/\bsard\.\b/gi, 'sardinha'],
  [/\bchocl?\.\b/gi, 'chocolate'],
  [/\bchicl\.\b/gi, 'chiclete'],
  [/\bfar\.trigo\b/gi, 'farinha de trigo'],
  [/\bsorv\b/gi, 'sorvete'],
  [/\bisoto\.\b/gi, 'isotônico'],
  [/\blte\b/gi, 'leite'],
  [/\bfol\.alum\.?\b/gi, 'papel alumínio'],
  [/\bmarg\.\b/gi, 'margarina'],
  [/\btemp\.\b/gi, 'tempero'],
];

/** Remove acento para a busca casar com ou sem ele. */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Expande as abreviações e devolve o texto pronto para comparação. */
export function normText(input: string): string {
  let r = ' ' + input.toLowerCase() + ' ';
  for (const [pattern, replacement] of RULES) {
    r = r.replace(pattern, ' ' + replacement + ' ');
  }
  return stripAccents(r.replace(/\s+/g, ' ').trim());
}

/** Texto de busca de um item: nome + marca + categoria, tudo normalizado. */
export function searchText(name: string, brand: string | null, category: string): string {
  return normText(`${name} ${brand ?? ''} ${category}`);
}

export function matchesQuery(haystack: string, rawName: string, query: string): boolean {
  const q = query.trim();
  if (q.length < 2) return false;
  const plain = stripAccents(q.toLowerCase());
  return (
    haystack.includes(normText(q)) ||
    haystack.includes(plain) ||
    stripAccents(rawName.toLowerCase()).includes(plain)
  );
}
