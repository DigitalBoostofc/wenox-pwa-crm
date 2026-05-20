import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Plus, FolderKanban } from 'lucide-react';
import { listProjetos } from './projetosService';
import { listEtapas } from './etapasService';
import type { Projeto, EtapaProjeto } from './types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { dataBR } from '@/clientes/format';

export function ProjetosTabCliente({ clienteId }: { clienteId: string }) {
  const history = useHistory();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [etapas, setEtapas] = useState<EtapaProjeto[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    Promise.all([
      listProjetos({ clienteId }),
      listEtapas(),
    ]).then(([ps, es]) => {
      setProjetos(ps);
      setEtapas(es);
    }).finally(() => setCarregando(false));
  }, [clienteId]);

  if (carregando) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {projetos.length} {projetos.length === 1 ? 'projeto' : 'projetos'}
        </p>
        <Button size="sm" onClick={() => history.push(`/projetos/novo?cliente=${clienteId}`)}>
          <Plus className="size-4" /> Novo projeto
        </Button>
      </div>

      {projetos.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <FolderKanban className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Este cliente ainda não tem projetos.
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {projetos.map((p) => {
            const etapasDoTipo = etapas.filter((e) => e.tipo === (p.tipo ?? ''));
            const idx = p.etapa ? etapasDoTipo.findIndex((e) => e.nome === p.etapa) : -1;
            return (
              <button
                key={p.id}
                onClick={() => history.push(`/projetos/${p.id}`)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
              >
                <div className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
                  <FolderKanban className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.tipo || 'Sem tipo'}
                    {p.data_entrega && ` · entrega ${dataBR(p.data_entrega)}`}
                  </p>
                </div>
                {p.etapa && (
                  <Badge variant="default" className="text-[10px]">
                    {p.etapa}
                    {etapasDoTipo.length > 0 && idx >= 0 && ` (${idx + 1}/${etapasDoTipo.length})`}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
