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
  altura = 200,
}: {
  dados: { rotulo: string; noPrazo: number; atrasadas: number }[];
  altura?: number;
}) {
  const maxTotal = Math.max(...dados.map((d) => d.noPrazo + d.atrasadas), 1);
  const temDados = dados.some((d) => d.noPrazo + d.atrasadas > 0);
  // Topo da escala arredondado pra cima (passos "bonitos") para os rótulos do eixo.
  const passo = maxTotal <= 4 ? 1 : maxTotal <= 8 ? 2 : maxTotal <= 20 ? 5 : 10;
  const topo = Math.ceil(maxTotal / passo) * passo;
  const marcas: number[] = [];
  for (let v = topo; v >= 0; v -= passo) marcas.push(v);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="img" aria-label="Entregas por mês">
        {/* Eixo Y */}
        <div
          className="flex w-5 shrink-0 flex-col justify-between text-right text-[9px] leading-none text-muted-foreground/70"
          style={{ height: altura }}
        >
          {marcas.map((m) => <span key={m}>{m}</span>)}
        </div>

        {/* Área do gráfico */}
        <div className="relative flex-1">
          {/* Linhas de grade */}
          <div className="absolute inset-0 flex flex-col justify-between">
            {marcas.map((m) => <div key={m} className="border-t border-border/30" />)}
          </div>

          {/* Barras */}
          <div className="relative flex items-end gap-2" style={{ height: altura }}>
            {dados.map((d, i) => {
              const total = d.noPrazo + d.atrasadas;
              const hPct = (total / topo) * 100;
              return (
                <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end">
                  {total > 0 && (
                    <span className="mb-1 text-[11px] font-bold text-foreground">{total}</span>
                  )}
                  <div
                    className="flex w-full max-w-[40px] flex-col-reverse overflow-hidden rounded-t-md"
                    style={{ height: total > 0 ? `max(${hPct}%, 6px)` : '0px' }}
                    title={`${d.rotulo}: ${d.noPrazo} no prazo · ${d.atrasadas} atrasada(s)`}
                  >
                    {d.noPrazo > 0 && (
                      <div className="w-full bg-emerald-500" style={{ flexGrow: d.noPrazo }} />
                    )}
                    {d.atrasadas > 0 && (
                      <div className="w-full bg-destructive" style={{ flexGrow: d.atrasadas }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rótulos dos meses (alinhados às barras) */}
      <div className="flex gap-2 pl-7">
        {dados.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[11px] font-medium text-muted-foreground">
            {d.rotulo}
          </span>
        ))}
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-muted-foreground">No prazo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-2.5 rounded-sm bg-destructive" />
          <span className="text-[10px] text-muted-foreground">Atrasada</span>
        </div>
      </div>

      {!temDados && (
        <p className="text-center text-xs text-muted-foreground">Sem entregas no período.</p>
      )}
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
