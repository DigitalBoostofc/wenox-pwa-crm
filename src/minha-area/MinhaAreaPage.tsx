import { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import type { Role } from '@/auth/perms';
import { DadosAgenciaProvider } from '@/dashboard/useDadosAgencia';
import { HeaderSlot } from '@/components/layout/HeaderSlot';
import { cn } from '@/lib/utils';
import { MinhaProdutividadeBloco } from './blocos';
import { MinhasTarefasBloco } from './blocosTarefas';
import { MinhasTarefasLista } from './MinhasTarefasLista';

const ROLES_COMPLETOS = new Set(['Owner', 'Admin', 'Gestor', 'Membro']);

type Visao = 'card' | 'lista';
const VIEW_KEY = 'wenox-minha-area-view-v1';
function carregarVisao(): Visao {
  try { const s = localStorage.getItem(VIEW_KEY); if (s === 'card' || s === 'lista') return s; } catch { /* */ }
  return 'card';
}

function BotaoVisao({ ativo, onClick, icon: Icon, label }: {
  ativo: boolean; onClick: () => void; icon: typeof List; label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={ativo}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
        ativo ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary',
      )}
    >
      <Icon className="size-4" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

export function MinhaAreaPage() {
  const { user } = useAuth();
  const [visao, setVisao] = useState<Visao>(carregarVisao);
  if (!user) return null;

  const role = user.role as Role;
  const completo = ROLES_COMPLETOS.has(role);
  const somenteLeitura = role === 'Visualizador';

  function trocar(v: Visao) {
    setVisao(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* */ }
  }

  return (
    <DadosAgenciaProvider>
      <HeaderSlot>
        <div className="flex flex-1 justify-end">
          <div className="flex items-center gap-1 rounded-md border border-border bg-background/40 p-1">
            <BotaoVisao ativo={visao === 'card'} onClick={() => trocar('card')} icon={LayoutGrid} label="Card" />
            <BotaoVisao ativo={visao === 'lista'} onClick={() => trocar('lista')} icon={List} label="Lista" />
          </div>
        </div>
      </HeaderSlot>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {visao === 'card' ? (
          <>
            <MinhasTarefasBloco somenteLeitura={somenteLeitura} />
            {completo && <MinhaProdutividadeBloco />}
          </>
        ) : (
          <MinhasTarefasLista somenteLeitura={somenteLeitura} />
        )}
      </div>
    </DadosAgenciaProvider>
  );
}
