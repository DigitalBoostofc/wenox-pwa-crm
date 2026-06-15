import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { AuthProvider } from '@/auth/AuthContext';
import './index.css';

// Service worker com auto-update: além de assumir no carregamento, verifica
// se há versão nova a cada 60s (e ao voltar o foco à aba). Com registerType
// 'autoUpdate' (vite.config), a versão nova entra sozinha — sem refresh manual.
const VERIFICA_MS = 60_000;
const atualizarSW = registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    setInterval(() => { registration.update(); }, VERIFICA_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  },
});
void atualizarSW;

// Auto-recuperação de cache velho: quando o app fica com uma versão antiga em
// cache (Service Worker), os "pedaços" de código (chunks JS carregados sob
// demanda via import()) apontam para arquivos que já não existem no servidor
// após um deploy → o import falha (404) e a tela quebra/fica lenta. Aqui
// detectamos essa falha específica, limpamos SW + caches do APP (não toca em
// imagens/CDN) e recarregamos UMA vez. O guard em sessionStorage evita loop.
async function recuperarDeCacheVelho() {
  if (sessionStorage.getItem('wenox-sw-recuperado')) return; // já tentou nesta sessão
  sessionStorage.setItem('wenox-sw-recuperado', '1');
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    if (regs) for (const r of regs) await r.unregister();
    const keys = await caches?.keys?.();
    if (keys) for (const k of keys) await caches.delete(k);
  } catch { /* segue pro reload de qualquer forma */ }
  location.reload();
}

function ehFalhaDeChunk(msg: string): boolean {
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|'text\/html'.*not a valid JavaScript MIME/i.test(msg);
}

window.addEventListener('error', (e) => {
  if (ehFalhaDeChunk(e.message ?? '')) void recuperarDeCacheVelho();
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = (e.reason?.message ?? String(e.reason ?? ''));
  if (ehFalhaDeChunk(msg)) void recuperarDeCacheVelho();
});

// Captura o convite de instalação cedo (pode disparar antes do React montar).
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as unknown as { deferredInstallPrompt?: Event }).deferredInstallPrompt = e;
  window.dispatchEvent(new Event('wenox-installable'));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
