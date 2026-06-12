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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
