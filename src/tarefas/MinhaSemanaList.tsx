import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ListChecks, Repeat, UserRound } from 'lucide-react';
import type { Tarefa } from './types';
import { statusTarefaClass, tarefaConcluida, prazoVencido } from './format';
import { corAvatar, dataBR } from '@/clientes/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type TipoAgrupamento = 'prazo' | 'responsavel' | 'projeto' | 'cliente' | 'status';

/* -------------------------------------------------------------------------- */
/*  Helpers de avatar                                                          */
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
/*  Helpers de datas — parse via partes para evitar desvio de fuso horário    */
/* -------------------------------------------------------------------------- */

function dataHoje(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function domingoSemana(): Date {
  const d = dataHoje();
  d.setDate(d.getDate() + (d.getDay() === 0 ? 0 : 7 - d.getDay()));
  return d;
}

export function parsePrazo(prazo?: string): Date | null {
  if (!prazo) return null;
  const ymd = prazo.slice(0, 10);
  const partes = ymd.split('-').map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
  return new Date(partes[0], partes[1] - 1, partes[2]);
}

/* -------------------------------------------------------------------------- */
/*  Ordenação: alta → média/sem → baixa, empate por prazo crescente           */
/* -------------------------------------------------------------------------- */

function pesoPrioridade(p?: string): number {
  if (p === 'alta') return 0;
  if (p === 'baixa') return 2;
  return 1;
}

function ordenarSecao(tarefas: Tarefa[]): Tarefa[] {
  return [...tarefas].sort((a, b) => {
    const dp = pesoPrioridade(a.prioridade) - pesoPrioridade(b.prioridade);
    if (dp !== 0) return dp;
    const pa = parsePrazo(a.prazo)?.getTime() ?? Infinity;
    const pb = parsePrazo(b.prazo)?.getTime() ?? Infinity;
    return pa - pb;
  });
}

/* -------------------------------------------------------------------------- */
/*  Config de seção genérica                                                   */
/* -------------------------------------------------------------------------- */

interface ConfigSecaoGen {
  chave: string;
  titulo: string;
  /** Seção "Atrasadas" do modo prazo — cabeçalho em destructive. */
  destructive?: boolean;
  /** Seções de fallback "sem X" — estilo tracejado. */
  tracejado?: boolean;
  recolhidaInicial?: boolean;
  /** Modos não-prazo: número de tarefas com prazo vencido (badge destructive). */
  atrasadas?: number;
}

/* -------------------------------------------------------------------------- */
/*  Agrupamentos                                                               */
/* -------------------------------------------------------------------------- */

// ---- prazo ----

type SecaoPrazo = 'atrasadas' | 'hoje' | 'semana' | 'depois' | 'semprazo' | 'concluidas';

const SECOES_PRAZO: { id: SecaoPrazo; titulo: string; destructive?: boolean; recolhidaInicial?: boolean }[] = [
  { id: 'atrasadas', titulo: 'Atrasadas', destructive: true },
  { id: 'hoje', titulo: 'Hoje' },
  { id: 'semana', titulo: 'Esta semana' },
  { id: 'depois', titulo: 'Depois' },
  { id: 'semprazo', titulo: 'Sem prazo' },
  { id: 'concluidas', titulo: 'Concluídas', recolhidaInicial: true },
];

function secaoPrazo(t: Tarefa): SecaoPrazo {
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

function construirGruposPrazo(tarefas: Tarefa[]): { cfg: ConfigSecaoGen; lista: Tarefa[] }[] {
  const map = new Map<SecaoPrazo, Tarefa[]>();
  for (const s of SECOES_PRAZO) map.set(s.id, []);
  for (const t of tarefas) map.get(secaoPrazo(t))!.push(t);

  return SECOES_PRAZO
    .filter((s) => (map.get(s.id)?.length ?? 0) > 0)
    .map((s) => ({
      cfg: { chave: s.id, titulo: s.titulo, destructive: s.destructive, recolhidaInicial: s.recolhidaInicial },
      lista: map.get(s.id)!,
    }));
}

// ---- helpers compartilhados para modos não-prazo ----

function contarAtrasadas(tarefas: Tarefa[]): number {
  return tarefas.filter((t) => prazoVencido(t.prazo, t.status)).length;
}

// ---- responsavel ----

function construirGruposResponsavel(tarefas: Tarefa[]): Array<{ cfg: ConfigSecaoGen; lista: Tarefa[] }> {
  const abertas = tarefas.filter((t) => !tarefaConcluida(t.status));
  const map = new Map<string, { nome: string; lista: Tarefa[] }>();
  const semResp: Tarefa[] = [];

  for (const t of abertas) {
    const resps = responsaveis(t);
    if (resps.length === 0) {
      semResp.push(t);
    } else {
      for (const r of resps) {
        if (!map.has(r.id)) map.set(r.id, { nome: r.nome, lista: [] });
        map.get(r.id)!.lista.push(t);
      }
    }
  }

  const grupos: Array<{ cfg: ConfigSecaoGen; lista: Tarefa[] }> = [...map.entries()]
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR'))
    .map(([chave, { nome, lista }]) => ({
      cfg: { chave, titulo: nome, atrasadas: contarAtrasadas(lista) },
      lista,
    }));

  if (semResp.length > 0) {
    grupos.push({
      cfg: {
        chave: '__sem_responsavel',
        titulo: '⚠ Sem responsável',
        tracejado: true,
        atrasadas: contarAtrasadas(semResp),
      },
      lista: semResp,
    });
  }

  return grupos;
}

// ---- projeto ----

function construirGruposProjeto(tarefas: Tarefa[]): Array<{ cfg: ConfigSecaoGen; lista: Tarefa[] }> {
  const abertas = tarefas.filter((t) => !tarefaConcluida(t.status));
  const map = new Map<string, { titulo: string; lista: Tarefa[] }>();
  const internas: Tarefa[] = [];

  for (const t of abertas) {
    const proj = t.expand?.projeto;
    if (!proj) {
      internas.push(t);
      continue;
    }
    const chave = proj.id;
    if (!map.has(chave)) {
      const cli = t.expand?.cliente;
      const nomeCliente = cli?.nome_fantasia ?? cli?.nome;
      const titulo = nomeCliente ? `${proj.nome} — ${nomeCliente}` : (proj.nome ?? chave);
      map.set(chave, { titulo, lista: [] });
    }
    map.get(chave)!.lista.push(t);
  }

  const grupos: Array<{ cfg: ConfigSecaoGen; lista: Tarefa[] }> = [...map.entries()]
    .sort((a, b) => a[1].titulo.localeCompare(b[1].titulo, 'pt-BR'))
    .map(([chave, { titulo, lista }]) => ({
      cfg: { chave, titulo, atrasadas: contarAtrasadas(lista) },
      lista,
    }));

  if (internas.length > 0) {
    grupos.push({
      cfg: {
        chave: '__internas',
        titulo: 'Internas / avulsas',
        tracejado: true,
        atrasadas: contarAtrasadas(internas),
      },
      lista: internas,
    });
  }

  return grupos;
}

// ---- cliente ----

function construirGruposCliente(tarefas: Tarefa[]): Array<{ cfg: ConfigSecaoGen; lista: Tarefa[] }> {
  const abertas = tarefas.filter((t) => !tarefaConcluida(t.status));
  const map = new Map<string, { titulo: string; lista: Tarefa[] }>();
  const internas: Tarefa[] = [];

  for (const t of abertas) {
    const cli = t.expand?.cliente;
    if (!cli) {
      internas.push(t);
      continue;
    }
    const chave = cli.id;
    if (!map.has(chave)) {
      map.set(chave, { titulo: cli.nome_fantasia ?? cli.nome ?? chave, lista: [] });
    }
    map.get(chave)!.lista.push(t);
  }

  const grupos: Array<{ cfg: ConfigSecaoGen; lista: Tarefa[] }> = [...map.entries()]
    .sort((a, b) => a[1].titulo.localeCompare(b[1].titulo, 'pt-BR'))
    .map(([chave, { titulo, lista }]) => ({
      cfg: { chave, titulo, atrasadas: contarAtrasadas(lista) },
      lista,
    }));

  if (internas.length > 0) {
    grupos.push({
      cfg: {
        chave: '__internas',
        titulo: 'Internas',
        tracejado: true,
        atrasadas: contarAtrasadas(internas),
      },
      lista: internas,
    });
  }

  return grupos;
}

// ---- status ----

function construirGruposStatus(
  tarefas: Tarefa[],
  ordemStatus: string[],
): Array<{ cfg: ConfigSecaoGen; lista: Tarefa[] }> {
  const abertas = tarefas.filter((t) => !tarefaConcluida(t.status));
  const map = new Map<string, Tarefa[]>();
  for (const s of ordemStatus) map.set(s, []);
  const semStatus: Tarefa[] = [];

  for (const t of abertas) {
    if (t.status && map.has(t.status)) map.get(t.status)!.push(t);
    else semStatus.push(t);
  }

  const grupos: Array<{ cfg: ConfigSecaoGen; lista: Tarefa[] }> = ordemStatus
    .filter((s) => (map.get(s)?.length ?? 0) > 0)
    .map((s) => ({
      cfg: { chave: s, titulo: s, atrasadas: contarAtrasadas(map.get(s)!) },
      lista: map.get(s)!,
    }));

  if (semStatus.length > 0) {
    grupos.push({
      cfg: {
        chave: '__sem_status',
        titulo: 'Sem status',
        tracejado: true,
        atrasadas: contarAtrasadas(semStatus),
      },
      lista: semStatus,
    });
  }

  return grupos;
}

/* -------------------------------------------------------------------------- */
/*  Ícone de prioridade                                                        */
/* -------------------------------------------------------------------------- */

function IconePrioridade({ prioridade }: { prioridade?: string }) {
  if (prioridade === 'alta') {
    return (
      <span title="Prioridade alta" aria-label="Prioridade alta" className="shrink-0">
        <ArrowUp className="size-3.5 text-orange-500" />
      </span>
    );
  }
  if (prioridade === 'baixa') {
    return (
      <span title="Prioridade baixa" aria-label="Prioridade baixa" className="shrink-0">
        <ArrowDown className="size-3.5 text-muted-foreground/60" />
      </span>
    );
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Checkbox circular                                                          */
/* -------------------------------------------------------------------------- */

function LinhaCheckbox({ concluida, otimista, onToggle }: {
  concluida: boolean; otimista: boolean; onToggle: () => void;
}) {
  const marcada = concluida || otimista;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={marcada ? 'Reabrir tarefa' : 'Concluir tarefa'}
      className={cn(
        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        marcada ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border hover:border-emerald-400',
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

/* -------------------------------------------------------------------------- */
/*  Linha de tarefa                                                            */
/* -------------------------------------------------------------------------- */

function LinhaTarefa({ t, onAbrir, onConcluir, onReabrir }: {
  t: Tarefa;
  onAbrir: (id: string) => void;
  onConcluir: (id: string) => void;
  onReabrir: (id: string) => void;
}) {
  const [otimista, setOtimista] = useState(false);
  const concluida = tarefaConcluida(t.status);
  const vencida = prazoVencido(t.prazo, t.status);
  const resps = responsaveis(t);

  const contexto = t.expand?.projeto?.nome
    ?? t.expand?.cliente?.nome_fantasia
    ?? t.expand?.cliente?.nome
    ?? (t.projeto || t.cliente ? undefined : 'Interna');

  const checkFeitos = (t.checklist ?? []).filter((i) => i.feito).length;
  const checkTotal = (t.checklist ?? []).length;

  function handleToggle() {
    setOtimista((v) => !v);
    if (concluida) onReabrir(t.id); else onConcluir(t.id);
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
      <LinhaCheckbox concluida={concluida} otimista={otimista} onToggle={handleToggle} />

      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <IconePrioridade prioridade={t.prioridade} />
          <span className={cn('font-medium leading-snug', (concluida || otimista) && 'line-through')}>
            {t.nome}
          </span>
        </span>
        {contexto && <span className="block text-xs text-muted-foreground">{contexto}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {t.status && (
          <Badge className={cn('border text-[10px]', statusTarefaClass(t.status))}>
            {t.status}
          </Badge>
        )}
        {checkTotal > 0 && (
          <span className="text-[11px] text-muted-foreground">
            ✓ {checkFeitos}/{checkTotal}
          </span>
        )}
        {t.prazo && (
          <span className={cn('text-[11px]', vencida ? 'font-medium text-destructive' : 'text-muted-foreground')}>
            {dataBR(t.prazo)}
          </span>
        )}
        {t.recorrencia && (
          <span title={`Repete: ${t.recorrencia}`} className="shrink-0 text-muted-foreground">
            <Repeat className="size-3" />
          </span>
        )}
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
                className={cn('grid size-6 place-items-center rounded-full border-2 border-card text-[9px] font-bold text-white', corAvatar(r.nome))}
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
/*  Seção genérica                                                             */
/* -------------------------------------------------------------------------- */

function SecaoTarefas({ cfg, tarefas, onAbrir, onConcluir, onReabrir }: {
  cfg: ConfigSecaoGen;
  tarefas: Tarefa[];
  onAbrir: (id: string) => void;
  onConcluir: (id: string) => void;
  onReabrir: (id: string) => void;
}) {
  const [aberta, setAberta] = useState(!cfg.recolhidaInicial);
  const ordenadas = ordenarSecao(tarefas);

  return (
    <div className={cn('flex flex-col', cfg.tracejado && 'border-t border-dashed border-muted-foreground/30')}>
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground',
          cfg.destructive ? 'text-destructive' : cfg.tracejado ? 'text-muted-foreground/70' : 'text-muted-foreground',
        )}
      >
        {aberta ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <span>{cfg.titulo}</span>
        <span className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
          cfg.destructive ? 'bg-destructive/15 text-destructive' : 'bg-secondary text-muted-foreground',
        )}>
          {tarefas.length}
        </span>
        {/* Badge "N atrasadas" para modos não-prazo */}
        {(cfg.atrasadas ?? 0) > 0 && (
          <span className="rounded-full border border-destructive/50 bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
            {cfg.atrasadas} atrasada{cfg.atrasadas !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {aberta && (
        <div className="flex flex-col divide-y divide-border/40">
          {ordenadas.map((t) => (
            <LinhaTarefa key={t.id} t={t} onAbrir={onAbrir} onConcluir={onConcluir} onReabrir={onReabrir} />
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
  agrupar = 'prazo',
  statuses = [],
}: {
  tarefas: Tarefa[];
  onAbrir: (id: string) => void;
  onConcluir: (id: string) => void;
  onReabrir: (id: string) => void;
  agrupar?: TipoAgrupamento;
  statuses?: string[];
}) {
  let grupos: { cfg: ConfigSecaoGen; lista: Tarefa[] }[];

  switch (agrupar) {
    case 'responsavel': grupos = construirGruposResponsavel(tarefas); break;
    case 'projeto':     grupos = construirGruposProjeto(tarefas); break;
    case 'cliente':     grupos = construirGruposCliente(tarefas); break;
    case 'status':      grupos = construirGruposStatus(tarefas, statuses); break;
    default:            grupos = construirGruposPrazo(tarefas); break;
  }

  if (grupos.length === 0) {
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
      {grupos.map(({ cfg, lista }) => (
        <SecaoTarefas
          key={cfg.chave}
          cfg={cfg}
          tarefas={lista}
          onAbrir={onAbrir}
          onConcluir={onConcluir}
          onReabrir={onReabrir}
        />
      ))}
    </Card>
  );
}
