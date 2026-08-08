# Backlog

O que ficou para depois, com o motivo. Nada aqui é urgente — se fosse, teria
sido feito. A ordem é sugestão, não regra.

## Antes de convidar mais gente

**Excluir conta e apagar os dados.** Hoje não existe. Quem se cadastra não
consegue sair nem remover o próprio histórico. É o mínimo para pedir que alguém
confie dados de compra ao app, e fica caro de encaixar depois que houver muitos
usuários. Envolve apagar as linhas no Supabase, limpar o banco local e encerrar
a sessão.

**Política de privacidade.** Um texto curto e honesto: o que é guardado, onde,
por quanto tempo, e como apagar. Necessário no momento em que o cadastro deixar
de ser só para conhecidos.

## Produto

**Ler o QR Code pela câmera.** Hoje é preciso escanear pelo app da câmera, abrir
o link, copiar e colar. Ler direto dentro do app eliminaria quatro toques no
caixa do mercado — é a parte mais chata do fluxo atual.

**Lista de compras com estimativa de custo.** Monta a lista antes de sair de
casa e o app estima o total a partir do histórico de preços. Usa o que já existe
e é a funcionalidade que mais se aproveita dos dados acumulados.

**Alerta de item em falta.** "Você compra café a cada 3 semanas e faz 4" — dá
para inferir do histórico, sem o usuário cadastrar nada.

## Técnico

**Reduzir o tamanho do app.** O navegador baixa 273 KB comprimidos (917 KB sem
compressão), e cerca de 70% disso é o Recharts, biblioteca usada para apenas
dois gráficos. Escrever os dois em SVG à mão derrubaria para uns 80 KB.

Efeito prático: alguns segundos a menos na primeira abertura no 4G. Depois da
primeira vez o app fica em cache e abre instantâneo, então o ganho é só para
quem entra pela primeira vez. Meio dia de trabalho que não adiciona
funcionalidade — vale quando as features estiverem prontas, não antes.

**Testar o que depende do banco local.** Os 52 testes de hoje cobrem lógica
pura. Importação de JSON, deduplicação e migrações não são testadas porque
precisam de um IndexedDB de mentira (`fake-indexeddb`). Justamente aí mora o bug
que duplicou 11 compras durante o desenvolvimento.

**Desconto na nota importada.** O parser lê o campo, mas nunca foi exercitado
numa nota que tivesse desconto — as do Atacadão costumam ter. Conferir na
próxima e escrever o teste.

**Limitar o uso do `/api/nfce`.** O endpoint é aberto: só aceita endereços da
SEFAZ paulista, mas qualquer um pode consumi-lo e gastar cota da Vercel. Exigir
sessão resolveria.

## Quando virar produto pago

Assinatura, cobrança e o que vem junto ficam para a fase com desenvolvedor
dedicado. Dois degraus já conhecidos: o plano Hobby da Vercel é para uso não
comercial, e o plano gratuito do Supabase pausa o projeto após uma semana sem
acesso.
