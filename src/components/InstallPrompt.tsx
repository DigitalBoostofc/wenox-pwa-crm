import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Banner de "Instalar app" — aparece só no celular, quando o app é
 *  instalável (Android/Chrome) ou com instruções no iPhone (Safari).
 *  O evento `beforeinstallprompt` é capturado cedo em main.tsx e guardado
 *  em window.deferredInstallPrompt (pode disparar antes do React montar). */
function ehMobile() {
  return window.matchMedia('(max-width: 820px)').matches || window.matchMedia('(pointer: coarse)').matches;
}
function jaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
function getBip(): BIPEvent | null {
  return (window as unknown as { deferredInstallPrompt?: BIPEvent }).deferredInstallPrompt ?? null;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    if (jaInstalado() || !ehMobile()) return;
    try { if (sessionStorage.getItem('wenox-install-x') === '1') { setFechado(true); return; } } catch { /* */ }

    // já capturado antes do React montar?
    if (getBip()) setDeferred(getBip());

    const onBIP = (e: Event) => { e.preventDefault(); (window as unknown as { deferredInstallPrompt?: Event }).deferredInstallPrompt = e; setDeferred(e as BIPEvent); };
    const onReady = () => { if (getBip()) setDeferred(getBip()); };
    const onInstalled = () => { setDeferred(null); setIosHint(false); };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('wenox-installable', onReady);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari não dispara beforeinstallprompt → instruções manuais
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|chrome|android/i.test(ua);
    if (isIOS && isSafari) setIosHint(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('wenox-installable', onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dispensar() {
    setFechado(true);
    try { sessionStorage.setItem('wenox-install-x', '1'); } catch { /* */ }
  }

  async function instalar() {
    const ev = deferred ?? getBip();
    if (!ev) return;
    await ev.prompt();
    try { await ev.userChoice; } catch { /* */ }
    (window as unknown as { deferredInstallPrompt?: Event }).deferredInstallPrompt = undefined;
    setDeferred(null);
  }

  if (fechado || (!deferred && !iosHint)) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur">
      <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">Instalar o Wenox OS</p>
        {deferred ? (
          <p className="mt-0.5 text-xs text-muted-foreground">Adicione o ícone à tela inicial do celular.</p>
        ) : (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Toque em <Share className="inline size-3.5 -translate-y-px" /> e depois em “Adicionar à Tela de Início”.
          </p>
        )}
      </div>
      {deferred && (
        <button onClick={instalar} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          <Download className="size-4" /> Instalar
        </button>
      )}
      <button onClick={dispensar} aria-label="Fechar" className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary"><X className="size-4" /></button>
    </div>
  );
}
