import { useEffect, useState, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import {
  listMinhasNotificacoes, contarNaoLidas, marcarLida, marcarTodasLidas,
} from './notificacoesService';
import type { Notificacao } from './notificacoesService';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { haDias } from '@/clientes/format';
import { cn } from '@/lib/utils';

const ICONE_TIPO: Record<string, string> = {
  aprovacao: '✅', alteracao: '🔁', atribuicao: '👤', comentario: '💬', mencao: '📣',
};

export function NotificacoesBell({ compacta = false }: { compacta?: boolean }) {
  const history = useHistory();
  const [aberto, setAberto] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(false);

  const atualizarContador = useCallback(() => {
    contarNaoLidas().then(setNaoLidas);
  }, []);

  // Conta ao montar e a cada 60s.
  useEffect(() => {
    atualizarContador();
    const t = setInterval(atualizarContador, 60000);
    return () => clearInterval(t);
  }, [atualizarContador]);

  // Ao abrir, carrega a lista.
  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    listMinhasNotificacoes()
      .then(setItens)
      .finally(() => setCarregando(false));
  }, [aberto]);

  async function abrir(n: Notificacao) {
    if (!n.lida) {
      try { await marcarLida(n.id); } catch { /* */ }
      setItens((lst) => lst.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      atualizarContador();
    }
    setAberto(false);
    if (n.link) history.push(n.link);
  }

  async function lerTodas() {
    await marcarTodasLidas();
    setItens((lst) => lst.map((x) => ({ ...x, lida: true })));
    setNaoLidas(0);
  }

  return (
    <DropdownMenu open={aberto} onOpenChange={setAberto}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificações"
          className={cn('relative', !compacta && 'flex-1')}
        >
          <Bell />
          {naoLidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {naoLidas > 0 && (
            <button
              onClick={lerTodas}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" /> Marcar todas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {carregando ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : itens.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação.
            </p>
          ) : (
            itens.map((n) => (
              <button
                key={n.id}
                onClick={() => abrir(n)}
                className={cn(
                  'flex w-full gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-secondary',
                  !n.lida && 'bg-primary/5',
                )}
              >
                <span className="shrink-0 text-base leading-tight">
                  {ICONE_TIPO[n.tipo ?? ''] ?? '🔔'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm', !n.lida && 'font-medium')}>
                    {n.titulo}
                  </span>
                  {n.mensagem && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {n.mensagem}
                    </span>
                  )}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {haDias(n.created)}
                  </span>
                </span>
                {!n.lida && (
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                )}
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
