import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Donut — anel SVG com porcentagem central                                  */
/* -------------------------------------------------------------------------- */

export function Donut({
  porcentagem,
  rotulo,
  sublabel,
  tamanho = 120,
}: {
  porcentagem: number;
  rotulo: string;
  sublabel?: string;
  tamanho?: number;
}) {
  const raio = 42;
  const circunferencia = 2 * Math.PI * raio;
  const pct = Math.max(0, Math.min(100, porcentagem));
  const offset = circunferencia - (pct / 100) * circunferencia;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 100 100"
        aria-label={`${rotulo}: ${pct}%`}
        role="img"
      >
        <circle
          cx="50"
          cy="50"
          r={raio}
          fill="none"
          className="stroke-secondary"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={raio}
          fill="none"
          className="stroke-primary"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-[18px] font-semibold"
        >
          {pct}%
        </text>
      </svg>
      <span className="text-sm font-medium text-foreground">{rotulo}</span>
      {sublabel && (
        <span className="text-xs text-muted-foreground">{sublabel}</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  BarrasMensais — barras verticais empilhadas (noPrazo + atrasadas)         */
/* -------------------------------------------------------------------------- */

export function BarrasMensais({
  dados,
  altura = 160,
}: {
  dados: { rotulo: string; noPrazo: number; atrasadas: number }[];
  altura?: number;
}) {
  const maxTotal = Math.max(...dados.map((d) => d.noPrazo + d.atrasadas), 0);

  if (maxTotal === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ minHeight: altura }}
        role="img"
        aria-label="Sem dados no período"
      >
        Sem dados no período
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex w-full items-end gap-1"
        style={{ height: altura }}
        role="img"
        aria-label="Gráfico de barras mensais"
      >
        {dados.map((d, i) => {
          const total = d.noPrazo + d.atrasadas;
          const pctTotal = (total / maxTotal) * 100;
          const pctPrazo = total > 0 ? (d.noPrazo / total) * 100 : 0;
          const pctAtrasada = total > 0 ? (d.atrasadas / total) * 100 : 0;

          return (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-muted-foreground">
                {total > 0 ? total : ''}
              </span>
              <div
                className="flex w-full max-w-10 flex-col justify-end overflow-hidden rounded-t-sm"
                style={{ height: `${pctTotal}%` }}
              >
                {d.atrasadas > 0 && (
                  <div
                    className="w-full bg-destructive"
                    style={{ height: `${pctAtrasada}%`, minHeight: d.atrasadas > 0 ? 2 : 0 }}
                  />
                )}
                {d.noPrazo > 0 && (
                  <div
                    className="w-full bg-emerald-500"
                    style={{ height: `${pctPrazo}%`, minHeight: d.noPrazo > 0 ? 2 : 0 }}
                  />
                )}
              </div>
              <span className="truncate text-[10px] text-muted-foreground">{d.rotulo}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-muted-foreground">No prazo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-full bg-destructive" />
          <span className="text-[10px] text-muted-foreground">Atrasada</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  BarraProgresso — barra horizontal fina                                    */
/* -------------------------------------------------------------------------- */

export function BarraProgresso({
  valor,
  max,
  cor = 'bg-primary',
}: {
  valor: number;
  max: number;
  cor?: string;
}) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0;

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-secondary"
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={cn('h-full rounded-full transition-all', cor)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
