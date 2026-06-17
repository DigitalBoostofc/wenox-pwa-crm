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

// Prova FORTE de cache velho pós-deploy: o servidor devolveu HTML (fallback do
// SPA) no lugar do .js, ou o module script falhou ao ser interpretado. Isso só
// acontece quando o chunk pedido não existe mais no servidor — nunca por um
// simples blip de rede (que dá "Failed to fetch", sem mismatch de MIME).
function ehMismatchDeCacheVelho(msg: string): boolean {
  return /Importing a module script failed|'text\/html'.*not a valid JavaScript MIME/i.test(msg);
}

// Decide se uma falha de import dinâmico é mesmo cache velho recuperável.
// Estreitado para NÃO disparar o wipe em falso-positivo (blip de rede/offline),
// preservando a recuperação genuína de chunk 404 pós-deploy.
async function deveRecuperar(msg: string): Promise<boolean> {
  if (!ehFalhaDeChunk(msg)) return false;
  // Offline: NUNCA limpe SW/caches. O wipe destrói a capacidade offline do PWA
  // e o location.reload() cai em tela branca (sem SW e sem rede). Um blip
  // transitório se resolve sozinho num retry — não é cache velho.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  // Mismatch de MIME = chunk inexistente no servidor → recupera direto.
  if (ehMismatchDeCacheVelho(msg)) return true;
  // Falha genérica de fetch pode ser só instabilidade de rede. Só tratamos como
  // cache velho se há de fato um SW novo instalado/aguardando (deploy ocorreu).
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    return !!(reg && (reg.waiting || reg.installing));
  } catch {
    return false;
  }
}

async function recuperarSeNecessario(msg: string) {
  if (await deveRecuperar(msg)) await recuperarDeCacheVelho();
}

window.addEventListener('error', (e) => {
  void recuperarSeNecessario(e.message ?? '');
});
window.addEventListener('unhandledrejection', (e) => {
  void recuperarSeNecessario(e.reason?.message ?? String(e.reason ?? ''));
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
