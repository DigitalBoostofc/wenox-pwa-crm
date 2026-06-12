import { ArrowDown, ArrowUp, CalendarDays, FolderKanban, Repeat, UserRound } from 'lucide-react';
import type { Tarefa } from './types';
import { statusTarefaClass, prazoVencido, LADO_LABEL } from './format';
import { corAvatar, dataBR } from '@/clientes/format';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function iniciais(n?: string): string {
  const t = (n ?? '?').trim();
  const partes = t.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return t.charAt(0).toUpperCase() || '?';
}

/** Nomes de quem responde pela tarefa (equipe Wenox ou contato do cliente). */
export function responsaveisTarefa(t: Tarefa): { id: string; nome: string }[] {
  if (t.lado === 'cliente') {
    const c = t.expand?.contato;
    return c ? [{ id: c.id, nome: c.nome ?? '—' }] : [];
  }
  return (t.expand?.responsaveis ?? []).map((r) => ({
    id: r.id,
    nome: r.nome ?? r.email ?? '—',
  }));
}

export function TarefaCard({
  t, onClick, draggable, arrastando, mostrarProjeto = true,
}: {
  t: Tarefa;
  onClick: () => void;
  draggable?: boolean;
  arrastando?: boolean;
  mostrarProjeto?: boolean;
}) {
  const resps = responsaveisTarefa(t);
  const vencida = prazoVencido(t.prazo, t.status);
  const projetoNome = t.expand?.projeto?.nome;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData('text/tarefa-id', t.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        'group flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/40',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        arrastando && 'opacity-50',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(t.etiquetas ?? []).slice(0, 3).map((e) => (
            <Badge key={e} variant="muted" className="text-[10px]">{e}</Badge>
          ))}
        </div>
        {t.lado && (
          <Badge
            variant={t.lado === 'cliente' ? 'warning' : 'muted'}
            className="text-[10px]"
          >
            {LADO_LABEL[t.lado]}
          </Badge>
        )}
      </div>

      <h3 className="flex items-center gap-1 text-sm font-semibold leading-tight">
        {t.prioridade === 'alta' && (
          <span title="Prioridade alta" aria-label="Prioridade alta" className="shrink-0">
            <ArrowUp className="size-3.5 text-orange-500" />
          </span>
        )}
        {t.prioridade === 'baixa' && (
          <span title="Prioridade baixa" aria-label="Prioridade baixa" className="shrink-0">
            <ArrowDown className="size-3.5 text-muted-foreground/60" />
          </span>
        )}
        {t.nome}
      </h3>

      {mostrarProjeto && projetoNome && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FolderKanban className="size-3.5 shrink-0" />
          <span className="truncate">{projetoNome}</span>
        </p>
      )}

      <div className="mt-0.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {t.prazo && (
            <span className={cn(
              'inline-flex items-center gap-1 text-[11px]',
              vencida ? 'font-medium text-destructive' : 'text-muted-foreground',
            )}>
              <CalendarDays className="size-3.5" />
              {dataBR(t.prazo)}
            </span>
          )}
          {(t.checklist ?? []).length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              ✓ {(t.checklist ?? []).filter((i) => i.feito).length}/{(t.checklist ?? []).length}
            </span>
          )}
          {t.recorrencia && (
            <span title={`Repete: ${t.recorrencia}`} className="text-muted-foreground">
              <Repeat className="size-3.5" />
            </span>
          )}
        </div>
        <div className="flex -space-x-2">
          {resps.length === 0 ? (
            <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-muted-foreground">
              <UserRound className="size-3.5" />
            </span>
          ) : (
            resps.slice(0, 3).map((r) => (
              <div
                key={r.id}
                title={r.nome}
                className={cn(
                  'grid size-7 place-items-center rounded-full border-2 border-card text-[10px] font-bold text-white',
                  corAvatar(r.nome),
                )}
              >
                {iniciais(r.nome)}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {t.status && (
          <Badge className={cn('w-fit border text-[10px]', statusTarefaClass(t.status))}>
            {t.status}
          </Badge>
        )}
        {t.aprovacao === 'aprovada' && (
          <Badge className="w-fit border border-emerald-500/50 bg-emerald-500/15 text-[10px] text-emerald-400">
            ✓ Aprovada
          </Badge>
        )}
        {t.aprovacao === 'alteracao' && (
          <Badge className="w-fit border border-destructive/50 bg-destructive/15 text-[10px] text-destructive">
            ↻ Alteração
          </Badge>
        )}
      </div>
    </div>
  );
}
