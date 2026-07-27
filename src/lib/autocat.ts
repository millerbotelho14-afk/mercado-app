import type { Product } from './selectors';
import { normText } from './normalize';

/**
 * Categoriza um item de nota importada sem depender de ninguém.
 * Três tentativas, da mais confiável para a mais genérica:
 *   1. o item já existe no histórico → usa a categoria dele (inclui correções);
 *   2. palavra-chave no nome;
 *   3. "Outros" — você arruma uma vez e a correção passa a valer sempre.
 */

/**
 * A ordem importa: a primeira regra que casar vence. Bebidas vem antes de
 * hortifruti porque "SUCO ABACAXI" é bebida, não fruta — e o mesmo vale para
 * "polpa de tomate" contra tomate, ou "leite de coco" contra coco.
 */
const RULES: Array<[RegExp, string]> = [
  [/\b(refrigerante|refri|coca|guarana|fanta|sprite|suco|nectar|agua mineral|cerveja|cerv|vinho|whisky|vodka|cachaca|energetico|isoto|powerade|gatorade|cafe|cha|achoc|nescau|toddy|chopp|espumante|gin)\b/i, 'Bebidas'],
  [/\b(fgo|frango|coxa|sobrecoxa|asa|peito|file|carne|bovin|acem|patinho|alcatra|musculo|costela|figado|coracao|bacon|linguic|ling|paio|salsich|suin|bisteca|pernil|peixe|tilapia|sardinha|atum|camarao|ovo|hamburgue|osso|moida|guioza|nuggets)\b/i, 'Carnes e Proteínas'],
  [/\b(leite|lte|queijo|qjo|muss|mussarela|requeijao|iogurte|manteiga|margarina|marg|creme de leite|cr\.leite|nata|ricota|parmesao|coalho|d\.leite|doce de leite|l\.cond|condensado)\b/i, 'Laticínios'],
  [/\b(congelad|sorvete|sorv|acai|polpa|pizza|batata palito|mccain|empanado|pao de queijo|pipoca micro)\b/i, 'Congelados e Prontos'],
  [/\b(banana|maca|mamao|manga|abacate|abacaxi|melancia|melao|uva|pera|laranja|limao|mexerica|ponkan|ameixa|goiaba|kiwi|morango|tomate|cebola|alho|batata|cenoura|chuchu|abobora|abobrinha|pepino|pimentao|alface|rucula|couve|brocolis|repolho|vagem|beterraba|mandioca|aipim|inhame|salsinha|cheiro verde|coentro|gengibre|verdura|legume|fruta)\b/i, 'Hortifruti'],
  [/\b(pao|bisc|biscoito|bolacha|torrada|bisnaguinha|arroz|feijao|macarrao|mac|massa|farinha|far|fubá|flocao|aveia|granola|cereal|acuc|acucar|trigo|canjica|milho|lentilha|grao|espaguete|lasanha|tapioca|waffle|bolo|rosquinha|cookie|wafer)\b/i, 'Padaria e Cereais'],
  [/\b(detergente|det|sabao|amaciante|amac|desinfetante|desinf|agua sanitaria|sanitaria|alvejante|limpador|limp|veja|cif|pinho|esponja|la de aco|vanish|tira manchas|saco de lixo|sac inst|papel higienico|p\.hig|papel hig|toalha papel|guardanapo|luva|multiuso|deseng|alcool|desengordurante|lava roupa|omo|brilhante)\b/i, 'Limpeza'],
  [/\b(shampoo|shamp|condicionador|cond|sabonete|creme dental|cr\.dental|escova dental|esc\.dental|fio dental|desodorante|des|absorvente|abs|protetor diario|fralda|toalha umed|lenco umed|hidratante|barbear|gilette|colgate|oral-b|dove|seda|nivea|intimus|carefree|papel toalha rosto)\b/i, 'Higiene e Beleza'],
  [/\b(sal|pimenta|oregano|alecrim|louro|canela|cominho|colorifico|paprica|papri|curry|acafrao|tempero|temp|chimichurri|vinagre|azeite|oleo|molho|shoyu|ketchup|mostarda|maionese|maion|extrato|polpa de tomate|azeitona|conserva|bicarbonato|fermento|ferm|aroma|baunilha|manjericao|alho granulado)\b/i, 'Temperos e Condimentos'],
  [/\b(salgadinho|salg|chips|batata palha|amendoim|pipoca|chocolate|choc|bombom|bala|chiclete|chicl|pirulito|trufa|goiabada|doce|gelatina|biscoito recheado|oreo|trakinas|kitkat|lays|pringles|ruffles|fandangos|cheetos)\b/i, 'Lanches e Guloseimas'],
  [/\b(fralda|mamadeira|chupeta|papinha|nan |aptamil|infantil|bebe|talco)\b/i, 'Bebê'],
  [/\b(pilha|lampada|filtro papel|melitta|papel aluminio|fol\.alum|filme pvc|palito|vela|sacola|isqueiro|pano de prato|cabide|papel manteiga)\b/i, 'Outros Domésticos'],
];

export interface CategoryGuess {
  category: string;
  /** De onde veio o palpite — o app mostra isso para você saber no que confiar. */
  source: 'historico' | 'regra' | 'padrao';
}

/**
 * A mesma loja escreve o produto de jeitos ligeiramente diferentes entre notas
 * — "SUCO ABACAXI MARATA" numa, "SUCO ABACAXI MARATA 1L" na outra. Tirar o
 * tamanho do fim faz as duas se encontrarem no histórico.
 */
function stripSize(name: string): string {
  return name
    .replace(/\b\d+[.,]?\d*\s*(kg|g|gr|ml|l|lt|lts|un|und|cx|pct|pc)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Índice nome→categoria a partir do que já foi comprado, com as correções aplicadas. */
export function buildCategoryIndex(products: Map<string, Product>): Map<string, string> {
  const index = new Map<string, string>();
  for (const prod of products.values()) {
    for (const variant of prod.variants) {
      index.set(variant.toUpperCase().trim(), prod.category);
      index.set(normText(variant), prod.category);
      index.set(normText(stripSize(variant)), prod.category);
    }
  }
  return index;
}

export function guessCategory(name: string, index: Map<string, string>): CategoryGuess {
  const exact = index.get(name.toUpperCase().trim());
  if (exact) return { category: exact, source: 'historico' };

  const normalized = index.get(normText(name));
  if (normalized) return { category: normalized, source: 'historico' };

  const withoutSize = index.get(normText(stripSize(name)));
  if (withoutSize) return { category: withoutSize, source: 'historico' };

  const expanded = normText(name);
  for (const [pattern, category] of RULES) {
    if (pattern.test(expanded) || pattern.test(name)) {
      return { category, source: 'regra' };
    }
  }
  return { category: 'Outros', source: 'padrao' };
}
