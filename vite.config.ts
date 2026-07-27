import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fetchNfce, normalizeNfceInput } from './src/lib/nfce';

/**
 * Em produção quem atende /api/nfce é a função em `api/nfce.ts`. No
 * desenvolvimento não existe essa camada, então o próprio Vite responde —
 * usando exatamente o mesmo parser, para o que se testa aqui valer lá.
 */
function nfceDevApi(): Plugin {
  return {
    name: 'nfce-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/nfce', async (req, res) => {
        const send = (body: unknown, status = 200) => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };
        const input = new URL(req.url ?? '', 'http://localhost').searchParams.get('u');
        if (!input) return send({ error: 'Informe o link da nota.' }, 400);

        const url = normalizeNfceInput(input);
        if (!url) return send({ error: 'Link inválido. Use o endereço do QR Code da NFC-e paulista.' }, 400);

        try {
          send(await fetchNfce(url));
        } catch (error) {
          send({ error: (error as Error).message }, 502);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    nfceDevApi(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Controle de Supermercado',
        short_name: 'Mercado',
        description: 'Histórico de compras, preços e análises de supermercado',
        theme_color: '#16a34a',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        lang: 'pt-BR',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: { port: 5180 },
});
