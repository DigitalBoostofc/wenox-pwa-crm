import { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Phone, Pencil } from 'lucide-react';
import { getCliente } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';
import { EquipeTab } from '@/equipe/EquipeTab';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <span className="text-sm font-medium">{valor}</span>
    </div>
  );
}

export function ClienteDetailPage({ id: idProp }: { id?: string } = {}) {
  const params = useParams<{ id?: string }>();
  const id = idProp ?? params.id ?? '';
  const history = useHistory();
  const [c, setC] = useState<Cliente | null>(null);
  const [aba, setAba] = useState<'info' | 'equipe'>('info');

  useEffect(() => {
    if (id) getCliente(id).then(setC);
  }, [id]);

  if (!c) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Carregando…
      </p>
    );
  }

  const wpp = `https://wa.me/${c.telefone.replace(/\D/g, '')}`;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => history.push('/clientes')}
          aria-label="Voltar"
        >
          <ArrowLeft />
        </Button>
        <div className="flex flex-1 items-center gap-3">
          <h2 className="text-xl font-semibold">{c.nome_fantasia}</h2>
          <Badge variant={c.status === 'Ativo' ? 'success' : 'muted'}>
            {c.status}
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => history.push(`/clientes/${c.id}/editar`)}
        >
          <Pencil /> Editar
        </Button>
      </div>

      <div className="inline-flex w-fit gap-1 rounded-lg border border-border bg-secondary/60 p-1">
        {(['info', 'equipe'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setAba(t)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-all',
              aba === t
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'info' ? 'Info' : 'Equipe'}
          </button>
        ))}
      </div>

      {aba === 'equipe' ? (
        <EquipeTab clienteId={c.id} />
      ) : (
        <>
          <Card className="divide-y divide-border">
            <Linha rotulo="Categoria" valor={c.categoria} />
            <Linha rotulo="Telefone" valor={c.telefone} />
            {c.email && <Linha rotulo="E-mail" valor={c.email} />}
          </Card>
          <div className="flex gap-3">
            <Button asChild className="flex-1">
              <a href={wpp} target="_blank" rel="noopener" aria-label="WhatsApp">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <a href={`tel:${c.telefone}`} aria-label="Ligar">
                <Phone /> Ligar
              </a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
