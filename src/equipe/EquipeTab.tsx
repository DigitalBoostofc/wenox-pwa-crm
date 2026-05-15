import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { listEquipe, addMembro, removeMembro } from '@/equipe/equipeService';
import type { MembroEquipe } from '@/equipe/equipeService';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { useAuth } from '@/auth/useAuth';
import { canGerirEquipe } from '@/auth/perms';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function EquipeTab({ clienteId }: { clienteId: string }) {
  const { user } = useAuth();
  const podeGerir = canGerirEquipe(user?.role);
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sel, setSel] = useState('');

  async function carregar() {
    setMembros(await listEquipe(clienteId));
  }
  useEffect(() => {
    carregar();
    listUsuarios().then(setUsuarios);
  }, [clienteId]);

  async function add() {
    if (!sel) return;
    await addMembro(clienteId, sel, 'Outros');
    setSel('');
    await carregar();
  }
  async function rm(id: string) {
    await removeMembro(id);
    await carregar();
  }

  return (
    <div className="flex flex-col gap-4">
      {podeGerir && (
        <div className="flex gap-2">
          <select
            aria-label="Selecionar usuário"
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            className="h-10 flex-1 rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <option value="">Adicionar membro…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
          <Button onClick={add}>Adicionar</Button>
        </div>
      )}
      <Card className="divide-y divide-border">
        {membros.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Nenhum membro vinculado.
          </p>
        )}
        {membros.map((m) => (
          <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {m.expand?.usuario?.nome ?? m.usuario}
              </p>
              <p className="text-sm text-muted-foreground">{m.area}</p>
            </div>
            {podeGerir && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => rm(m.id)}
                aria-label="Remover"
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
