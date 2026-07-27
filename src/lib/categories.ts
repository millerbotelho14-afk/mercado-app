/** Categorias e as correções que entram junto com a carga inicial. */

export const CATEGORY_ICON: Record<string, string> = {
  'Carnes e Proteínas': '🥩',
  Hortifruti: '🥦',
  Laticínios: '🧀',
  'Padaria e Cereais': '🍞',
  Bebidas: '🥤',
  'Congelados e Prontos': '🧊',
  Limpeza: '🧹',
  'Higiene e Beleza': '🧴',
  'Temperos e Condimentos': '🌶',
  'Lanches e Guloseimas': '🍿',
  Bebê: '👶',
  'Outros Domésticos': '🏠',
  Outros: '📦',
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_ICON);

export function categoryIcon(cat: string): string {
  return CATEGORY_ICON[cat] ?? '📦';
}

/**
 * Correções de categoria detectadas nos cupons já importados. Entram como
 * override editável — o dado original do cupom continua intacto, e você pode
 * reverter qualquer uma pela tela.
 * Chave: `NOME|MARCA` (marca vazia quando o cupom não trouxe).
 */
export const SEED_CATEGORY_FIXES: Array<[string, string]> = [
  ['AGUA SANIT.S.CANDIDA|', 'Limpeza'], // vinha como Bebidas
  ['AMAC.ROUPA YPE CONC.|YPE', 'Limpeza'], // vinha como Padaria e Cereais
  ['BUZINA D.BARUL SPRAY|', 'Outros Domésticos'], // vinha como Bebê
  ['ALHO GRANULADO MEMBE|', 'Temperos e Condimentos'], // vinha como Hortifruti
  ['HEMMER PEPINOS RODEL|HEMMER', 'Temperos e Condimentos'], // conserva, não hortifruti
  ['PEPINO HEMMER ROD.|HEMMER', 'Temperos e Condimentos'],
  ['SUCO MARATA MANGA|MARATA', 'Bebidas'], // vinha como Hortifruti
  ['VINAGRE CASTELO MACA|', 'Temperos e Condimentos'], // vinha como Hortifruti
  ['VINAGRE VITALIA|VITALIA', 'Temperos e Condimentos'], // vinha como Limpeza
  ['BISC.MARILAN LEITE|', 'Padaria e Cereais'], // vinha como Laticínios
  ['BISC.NEST.PASS.LEITE|', 'Padaria e Cereais'],
  ['PAPEL MANTEIGA WYDA|WYDA', 'Outros Domésticos'], // vinha como Laticínios
  ['PAO DE QJO COQUET 1K|', 'Congelados e Prontos'],
  ['SAB.DOVE BRANCO|DOVE', 'Higiene e Beleza'], // sabonete, não sabão
  ['SAB.LIQ.LUX|', 'Higiene e Beleza'],
  ['SACOLA RET.ATACADAO|', 'Outros Domésticos'],
  ['BALA DORI GOMA GOMET|DORI', 'Lanches e Guloseimas'], // vinha como Padaria e Cereais
];

/** Marcas que o parser do cupom pegou errado. */
export const SEED_BRAND_FIXES: Array<[string, string | null]> = [
  ['CERVEJA CORONITA EXT|VEJA', 'CORONA'], // casou "VEJA" dentro de "CERVEJA"
  ['CERVEJA IMPERIO|VEJA', 'IMPERIO'],
];

/**
 * Produtos que aparecem com nomes diferentes em cada loja. Agrupar é o que
 * permite comparar preço entre mercados — sem isso, "MUSCULO BOVINO KG" do HDN
 * nunca encontra "CAR BOV MUSCULO KG" do Atacadão.
 *
 * Regra para entrar aqui: os itens têm de ser realmente comparáveis. Vendidos a
 * peso (preço/kg resolve o tamanho) ou embalagem padronizada — leite de 1L,
 * lata de milho, pacote de polpa. Ficam de fora os casos em que o cupom não diz
 * o tamanho e ele muda o preço: "CR.DENTAL COLGATE" a R$ 6,20 contra
 * "CR.D.COLGATE TRIPLA" a R$ 15,90 não é aumento de preço, é outra embalagem.
 * Formato: [nome do grupo, [chaves `NOME|MARCA`]]
 */
