import { fotoUrl } from '@/usuarios/usuariosService';
import { corAvatar } from '@/clientes/format';
import { cn } from '@/lib/utils';

export interface MembroAvatar {
  id: string;
  nome?: string;
  foto?: string;
  collectionId?: string;
  collectionName?: string;
}

function iniciais(n?: string): string {
  const t = (n ?? '?').trim();
  const p = t.split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return t.charAt(0).toUpperCase() || '?';
}

/** Avatar do membro: foto cadastrada (com thumb) ou iniciais com cor de fallback. */
export function AvatarMembro({ membro, className = 'size-8' }: { membro: MembroAvatar; className?: string }) {
  const url = membro.foto ? fotoUrl(membro, '100x100') : '';
  if (url) {
    return (
      <img
        src={url}
        alt={membro.nome ?? ''}
        title={membro.nome}
        loading="lazy"
        decoding="async"
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }
  return (
    <div
      title={membro.nome}
      className={cn('grid shrink-0 place-items-center rounded-full text-[11px] font-bold text-white', className, corAvatar(membro.nome ?? ''))}
    >
      {iniciais(membro.nome)}
    </div>
  );
}
