import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/useAuth';
import type { Role } from '@/auth/perms';
import { pb } from '@/lib/pocketbase';
import { fotoUrl } from '@/usuarios/usuariosService';
import { corAvatar, inicial } from '@/clientes/format';
import type { Usuario } from '@/usuarios/types';
import { MeuDiaBloco, MeusProjetosBloco, MinhaProdutividadeBloco, MeusDadosBloco } from './blocos';
import { PulsoEquipeBloco, AprovacoesPendentesBloco, PulsoNegocioBloco } from './blocosGestao';

type BlocoId =
  | 'meu-dia' | 'meu-dia-readonly' | 'meus-projetos' | 'produtividade' | 'meus-dados'
  | 'pulso-equipe' | 'aprovacoes' | 'pulso-negocio';

const BLOCOS_POR_ROLE: Record<string, BlocoId[]> = {
  Owner:        ['pulso-negocio', 'meu-dia', 'meus-projetos', 'produtividade', 'meus-dados', 'pulso-equipe', 'aprovacoes'],
  Admin:        ['pulso-negocio', 'meu-dia', 'meus-projetos', 'produtividade', 'meus-dados', 'pulso-equipe', 'aprovacoes'],
  Gestor:       ['meu-dia', 'meus-projetos', 'produtividade', 'meus-dados', 'pulso-equipe', 'aprovacoes'],
  Membro:       ['meu-dia', 'meus-projetos', 'produtividade', 'meus-dados'],
  Visualizador: ['meu-dia-readonly', 'meus-projetos', 'meus-dados'],
};

export function MinhaAreaPage() {
  const { user } = useAuth();
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    pb.collection('usuarios')
      .getOne(user.id)
      .then((r) => setUsuario(r as unknown as Usuario))
      .catch(() => null);
  }, [user?.id]);

  if (!user) return null;

  const nome = usuario?.nome ?? user.nome ?? user.email ?? '';
  const cargo = usuario?.cargo ?? '';
  const area = usuario?.area ?? '';
  const subLinha = [cargo, area].filter(Boolean).join(' · ');
  const role = user.role as Role;
  const blocos = BLOCOS_POR_ROLE[role] ?? BLOCOS_POR_ROLE['Membro'];
  const temProdutividade = blocos.includes('produtividade');

  const fotoSrc = user.foto
    ? fotoUrl(
        { id: user.id, foto: user.foto, collectionId: user.collectionId, collectionName: user.collectionName },
        '100x100',
      )
    : '';

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      {/* Cabeçalho pessoal */}
      <div className="flex items-center gap-4">
        {fotoSrc ? (
          <img
            src={fotoSrc}
            alt={nome}
            loading="lazy"
            decoding="async"
            className="size-16 shrink-0 rounded-full object-cover ring-2 ring-primary/40"
          />
        ) : (
          <span
            className={cn(
              'grid size-16 shrink-0 place-items-center rounded-full text-xl font-bold text-white ring-2 ring-primary/40',
              corAvatar(nome),
            )}
          >
            {inicial(nome)}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-bold leading-tight">{nome}</h2>
          {subLinha && (
            <p className="text-sm text-muted-foreground">{subLinha}</p>
          )}
          <Badge variant="muted" className="w-fit text-xs">
            {role}
          </Badge>
        </div>
      </div>

      {/* Pulso do negócio — full width, só Owner/Admin */}
      {blocos.includes('pulso-negocio') && <PulsoNegocioBloco />}

      {/* Linha de produtividade */}
      {temProdutividade && (
        <div>
          <MinhaProdutividadeBloco />
        </div>
      )}

      {/* Grade principal */}
      <div className="grid gap-4 lg:grid-cols-3">
        {(blocos.includes('meu-dia') || blocos.includes('meu-dia-readonly')) && (
          <div className="lg:col-span-2">
            <MeuDiaBloco somenteLeitura={blocos.includes('meu-dia-readonly')} />
          </div>
        )}
        {(blocos.includes('meus-projetos') || blocos.includes('meus-dados')) && (
          <div className="flex flex-col gap-4 lg:col-span-1">
            {blocos.includes('meus-projetos') && <MeusProjetosBloco />}
            {blocos.includes('meus-dados') && <MeusDadosBloco />}
          </div>
        )}
      </div>

      {/* Seção de gestão — Owner, Admin e Gestor */}
      {(blocos.includes('pulso-equipe') || blocos.includes('aprovacoes')) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {blocos.includes('pulso-equipe') && <PulsoEquipeBloco />}
          {blocos.includes('aprovacoes') && <AprovacoesPendentesBloco />}
        </div>
      )}
    </div>
  );
}
