# Contexto do Projeto

> Documento de passagem de bastão. Descreve o produto, as regras de negócio
> aprendidas na prática e a arquitetura desejada para a próxima versão.

## Descrição do projeto

A ideia do projeto é construir um web app para registrar as compras realizadas
no mercado e conseguir trazer uma análise em cima dessas compras. As compras são
registradas através do **QR Code e do link da SEFAZ presentes na nota fiscal**,
que o mercado disponibiliza após cada compra.

Hoje uma grande dor é conseguir saber quanto você está pagando em cada item. Com
o histórico das suas compras você passa a saber quanto pagou em cada produto e
se está pagando mais caro ou mais barato do que antes. Além disso, tem um
dashboard financeiro mensal, sabendo em quais lugares compensa comprar e em
quais você tem pagado mais caro por cada item.

O projeto nasceu de uma dor pessoal mas, com este MVP, mostrou-se promissor:
outras pessoas com quem conversei gostaram muito da ideia. Resolvi transformar
isso em um produto de verdade, e preciso da sua ajuda para isso.

### O que o produto resolve, em uma frase

Ninguém lembra quanto pagou no café da vez passada. O app lembra — e avisa no
momento da compra.

### O que já foi validado

O MVP está em uso real, com histórico de 11 compras, 402 itens e 6 mercados
diferentes. As funcionalidades que se mostraram valiosas:

1. **Importar a nota inteira pelo link do QR Code.** Uma compra de 107 itens
   entra em segundos. Sem isso o produto não existe — ninguém digita 107 itens.
2. **Histórico de preço por produto e por loja**, com aviso na hora do cadastro
   quando o item está acima da média ou no menor preço já pago.
3. **Comparação entre mercados** para o mesmo produto. Exemplo real: músculo
   bovino a R$ 36,98/kg numa loja e R$ 45,99/kg em outra — 24% de diferença.
4. **Funcionar offline**, instalado no celular. O uso acontece no corredor do
   mercado, onde o sinal costuma ser ruim.
5. **Cada pessoa com a sua conta**, com sincronia entre celular e computador.

### Para entender o projeto atual

Código, documentação e histórico de decisões:
**https://github.com/millerbotelho14-afk/mercado-app**

Vale ler `docs/arquitetura.md` (como funciona por dentro), `CONTRIBUTING.md`
(regras do domínio) e `docs/backlog.md` (o que ficou para depois e por quê).

---

## Objetivo

Refazer o projeto com uma arquitetura melhor, mais escalável e mais fácil de dar
suporte:

- Separar em **backend, frontend e banco de dados**.
- Hoje o Supabase faz o papel de backend inteiro. Quero um **backend próprio**,
  com models, services, schemas, rotas etc.
- **Frontend com `/api` do Next** para proteger as rotas publicamente.
- **Banco de dados** pode ser Supabase ou MongoDB.

### Repo e regra do frontend

- Tailwind, Next.js ou Vite, custom hooks, services, api.
- **Separar regra de negócio de UI.**

### Repo do backend

- Bem separado, com regras, helpers, schema, model, controller e rotas.
- Sugestão: NestJS, ou Node.js com TypeScript.

### Outras orientações

- **Documentar tudo.** Quem vai trabalhar no projeto, a princípio, não é
  técnico. A documentação precisa explicar o *porquê*, não só o *como*.
- Hospedagem na **Vercel**, no plano gratuito.

---

## Regras de negócio

Esta seção é a parte mais valiosa deste documento. Cada regra abaixo custou um
bug real no MVP. Reimplementar sem elas é repetir os mesmos erros.

### Leitura da nota fiscal (NFC-e)

**A página da SEFAZ não permite acesso direto pelo navegador.** Ela não envia
cabeçalho CORS, então a busca precisa acontecer no servidor. É a razão de existir
uma função de servidor no projeto atual.

**O endpoint de consulta precisa de trava de origem.** Sendo público, ele só pode
aceitar endereços de `fazenda.sp.gov.br`. Sem isso vira um proxy aberto — dá para
pedir que ele busque `169.254.169.254` (metadados internos da nuvem) ou qualquer
outro endereço. A trava precisa cobrir: protocolo (só https), domínio exato
(cuidado com `fazenda.sp.gov.br.dominio-falso.com`), **não seguir
redirecionamento** (senão a checagem vira decoração), tempo limite e teto de
tamanho da resposta.

