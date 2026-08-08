# Arquitetura

Como o app funciona por dentro e por que foi feito assim.

## Estrutura

```
src/
  db/
    schema.ts      tabelas Dexie (purchases, overrides, meta)
    seed.ts        carga inicial a partir do JSON + migrações
    repo.ts        salvar, excluir, exportar, importar
    seed-data.json as 11 compras já digitalizadas
  lib/
    format.ts      moeda, datas, unidades
    normalize.ts   traduz as abreviações do cupom ("QJO" → queijo)
    categories.ts  categorias, correções e agrupamentos
    selectors.ts   toda a agregação: meses, produtos, comparações
    stores.ts      cor e nome curto das lojas
  components/      uma aba por arquivo
```

## Decisões que valem lembrar

**Preço unitário é a única base de comparação.** Nos itens vendidos a peso é o
preço por quilo. Comparar o total da linha daria errado sempre que a quantidade
mudasse.

**Preço/kg e preço/unidade nunca se misturam.** Quando um produto aparece nas duas
formas — coração de frango na bandeja e a granel — só a forma predominante entra
nas comparações (`comparableEntries` em `selectors.ts`).

**Agrupar produtos exige que sejam comparáveis.** Vendidos a peso, ou embalagem
padronizada (leite de 1 L, lata de milho). Ficam de fora os casos em que o cupom
não informa o tamanho e ele muda o preço: "CR.DENTAL COLGATE" a R$ 6,20 contra
"CR.D.COLGATE TRIPLA" a R$ 15,90 não é aumento de preço, é outra embalagem.

**O dado do cupom nunca é reescrito.** Correções de categoria, marca e
agrupamento vivem na tabela `overrides`, com chave `NOME|MARCA`. Dá para reverter
qualquer uma sem perder o original.

**Exclusão é marcada, não apagada** (`deleted: 1`). É o que permite a sincronia
entre aparelhos propagar a remoção mais adiante.

**Unidades do cupom são normalizadas na entrada.** `UND9`, `KG9`, `BDJ7` viram
`UND`, `KG`, `BDJ` — o dígito final é controle fiscal.

## Contas

O app só abre depois do login. Cada pessoa tem a sua conta, com as suas compras.

**Um banco local por conta.** O Dexie abre `mercado-u-<id do usuário>`, não um banco
único. Sem isso, duas pessoas no mesmo navegador veriam as compras uma da outra —
o que impede compartilhar o site com alguém.

**Conta nova começa vazia.** Compras pertencem a quem as fez, então não são
semeadas. Já as correções de categoria e os agrupamentos de produto entram para
todo mundo: são conhecimento sobre produtos, não dados pessoais, e para quem
nunca comprou aqueles itens simplesmente não têm efeito.

**Herança do banco antigo.** Antes do login existia um banco único chamado
`mercado`. A primeira conta aberta num navegador que ainda o tenha herda aquele
histórico, em vez de começar do zero e perdê-lo (`adoptLegacyData`). O estado de
sincronia não é herdado — ele pertencia ao banco antigo.

**Dados cadastrais no `user_metadata`.** Nome, nome da casa e cidade ficam na
própria conta do Supabase, não numa tabela à parte: nascem com o usuário, viajam
com a sessão e não pedem migração de banco. O nome da casa é o que aparece no
topo do app — nada de nome escrito no código.

## Importar a nota fiscal inteira

Aba **Nova Compra** → *Importar nota fiscal*. Cole o link do QR Code do cupom e a
compra entra completa: loja, data, todos os itens com quantidade, unidade e
preço, cada um já categorizado.

No mercado: aponte a câmera do celular para o QR Code do cupom, abra o link,
copie o endereço, cole no app.

**Por que existe `/api/nfce`.** A página da SEFAZ vem pronta do servidor (não
depende de JavaScript), mas não manda cabeçalho CORS — o navegador não consegue
buscá-la. Então quem busca é o servidor: em produção a função `api/nfce.ts`, no
desenvolvimento um middleware do Vite (`nfceDevApi` no `vite.config.ts`). Os dois
usam o mesmo parser de `src/lib/nfce.ts`, para o que se testa aqui valer lá.

O endpoint só aceita endereços de `fazenda.sp.gov.br`. Sem essa trava ele seria
um proxy aberto para qualquer um usar.

**O total da linha vem da nota, não do cálculo.** Em item por peso, `qtd × preço/kg`
não fecha com o cupom (0,282 × 29,99 = 8,457, e a nota cobrou 8,46). O valor da
nota manda enquanto você não mexer na quantidade ou no preço.

**Categoria automática**, em três tentativas: o item já existe no histórico (com
as suas correções) → palavra-chave no nome → "Outros". Os dois últimos casos
aparecem marcados como *palpite* e *confira*, para você saber onde olhar. A
ordem das regras importa: bebida vem antes de fruta, senão "SUCO ABACAXI" cai em
hortifruti.

**Nota repetida é barrada** pela chave de acesso; e como as compras vindas do
arquivo antigo não têm chave, também pela coincidência de data e valor.

**O apelido da loja é aprendido.** A nota traz a razão social ("WMS SUPERMERCADOS
DO BRASIL LTDA"); na primeira importação você ajusta para "Atacadão" e o app
guarda o CNPJ para as próximas.

## Sincronia entre aparelhos

Os dados vivem no aparelho e a nuvem é só o ponto de encontro — o app abre e
funciona mesmo sem internet, e sincroniza quando dá.

**Configuração (uma vez):**

1. No Supabase, abra **SQL Editor** e rode `supabase/schema.sql`.
2. Crie a conta pela própria tela do app (aba **Histórico** → Sincronia →
   *Criar uma conta*). Use a mesma conta no celular e no computador.

As credenciais ficam em `.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_KEY=sb_publishable_...
```

A chave publicável é pública por natureza — ela roda no navegador. Quem protege
os dados é o RLS: as políticas do `schema.sql` só deixam cada conta ler e
escrever as próprias linhas.

**Como funciona:** sobe o que mudou aqui desde o último envio, depois baixa o que
mudou no servidor desde o último cursor (um cursor por tabela). Em conflito vence
o `updatedAt` mais recente. Exclusão viaja como `deleted = true`, por isso a
remoção some nos dois aparelhos em vez de ressuscitar na próxima sincronia.

Sem as variáveis de ambiente o app roda igual, só sem a aba de sincronia.

## Aparência

Tema claro, escuro ou seguindo o sistema, no cabeçalho e na aba Conta. O tema é
aplicado em `main.tsx` **antes** do React montar (`applyStoredTheme`), senão a
tela pisca branca ao abrir no escuro. As cores são variáveis CSS trocadas por
`[data-theme]`; os gráficos usam as mesmas variáveis (`fill="var(--g)"`), então
acompanham o tema sem código extra.

## O que mudou em relação ao MVP

| MVP (`controle_supermercado.html`) | Agora |
|---|---|
| Compras fixas em `const RAW = [...]` no HTML | Banco IndexedDB no aparelho |
| "Nova Compra" perdia tudo ao fechar a aba | Salva de verdade |
| `const EDITS = {}` — correções de categoria não persistiam | Tabela de overrides, editável pela tela |
| Chart.js vindo de CDN | Recharts empacotado — funciona sem internet |
| Textos fixos ("Atualizado 15/06/2026", "desde fev/26") | Calculados a partir dos dados |
| 5 lojas com cor no código, o resto cinza | Cor gerada do nome — loja nova já nasce com identidade |
| Comparação entre lojas casava por nome exato | Produtos equivalentes agrupados |
