import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * O `vercel.json` não é código, mas quebra o app de dois jeitos que já
 * aconteceram — e nenhum deles aparece rodando o app localmente:
 *
 * 1. Campo fora do schema derruba o deploy inteiro ("should NOT have
 *    additional property `comment`").
 * 2. Host de Supabase faltando no `connect-src` faz o navegador bloquear o
 *    login com um "Failed to fetch" sem explicação — foi o que aconteceu no
 *    ambiente de teste, que fala com um projeto diferente da produção.
 */
const config = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf-8'));

const CABECALHOS: Array<{ key: string; value: string }> = config.headers.flatMap(
  (regra: { headers: Array<{ key: string; value: string }> }) => regra.headers,
);

function cabecalho(nome: string): string {
  const achado = CABECALHOS.find((h) => h.key.toLowerCase() === nome.toLowerCase());
  if (!achado) throw new Error(`cabeçalho ausente: ${nome}`);
  return achado.value;
}

/** Projetos Supabase que o app usa. Ambiente novo entra aqui e no connect-src. */
const PROJETOS_SUPABASE = [
  'tpttfhkmuneecflsncja', // produção
  'hsmwaqpgxzqypzaiqewu', // teste
];

describe('vercel.json', () => {
  it('só usa campos que o schema da Vercel aceita', () => {
    const permitidos = new Set(['key', 'value']);
    for (const h of CABECALHOS) {
      expect(Object.keys(h).every((k) => permitidos.has(k))).toBe(true);
    }
  });

  it.each(PROJETOS_SUPABASE)('autoriza o navegador a falar com o projeto %s', (projeto) => {
    const csp = cabecalho('Content-Security-Policy');
    const connect = csp.split(';').find((d) => d.trim().startsWith('connect-src'))!;
    expect(connect).toContain(`https://${projeto}.supabase.co`);
    expect(connect).toContain(`wss://${projeto}.supabase.co`);
  });

  it('mantém as travas que não dependem de ambiente', () => {
    const csp = cabecalho('Content-Security-Policy');
    expect(csp).toContain("frame-ancestors 'none'"); // clickjacking
    expect(csp).toContain("object-src 'none'");
    expect(cabecalho('X-Content-Type-Options')).toBe('nosniff');
    expect(cabecalho('X-Frame-Options')).toBe('DENY');
  });
});