**O total de cada linha vem da nota, nunca do cálculo.** Recalcular
`quantidade × preço` e somar acumula erro de centavos: uma compra real fechava em
R$ 210,79 quando a nota cobrou R$ 210,78. O número tem de bater com o cupom.
Se o usuário editar quantidade ou preço, aí sim recalcula.

**Nota repetida é barrada** pela chave de acesso (44 dígitos). Para compras
importadas antes de haver chave, a barreira secundária é coincidência de data e
valor.

**A nota traz razão social, não o nome da loja.** "WMS SUPERMERCADOS DO BRASIL
LTDA" é o Atacadão. O app aprende o apelido pelo CNPJ na primeira importação e
reutiliza nas próximas.

### Comparação de preços

**Preço unitário é a única base de comparação.** Nos itens vendidos a peso, o
preço por quilo.

**Preço por quilo nunca se compara com preço por unidade.** O mesmo produto
aparece nas duas formas — coração de frango na bandeja (R$ 27,90 a peça) e a
granel (R$ 32,98/kg). Comparar os dois inventa variação de preço que não existe.
Quando um produto tem as duas formas, só a predominante entra nas comparações.

**Agrupar produtos de nomes diferentes só vale quando são de fato comparáveis.**
Isto é o que permite comparar mercados: "MUSCULO BOVINO KG", "MUSCULO KG KG" e
"CAR BOV MUSCULO KG" são o mesmo músculo em três lojas.

Mas o critério tem de ser rígido: **vendidos a peso** (o preço/kg resolve o
tamanho) ou **embalagem padronizada** (leite de 1 L, lata de milho). Ficam de
fora os casos em que o cupom não informa o tamanho e ele muda o preço:
"CR.DENTAL COLGATE" a R$ 6,20 contra "CR.D.COLGATE TRIPLA" a R$ 15,90 não é
aumento de preço, é outra embalagem. No MVP, agrupar sem esse critério produziu
uma alta falsa de +168%.

### Dados do usuário

**O dado original do cupom nunca é reescrito.** Correções de categoria, marca e
agrupamento vivem em uma tabela de sobreposições, com chave `NOME|MARCA`. Isso
torna qualquer correção reversível e preserva o que a nota realmente dizia.

**Exclusão é marcada, não apagada.** Um registro excluído recebe uma marca e
continua existindo. É o que permite a remoção viajar para os outros aparelhos na
sincronia — apagar de vez faria a cópia voltar na próxima descida de dados.

**Cada conta enxerga apenas os próprios dados.** No banco isso é garantido por
política de linha (RLS no Postgres), não pelo código do cliente. E, no
armazenamento local, cada conta precisa de um banco próprio: sem isso, duas
pessoas usando o mesmo navegador veem as compras uma da outra.

**O usuário precisa conseguir apagar a conta e todos os dados.** Requisito de
LGPD e condição para pedir que alguém confie o histórico de compras ao app.

### Categorização

Categorias em uso: Carnes e Proteínas, Hortifruti, Laticínios, Padaria e
Cereais, Bebidas, Congelados e Prontos, Limpeza, Higiene e Beleza, Temperos e
Condimentos, Lanches e Guloseimas, Bebê, Outros Domésticos, Outros.

**A categoria de um item importado sai de três tentativas, nesta ordem:**

1. O item já existe no histórico do usuário → usa a categoria de lá, já com as
   correções que ele fez.
2. Palavra-chave no nome.
3. "Outros" — e o usuário corrige uma vez; a correção vale para sempre.

**A ordem das regras de palavra-chave importa.** Bebida vem antes de fruta,
senão "SUCO ABACAXI" cai em hortifruti. O mesmo vale para "polpa de tomate"
contra tomate.

**Ignorar o tamanho no fim do nome ao procurar no histórico.** A mesma loja
escreve "SUCO ABACAXI MARATA" numa nota e "SUCO ABACAXI MARATA 1L" na outra.

**Mostrar de onde veio o palpite.** O usuário precisa saber onde olhar: o que
veio do histórico é confiável, o que veio de palavra-chave é palpite, e o que
caiu em "Outros" pede conferência.

### Normalização

