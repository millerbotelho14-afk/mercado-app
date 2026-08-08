import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyStoredTheme } from './lib/theme';
import './styles.css';

// Antes do React montar, senão a tela pisca branca no modo escuro.
applyStoredTheme();

/**
 * O app é um PWA: o service worker guarda a versão anterior para funcionar
 * offline. O efeito colateral é que, depois de uma publicação, a aba aberta
 * continua na versão velha até alguém recarregar — e ninguém recarrega.
 *
 * Quando a versão nova assume o controle, recarregamos uma vez. A trava evita
 * o laço de recarga infinita se algo der errado na troca.
 */
if ('serviceWorker' in navigator) {
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
