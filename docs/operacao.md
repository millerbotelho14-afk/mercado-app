# Operação

Serviços, ambientes, deploy e segurança do que está no ar.

## Para quem for assumir o projeto

**Serviços envolvidos.** Três, todos no plano gratuito:

| Serviço | Papel | Onde |
|---|---|---|
| Vercel | hospeda o site e a função `/api/nfce` | projeto `rellim/mercado-app` |
| Supabase | contas, banco na nuvem para a sincronia | projeto `tpttfhkmuneecflsncja` |
| SEFAZ-SP | fonte das notas fiscais (consulta pública) | sem cadastro |

**O que precisa estar configurado:**

1. `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_KEY` (veja `.env.example`).
2. As mesmas duas variáveis na Vercel, em *Settings → Environment Variables*.
3. O `supabase/schema.sql` rodado uma vez no SQL Editor do Supabase (tabelas,
   índices, triggers e as políticas de RLS).
4. Em *Authentication → URL Configuration*, a URL de produção em **Site URL** e
   **Redirect URLs**, senão o link de confirmação de e-mail aponta para
   `localhost`.

**Deploy:**

```bash
npx vercel deploy --prod --yes
```

**Onde o estado vive.** Não há servidor de aplicação: o app é estático e fala
direto com o Supabase pelo navegador. Quem garante que ninguém lê os dados de
outro é o RLS (`auth.uid() = user_id`), não o código do cliente — qualquer
mudança de schema precisa manter as políticas. A única peça de servidor é
`api/nfce.ts`, que existe só porque a SEFAZ não manda cabeçalho CORS.

**Dívidas conhecidas:**

- Não há testes automatizados. As verificações desta fase foram manuais.
- O bundle passa de 900 KB, quase todo Recharts. Trocar por SVG próprio nos dois
  gráficos derrubaria isso bem.
- `/api/nfce` é aberto: limitado ao domínio da SEFAZ, mas sem exigir sessão nem
  limite de requisições por origem.
- O parser de desconto da nota foi escrito olhando o padrão da página, mas nunca
  foi exercitado numa nota que tivesse desconto.
- A confirmação de e-mail usa o remetente padrão do Supabase, que é limitado e
  documentado como só para testes. Para vários usuários, configurar SMTP próprio.

Para gerar a versão de produção (é ela que vira o app instalável):

```bash
npm run build
```

## Segurança do site publicado

`vercel.json` define os cabeçalhos. O mais importante é o **CSP**: o app só pode
falar com ele mesmo e com o Supabase. Com `connect-src` fechado, um script
injetado não consegue mandar os seus dados para outro lugar. Junto vão HSTS,
`nosniff`, `frame-ancestors: none` (contra clickjacking) e Permissions-Policy
bloqueando câmera, microfone e localização.

O arquivo é JSON validado por schema — **não aceita campos extras**, nem um
`comment`. Se precisar explicar alguma regra, é aqui, não lá.

O endpoint `/api/nfce` é público. Ele só aceita endereços de `fazenda.sp.gov.br`,
não segue redirecionamento (senão a checagem de domínio viraria decoração), tem
prazo de 15s e teto de 2 MB.

## Como testar uma mudança antes de subir para produção

Três camadas, da mais rápida para a mais próxima do real. Use a mais barata que
responda a sua dúvida.

**1. Na sua máquina** — o laço mais curto, e onde 90% das dúvidas se resolvem:

```bash
git checkout -b feature/nome-da-mudanca
npm run dev
```

Abre em <http://localhost:5180> e também na rede local, então dá para testar no
celular pelo endereço `http://SEU-IP:5180` sem publicar nada.

**2. Conferir se compila** — pega erro de tipo antes de a Vercel pegar:

```bash
npm run build
```

**3. Publicar uma versão de teste** — mesma infraestrutura da produção, endereço
próprio, sem tocar no site que está no ar:

```bash
npx vercel deploy --yes
```

Devolve uma URL do tipo `mercado-<hash>-rellim.vercel.app`. Ela é independente:
você abre, testa no celular, manda para alguém ver. A produção continua intacta.

**Subir para produção**, quando estiver satisfeito:

```bash
git checkout main
git merge feature/nome-da-mudanca
git push
npx vercel deploy --prod --yes
```

> **Atenção — a versão de teste usa o banco de verdade.** As variáveis de
> ambiente de Preview apontam para o mesmo projeto Supabase da produção. Testar
> a interface é seguro; **cadastrar, importar ou excluir compras numa versão de
> teste mexe nos seus dados reais**, e uma alteração no schema afeta o site no
> ar na hora.
>
> Enquanto for uso pessoal, dá para conviver com isso tomando cuidado. Se o app
> crescer ou entrar outra pessoa mexendo, crie um segundo projeto no Supabase
> (o plano gratuito permite dois), rode o `supabase/schema.sql` nele e aponte as
> variáveis de Preview para lá:
>
> ```bash
> npx vercel env rm VITE_SUPABASE_URL preview
> printf 'https://PROJETO-DE-TESTE.supabase.co' | npx vercel env add VITE_SUPABASE_URL preview
> ```

**Se der errado em produção**, a Vercel guarda todos os deploys: em *Deployments*,
abra o anterior e use *Promote to Production*. Volta em segundos, sem precisar
mexer no código.

## Backup

Aba **Histórico** → Exportar JSON. O arquivo sai no mesmo formato do MVP, então
continua legível fora do app. A importação ignora compras que já existem (mesma
loja, data e valor), então reimportar o mesmo arquivo não duplica nada.