export const SEED_PRODUCT_GROUPS: Array<[string, string[]]> = [
  // ── Vendidos a peso: preço/kg é diretamente comparável ──
  ['Músculo bovino', ['MUSCULO BOVINO KG|', 'MUSCULO KG KG|', 'CAR BOV MUSCULO KG|']],
  ['Acém sem osso', ['ACEM SEM OSSO|', 'BOV.ACEM S/OSSO RESE|', 'CAR BOV ACEM S/OSSO|', 'MIOLO ACEM KG|']],
  ['Fígado bovino', ['FIGADO BOVINO KG|', 'FIGADO BOVINO KG KG|', 'FIGADO DE BOI|']],
  ['Peito de frango com osso', ['PEITO FGO C/OSSO KG|', 'PEITO FRANGO C/OSSO|']],
  ['Bacon em pedaço', ['BACON PDC DEF SULITA|SULITA', 'BACON PDC SEARA|SEARA', 'RF.BACON DEF.PRIETO|PRIETO']],
  ['Pepino japonês', ['PEPINO JAPONES|', 'PEPINO JAPONES KG|']],
  ['Chuchu', ['CHUCHU|', 'CHUCHU PRETO KG|']],
  ['Cebola', ['CEBOLA KG|', 'CEBOLA NACIONAL|']],
  ['Batata', ['BATATA LAVADA KG|', 'BATATA MONALISA|']],

  // ── Embalagem padronizada ──
  ['Alface crespa', ['ALFACE CRESPA|', 'ALFACE CRESPA HIDRO|']],
  ['Leite integral 1L', ['LEITE ITALAC INT|ITALAC', 'LEITE PIRACANJUBA IN|PIRACANJUBA', 'LTE INT JUSSARA 1L|']],
  ['Leite condensado', ['L.COND.MOCA SEMI.TP|', 'L.COND.PIRAC.SEMI.TP|']],
  ['Óleo de soja', ['OLEO SOJA COAMO|COAMO', 'OLEO SOJA SOYA|', 'OLEO SOJA VITALIV|']],
  ['Milho verde em conserva', ['MILHO VERDE BONARE|BONARE', 'MILHO VERDE QUERO|QUERO']],
  ['Polpa de fruta', ['POLPA BRASFRUT|BRASFRUT', 'POLPA NORTE|NORTE', 'POLPA NORTE CAJU|NORTE', 'POLPA NORTE FRUTAS V|NORTE']],
  ['Bisnaguinha', ['BISNAGUINHA BAUDUCCO|BAUDUCCO', 'BISNAGUINHA PANCO|PANCO']],
  ['Macarrão instantâneo Nissin', ['MAC.INST.NISSIN|NISSIN', 'MAC.NISSIN LAMEN|NISSIN']],
  ['Detergente líquido', ['DET.LIQ.CANDURA|', 'DET.LIQ.YPE|YPE']],
  ['Papel toalha', ['TOALHA PAPEL KITCHEN|', 'TOALHA PAPEL KLASS|']],
  ['Saco de lixo', ['SAC INST.BIO 60X70|', 'SAC 58X70CM CINZA|']],

  // ── Mesmo produto, grafia diferente no cupom ──
  ['Bala de gelatina Fini', ['BALA GEL.FINI TUBES|FINI', 'BALA GELATINA FINI|FINI']],
  ['Absorvente Intimus', ['ABS.INTIMUS C/A LP|INTIMUS', 'ABS.INTIMUS C/A LP-|INTIMUS']],
  ['Páprica Kisabor', ['PAPRICA KISABOR|KISABOR', 'PAPRI DOC KISABO 30G|KISABOR']],
];
