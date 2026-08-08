# Controle de Supermercado

[![CI](https://github.com/millerbotelho14-afk/mercado-app/actions/workflows/ci.yml/badge.svg)](https://github.com/millerbotelho14-afk/mercado-app/actions/workflows/ci.yml)

App de controle de compras de mercado. Você cola o link do QR Code do cupom
fiscal e a compra entra inteira — item por item, já categorizada. Com o tempo,
o histórico responde o que a memória não responde: **isto está caro? onde
custava menos?**

No ar em <https://mercado-app-rellim.vercel.app>

## O que ele faz

- **Importa a nota fiscal pelo QR Code.** A compra entra completa, sem digitação.
- **Histórico de preço por produto e por loja**, com aviso quando o item está
  acima da média ou no menor preço já pago.
- **Compara mercados** para o mesmo produto, respeitando preço por quilo.
- **Funciona offline** e instala no celular como aplicativo (PWA).
- **Cada pessoa tem a sua conta**, com sincronia entre celular e computador.

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev
```

Abre em <http://localhost:5180> e também na rede local, então dá para testar no
celular pelo endereço `http://SEU-IP:5180` sem publicar nada.

Sem as variáveis do Supabase o app sobe, mas a tela de login avisa que faltam as
chaves — todo o resto depende de estar autenticado.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | desenvolvimento, com recarga automática |
| `npm run check` | tipos + testes — rode antes de subir qualquer coisa |
| `npm test` | só os testes |
| `npm run build` | build de produção |
| `npx vercel deploy` | publica uma versão de teste, com endereço próprio |
| `npx vercel deploy --prod` | publica em produção |

## Documentação

| Documento | Para quê |
|---|---|
| [CONTEXTO-DO-PROJETO.md](CONTEXTO-DO-PROJETO.md) | visão do produto e regras de negócio, para quem chega agora |
| [CONTRIBUTING.md](CONTRIBUTING.md) | o ciclo de trabalho e as regras do domínio |
| [docs/arquitetura.md](docs/arquitetura.md) | como funciona por dentro e por que assim |
| [docs/operacao.md](docs/operacao.md) | serviços, ambientes, deploy, segurança |
| [docs/backlog.md](docs/backlog.md) | o que ficou para depois, e por quê |

## Tecnologia

React + TypeScript + Vite no navegador, Dexie (IndexedDB) para os dados locais,
Supabase para contas e sincronia, e uma única função de servidor
(`api/nfce.ts`) que existe só porque a SEFAZ não manda cabeçalho CORS.

Não há servidor de aplicação: o app é estático e fala direto com o Supabase.
Quem garante que ninguém lê os dados de outro é o RLS, não o código do cliente.

## Próximos passos

O que ficou para depois, com o motivo de cada adiamento, está em
[docs/backlog.md](docs/backlog.md).