**Unidades do cupom trazem dígito de controle fiscal.** `UND9`, `KG9`, `BDJ7`,
`CXA1` — o número final não é unidade. Sem normalizar, o formulário mostra "UND"
e salva "UND9", valores diferentes.

**O cupom abrevia tudo, e a busca precisa entender.** Quem procura "queijo"
precisa achar "QJO MUSS.CEDRENSE"; quem procura "frango" precisa achar
"FILE PEITO FGO SEARA". O MVP tem cerca de 70 regras de expansão, e elas são
conhecimento acumulado — vale reaproveitar o arquivo `src/lib/normalize.ts`.

**Itens repetidos na mesma nota viram uma ocorrência só**, somando quantidade e
valor mas mantendo o preço unitário. O cupom às vezes lista o mesmo produto em
linhas separadas (três pesagens de carne moída, por exemplo).

### Sincronia entre aparelhos

- Envia o que mudou localmente desde o último envio; depois baixa o que mudou no
  servidor desde o último cursor, **um cursor por tabela**.
- Em conflito, vence a edição com data de atualização mais recente.
- O app precisa abrir e funcionar **sem internet**. A nuvem é ponto de encontro,
  não fonte da verdade em tempo real.

---

## Pontos de atenção sobre a arquitetura pedida

Observações honestas de quem construiu o MVP. Você decide, mas vale considerar.

**O offline é funcionalidade, não detalhe técnico.** Hoje o app guarda tudo no
aparelho e sincroniza depois — por isso funciona no corredor do mercado sem
sinal. Uma arquitetura tradicional, em que o frontend consulta o backend a cada
tela, perde isso. Se a separação em backend próprio for adiante, o desenho
precisa manter uma camada local no cliente e tratar o backend como destino de
sincronia, não como origem de cada leitura.

**NestJS não encaixa bem no plano gratuito da Vercel.** A Vercel roda funções
sem estado, com tempo de execução limitado, não um servidor de pé o tempo todo.
NestJS funciona lá com adaptações, mas fica desconfortável. Alternativas que
encaixam melhor mantendo a organização pedida (controller, service, model,
schema): Next.js API routes ou Hono, ambos com a mesma separação de camadas em
pastas. Se NestJS for requisito, vale hospedar o backend em Railway, Render ou
Fly.io — todos com plano gratuito — e deixar só o frontend na Vercel.

**O plano Hobby da Vercel é para uso não comercial.** No dia em que houver
assinatura paga, é preciso migrar para o plano Pro. Não bloqueia nada agora, mas
é bom saber que o degrau existe.

**Manter o Supabase como banco economiza reescrever autenticação.** Login,
recuperação de senha e confirmação por e-mail já funcionam, e são chatos de
refazer. Dá para ter backend próprio *e* continuar usando o Supabase só como
Postgres + autenticação — o backend valida o token e fala com o banco. Trocar
para MongoDB significa reimplementar toda a camada de contas.

**O que der para reaproveitar, reaproveite.** As partes de lógica pura do MVP
estão testadas e são independentes de framework: leitura da nota, normalização
de nomes e unidades, categorização automática, e os cálculos de comparação de
preço. São o coração do produto e custaram muitos bugs para chegar onde estão.

**Escreva testes desde o começo.** O MVP tem 52 testes, e quase todos nasceram
de um bug real. O dono do produto não é desenvolvedor e não tem como perceber
uma regressão silenciosa nos cálculos — os testes são a rede de proteção dele.

---

## Estado atual e pendências

**No ar:** produção em `mercado-app-rellim.vercel.app`, ambiente de teste em
`mercado-app-teste.vercel.app`, cada um com o seu banco.

**Funcionalidades prontas:** importação de nota por link do QR Code, cadastro
manual com autocomplete e alerta de preço, dashboard mensal com gráficos,
análises com drill-down (variação de preços, comparação entre lojas, ticket
médio, projeção), busca com histórico por produto, contas com sincronia,
recuperação de senha, exclusão de conta, tema claro/escuro, PWA instalável e
offline, export e import em JSON.

**Pendências conhecidas** (detalhadas em `docs/backlog.md`): política de
privacidade; leitura do QR Code pela câmera dentro do app; lista de compras com
estimativa de custo; redução do tamanho do bundle (273 KB comprimidos, ~70%
sendo a biblioteca de gráficos); testes das partes que dependem do banco local;
e limitação de uso do endpoint público de consulta à SEFAZ.
