import { cn } from '@/lib/utils';
import type { MesRef } from './relatoriosService';

const ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function gerarMeses(qtd: number): MesRef[] {
  const hoje = new Date();
  const lista: MesRef[] = [];
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth() + 1;
  for (let i = 0; i < qtd; i++) {
    lista.push({ ano, mes });
    mes--;
    if (mes === 0) { mes = 12; ano--; }
  }
  return lista;
}

function mesIgual(a: MesRef, b: MesRef) {
  return a.ano === b.ano && a.mes === b.mes;
}

function rotulo(m: MesRef) {
  return `${ABREV[m.mes - 1]}/${String(m.ano).slice(-2)}`;
}

export function SeletorMeses({
  selecionados,
  onChange,
  meses = 12,
}: {
  selecionados: MesRef[];
  onChange: (m: MesRef[]) => void;
  meses?: number;
}) {
  const lista = gerarMeses(meses);

  function toggle(ref: MesRef) {
    const idx = selecionados.findIndex((s) => mesIgual(s, ref));
    if (idx >= 0) {
      if (selecionados.length <= 1) return;
      onChange(selecionados.filter((_, i) => i !== idx));
    } else {
      onChange([...selecionados, ref]);
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden lg:flex-wrap">
      {lista.map((m) => {
        const ativo = selecionados.some((s) => mesIgual(s, m));
        return (
          <button
            key={`${m.ano}-${m.mes}`}
            type="button"
            onClick={() => toggle(m)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1 text-sm transition-colors',
              ativo
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-secondary',
            )}
          >
            {rotulo(m)}
          </button>
        );
      })}
    </div>
  );
}
