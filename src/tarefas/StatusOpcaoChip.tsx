import {
  useStatusGlobal, resolverOpcao, corOpcaoClass,
} from './status';
import { statusTarefaClass } from './format';
import { cn } from '@/lib/utils';

/**
 * Pílula de status no modelo global (grupos+opções).
 * Resolve a opção por `opcaoId` (status_opcao) e, no legado/pré-backfill,
 * cai no `statusLegado` (campo `status` por nome). A cor sai da opção; se
 * desconhecida, usa o mapa por palavra-chave do status legado.
 */
export function StatusOpcaoChip({
  opcaoId,
  statusLegado,
  className,
}: {
  opcaoId?: string;
  statusLegado?: string;
  className?: string;
}) {
  useStatusGlobal(); // re-render quando a config muda
  const op = resolverOpcao(opcaoId, statusLegado);
  const nome = op?.nome ?? statusLegado ?? '';
  if (!nome) return null;
  const cor = (op ? corOpcaoClass(op.id) : '') || statusTarefaClass(statusLegado);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        cor,
        className,
      )}
    >
      {nome}
    </span>
  );
}
