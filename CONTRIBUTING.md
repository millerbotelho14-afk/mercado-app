# Como trabalhar neste projeto

Guia curto para quem for mexer no código — inclusive o dono, que não é
desenvolvedor, e qualquer pessoa que chegue depois.

## Ambientes

São dois, e a diferença entre eles é o que evita estragar o app de quem usa.

| | Produção | Teste (preview) |
|---|---|---|
| Endereço | mercado-app-rellim.vercel.app | `mercado-<hash>-rellim.vercel.app` |
| Quem usa | usuários de verdade | só você |
| Sobe com | `npx vercel deploy --prod` | `npx vercel deploy` |
| Branch | `main` | qualquer outro |

## O ciclo de uma mudança

```bash
git checkout -b feature/nome-curto   # 1. branch separado
npm run dev                          # 2. desenvolve e testa local
npm run check                        # 3. tipos + testes
npx vercel deploy --yes              # 4. versão de teste, com endereço próprio
```

Satisfeito? Então:

```bash
git checkout main
git merge feature/nome-curto
git push                             # a CI roda sozinha aqui
npx vercel deploy --prod --yes
```

Se algo quebrar em produção, não corra para consertar no susto: na Vercel, em
*Deployments*, abra o anterior e clique em **Promote to Production**. Volta em
segundos. Conserte com calma depois.

## Regras que valem sempre

**Toda correção de bug ganha um teste.** É o que impede o mesmo erro de voltar.
Os testes em `src/lib/*.test.ts` são quase todos assim — cada um documenta um
problema real que já aconteceu.

**Não invente número.** Valor que veio da nota fiscal é o que a nota cobrou.
Somar `quantidade × preço` erra centavos e o total deixa de bater com o cupom.

**Preço unitário é a base de comparação**, e preço por quilo nunca se compara
com preço por unidade. Agrupar produtos só vale quando são realmente
equivalentes — vendidos a peso, ou embalagem padronizada.

**O dado original do cupom nunca é reescrito.** Correções de categoria, marca e
agrupamento vivem na tabela `overrides`, e por isso são reversíveis.

**Exclusão é marcada, não apagada** (`deleted: 1`). É o que faz a remoção viajar
para os outros aparelhos na sincronia.

**Quem protege os dados é o RLS**, não o código do navegador. Qualquer mudança
no schema tem de manter as políticas de `supabase/schema.sql`.

## Segredos

Nunca commite chave. O `.gitignore` já cobre `.env*`, `.vercel/` e `backup/`.
A chave publicável do Supabase é pública por natureza (roda no navegador); a
secreta, `service_role`, não entra em lugar nenhum deste repositório.

## Estilo

Sem ferramenta de formatação configurada — siga o que já está escrito: 2 espaços,
aspas simples, ponto e vírgula. Comentário explica **por quê**, não o quê; se o
código precisa de comentário para dizer o que faz, reescreva o código.

Textos de interface em português, do jeito que uma pessoa fala. "Mais caro que
qualquer compra anterior" é melhor do que "Preço acima do máximo histórico".
