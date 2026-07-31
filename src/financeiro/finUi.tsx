/**
 * Peças visuais do Financeiro (inspirado no painel Cleanox).
 * Só apresentação — sem lógica de domínio.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { TipoLancamento } from './types';

export const FIN_CARD =
  'rounded-2xl border border-border bg-card/80 shadow-sm dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.55)]';

export function FinCard({
  className,
  children,
  padding = true,
}: {
  className?: string;
  children: ReactNode;
  padding?: boolean;
}) {
  return <div className={cn(FIN_CARD, padding && 'p-4', className)}>{children}</div>;
}

export function IconBubble({
  className,
  children,
  tone = 'info',
}: {
  className?: string;
  children: ReactNode;
  tone?: 'info' | 'ok' | 'danger' | 'neutral' | 'primary';
}) {
  const tones: Record<string, string> = {
    info: 'bg-info/15 text-info',
    ok: 'bg-emerald-500/15 text-emerald-400',
    danger: 'bg-red-500/15 text-red-400',
    neutral: 'bg-secondary text-muted-foreground',
    primary: 'bg-primary/15 text-primary',
  };
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function KpiStripItem({
  icon,
  label,
  valor,
  tom,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  valor: string;
  tom?: string;
  tone?: 'info' | 'ok' | 'danger' | 'neutral' | 'primary';
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 sm:px-4">
      <IconBubble tone={tone}>{icon}</IconBubble>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
        <p className={cn('truncate text-base font-bold tabular-nums sm:text-lg', tom)}>{valor}</p>
      </div>
    </div>
  );
}

/** Donut CSS (conic-gradient) — sem lib de chart. */
export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 140,
  total: totalProp,
}: {
  segments: { nome: string; valor: number; color: string }[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  /** Total real do período (ex.: resumo.receitasPagas) — % honestos com top-N truncado. */
  total?: number;
}) {
  const total =
    (totalProp != null && totalProp > 0
      ? totalProp
      : segments.reduce((s, x) => s + x.valor, 0)) || 1;
  let acc = 0;
  const stops: string[] = [];
  for (const seg of segments) {
    const start = (acc / total) * 100;
    acc += seg.valor;
    const end = (acc / total) * 100;
    stops.push(`${seg.color} ${start}% ${end}%`);
  }
  if (!segments.length) {
    stops.push('var(--secondary) 0% 100%');
  } else if (acc < total) {
    // Top-N truncado: fatia restante cinza (honesto vs centerValue/total)
    stops.push(`var(--secondary) ${(acc / total) * 100}% 100%`);
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
      <div
        className="relative shrink-0 rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${stops.join(', ')})`,
        }}
      >
        <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-card text-center">
          {centerLabel && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {centerLabel}
            </span>
          )}
          {centerValue && (
            <span className="text-xs font-bold tabular-nums leading-tight sm:text-sm">
              {centerValue}
            </span>
          )}
        </div>
      </div>
      <ul className="flex max-w-full flex-col gap-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.nome} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.nome}</span>
            <span className="tabular-nums text-foreground/90">
              {Math.round((s.valor / total) * 100)}%
            </span>
          </li>
        ))}
        {!segments.length && (
          <li className="text-muted-foreground">Sem dados no período</li>
        )}
      </ul>
    </div>
  );
}

export function MonthPill({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/80 px-1 py-0.5"
      role="group"
      aria-label="Navegação de mês"
    >
      <button
        type="button"
        onClick={onPrev}
        className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Mês anterior"
      >
        ‹
      </button>
      <span className="min-w-[5.5rem] text-center text-sm font-medium capitalize tabular-nums">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Próximo mês"
      >
        ›
      </button>
    </div>
  );
}

export function PillTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full border border-border bg-secondary/40 p-1">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
            value === it.id
              ? 'bg-info/20 text-info shadow-sm'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function TipoFilterPills({
  value,
  onChange,
}: {
  value: '' | TipoLancamento;
  onChange: (v: '' | TipoLancamento) => void;
}) {
  const opts: { id: '' | TipoLancamento; label: string }[] = [
    { id: '', label: 'Todos' },
    { id: 'receita', label: 'Receitas' },
    { id: 'despesa', label: 'Despesas' },
  ];
  return (
    <div className="inline-flex rounded-full border border-border bg-secondary/50 p-0.5">
      {opts.map((o) => (
        <button
          key={o.id || 'all'}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            value === o.id
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
