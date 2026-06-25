import {
  useStatusGlobal, getGrupos, opcoesDoGrupo, opcaoIdPorNome,
} from './status';
import { cn } from '@/lib/utils';

const selectCls =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

/**
 * Seletor de status agrupado (estilo Notion): cada grupo é um <optgroup> e
 * cada opção um <option> (value = id da opção). Conjunto único global.
 *
 * `value` é o status_opcao (id). Para dados legados/pré-backfill, passe
 * `statusLegado` (nome) e o componente pré-seleciona a opção equivalente.
 * `onChange` recebe o id da opção escolhida.
 */
export function StatusOpcaoSelect({
  value,
  statusLegado,
  onChange,
  className,
  ariaLabel = 'Status',
}: {
  value?: string;
  statusLegado?: string;
  onChange: (opcaoId: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  useStatusGlobal();
  const grupos = getGrupos();
  const selecionado = value || opcaoIdPorNome(statusLegado) || '';

  return (
    <select
      value={selecionado}
      onChange={(e) => onChange(e.target.value)}
      className={cn(selectCls, className)}
      aria-label={ariaLabel}
    >
      {!selecionado && <option value="" disabled>Selecione…</option>}
      {grupos.map((g) => {
        const opcoes = opcoesDoGrupo(g.id);
        if (opcoes.length === 0) return null;
        return (
          <optgroup key={g.id} label={g.nome}>
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>{o.nome}</option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
