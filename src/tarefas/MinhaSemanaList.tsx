import { useState } from 'react';
import { ChevronDown, ChevronRight, ListChecks, UserRound } from 'lucide-react';
import type { Tarefa } from './types';
import { statusTarefaClass, tarefaConcluida, prazoVencido } from './format';
import { corAvatar, dataBR } from '@/clientes/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Helpers de avatar (copiado do padrão de TarefaCard)                       */
/* -------------------------------------------------------------------------- */

function iniciais(n?: string): string {
  const t = (n ?? '?').trim();
  const partes = t.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return t.charAt(0).toUpperCase() || '?';
}

function responsaveis(t: Tarefa): { id: string; nome: string }[] {
  if (t.lado === 'cliente') {
    const c = t.expand?.contato;
    return c ? [{ id: c.id, nome: c.nome ?? '—' }] : [];
  }
  return (t.expand?.responsaveis ?? []).map((r) => ({
    id: r.id,
    nome: r.nome ?? r.email ?? '—',
  }));
}

/* -------------------------------------------------------------------------- */
/*  Helpers de datas                                                           */
/* -------------------------------------------------------------------------- */

function dataHoje(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Retorna o domingo seguinte ao hoje (ou hoje se for domingo). */
function domingoSemana(): Date {
  const d = dataHoje();
  const diasAte = 7 - d.getDay(); // 0 = domingo → 7 dias
  d.setDate(d.getDate() + (d.getDay() === 0 ? 0 : diasAte));
  return d;
}

function parsePrazo(prazo?: string): Date | null {
  if (!prazo) return null;
  const d = new Date(prazo.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

type Secao = 'atrasadas' | 'hoje' | 'semana' | 'depois' | 'semprazo' | 'concluidas';

function secaoDaTarefa(t: Tarefa): Secao {
  if (tarefaConcluida(t.status)) return 'concluidas';
  const prazo = parsePrazo(t.prazo);
  if (!prazo) return 'semprazo';
  const hoje = dataHoje();
  const domingo = domingoSemana();
  if (prazo.getTime() < hoje.getTime()) return 'atrasadas';
  if (prazo.getTime() === hoje.getTime()) return 'hoje';
  if (prazo.getTime() <= domingo.getTime()) return 'semana';
  return 'depois';
}

/* -------------------------------------------------------------------------- */
/*  Tipos e configuração das seções                                            */
/* -------------------------------------------------------------------------- */

interface ConfigSecao {
  id: Secao;
  titulo: string;
  destructive?: boolean;
  recolhidaInicial?: boolean;
}

const SECOES: ConfigSecao[] = [
  { id: 'atrasadas', titulo: 'Atrasadas', destructive: true },
  { id: 'hoje', titulo: 'Hoje' },
  { id: 'semana', titulo: 'Esta semana' },
  { id: 'depois', titulo: 'Depois' },
  { id: 'semprazo', titulo: 'Sem prazo' },
  { id: 'concluidas', titulo: 'Concluídas', recolhidaInicial: true },
];

/* -------------------------------------------------------------------------- */
/*  Componente de linha                                                        */
/* -------------------------------------------------------------------------- */

function LinhaCheckbox({
  concluida, otimista, onToggle,
}: {
  concluida: boolean;
  otimista: boolean;
  onToggle: () => void;
}) {
  const marcada = concluida || otimista;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={marcada ? 'Reabrir tarefa' : 'Concluir tarefa'}
      className={cn(
        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        marcada
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-border hover:border-emerald-400',
      )}
    >
      {marcada && (
        <svg viewBox="0 0 10 10" className="size-3 stroke-current" fill="none" strokeWidth={2}>
          <polyline points="2,5 4.5,7.5 8,3" />
        </svg>
      )}
    </button>
  );
}

function LinhaTarefa({
  t, onAbrir, onConcluir, onReabrir,
}: {
  t: Tarefa;
  onAbrir: (id: string) => void;
  onConcluir: (id: string) => void;
  onReabrir: (id: string) => void;
}) {
  const [otimista, setOtimista] = useState(false);
  const concluida = tarefaConcluida(t.status);
  const vencida = prazoVencido(t.prazo, t.status);
  const resps = responsaveis(t);

  // Contexto: projeto > cliente > 'Interna'
  const contexto = t.expand?.projeto?.nome
    ?? t.expand?.cliente?.nome_fantasia
    ?? t.expand?.cliente?.nome
    ?? (t.projeto || t.cliente ? undefined : 'Interna');

  function handleToggle() {
    setOtimista((v) => !v);
    if (concluida) {
      onReabrir(t.id);
    } else {
      onConcluir(t.id);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAbrir(t.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAbrir(t.id); }}
      className={cn(
        'flex cursor-pointer flex-wrap items-start gap-2 rounded-md px-2 py-2.5 text-sm',
        'transition-colors hover:bg-secondary/60',
        (concluida || otimista) && 'opacity-60',
      )}
    >
      {/* Checkbox */}
      <LinhaCheckbox concluida={concluida} otimista={otimista} onToggle={handleToggle} />

      {/* Nome + contexto */}
      <div className="min-w-0 flex-1">
        <span className={cn(
          'block font-medium leading-snug',
          (concluida || otimista) && 'line-through',
        )}>
          {t.nome}
        </span>
        {contexto && (
          <span className="block text-xs text-muted-foreground">{contexto}</span>
        )}
      </div>

      {/* Badges + prazo + avatares */}
      <div className="flex flex-wrap items-center gap-2">
        {t.status && (
          <Badge className={cn('border text-[10px]', statusTarefaClass(t.status))}>
            {t.status}
          </Badge>
        )}

        {t.prazo && (
          <span className={cn(
            'text-[11px]',
            vencida ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}>
            {dataBR(t.prazo)}
          </span>
        )}

        {/* Avatares dos responsáveis */}
        <div className="flex -space-x-2">
          {resps.length === 0 ? (
            <span className="grid size-6 place-items-center rounded-full border-2 border-card bg-secondary text-muted-foreground">
              <UserRound className="size-3" />
            </span>
          ) : (
            resps.slice(0, 3).map((r) => (
              <div
                key={r.id}
                title={r.nome}
                className={cn(
                  'grid size-6 place-items-center rounded-full border-2 border-card text-[9px] font-bold text-white',
                  corAvatar(r.nome),
                )}
              >
                {iniciais(r.nome)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Componente de seção                                                        */
/* -------------------------------------------------------------------------- */

function SecaoTarefas({
  config, tarefas, onAbrir, onConcluir, onReabrir,
}: {
  config: ConfigSecao;
  tarefas: Tarefa[];
  onAbrir: (id: string) => void;
  onConcluir: (id: string) => void;
  onReabrir: (id: string) => void;
}) {
  const [aberta, setAberta] = useState(!config.recolhidaInicial);

  return (
    <div className="flex flex-col">
      {/* Cabeçalho */}
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide',
          config.destructive ? 'text-destructive' : 'text-muted-foreground',
          'hover:text-foreground transition-colors',
        )}
      >
        {aberta
          ? <ChevronDown className="size-3.5" />
          : <ChevronRight className="size-3.5" />}
        <span>{config.titulo}</span>
        <span className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
          config.destructive
            ? 'bg-destructive/15 text-destructive'
            : 'bg-secondary text-muted-foreground',
        )}>
          {tarefas.length}
        </span>
      </button>

      {/* Linhas */}
      {aberta && (
        <div className="flex flex-col divide-y divide-border/40">
          {tarefas.map((t) => (
            <LinhaTarefa
              key={t.id}
              t={t}
              onAbrir={onAbrir}
              onConcluir={onConcluir}
              onReabrir={onReabrir}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Componente principal                                                       */
/* -------------------------------------------------------------------------- */

export function MinhaSemanaList({
  tarefas,
  onAbrir,
  onConcluir,
  onReabrir,
}: {
  tarefas: Tarefa[];
  onAbrir: (id: string) => void;
  onConcluir: (id: string) => void;
  onReabrir: (id: string) => void;
}) {
  const grupos = new Map<Secao, Tarefa[]>();
  for (const cfg of SECOES) grupos.set(cfg.id, []);
  for (const t of tarefas) {
    grupos.get(secaoDaTarefa(t))!.push(t);
  }

  const secoesVisiveis = SECOES.filter((cfg) => (grupos.get(cfg.id)?.length ?? 0) > 0);

  if (secoesVisiveis.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <ListChecks className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma tarefa neste filtro.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-border/40">
      {secoesVisiveis.map((cfg) => (
        <SecaoTarefas
          key={cfg.id}
          config={cfg}
          tarefas={grupos.get(cfg.id)!}
          onAbrir={onAbrir}
          onConcluir={onConcluir}
          onReabrir={onReabrir}
        />
      ))}
    </Card>
  );
}
