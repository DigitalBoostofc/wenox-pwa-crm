import { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Phone, Pencil, Activity,
  Users, KeyRound, FileText, LayoutDashboard,
} from 'lucide-react';
import { getCliente } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';
import { EquipeTab } from '@/equipe/EquipeTab';
import { cn } from '@/lib/utils';
import { statusVariant, haDias, dataBR, corAvatar, inicial } from '@/clientes/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <span className="text-sm font-medium">{valor}</span>
    </div>
  );
}

function EmBreve({ titulo }: { titulo: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {titulo} chega numa próxima fase do Wenox OS.
      </CardContent>
    </Card>
  );
}

type Aba = 'visao' | 'equipe' | 'acessos' | 'documentos';
const ABAS: { id: Aba; label: string; icon: typeof Users }[] = [
  { id: 'visao', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'equipe', label: 'Equipe', icon: Users },
  { id: 'acessos', label: 'Acessos', icon: KeyRound },
  { id: 'documentos', label: 'Documentos', icon: FileText },
];

export function ClienteDetailPage({ id: idProp }: { id?: string } = {}) {
  const params = useParams<{ id?: string }>();
  const id = idProp ?? params.id ?? '';
  const history = useHistory();
  const [c, setC] = useState<Cliente | null>(null);
  const [aba, setAba] = useState<Aba>('visao');

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
  const clienteDesde = dataBR(c.data_inicio) || dataBR(c.created);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => history.push('/clientes')}
          aria-label="Voltar"
        >
          <ArrowLeft />
        </Button>
        <div
          className={cn(
            'grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white',
            corAvatar(c.nome_fantasia),
          )}
        >
          {inicial(c.nome_fantasia)}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{c.nome_fantasia}</h2>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            {c.status && (
              <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
            )}
            {clienteDesde && <span>Cliente desde {clienteDesde}</span>}
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={wpp} target="_blank" rel="noopener" aria-label="WhatsApp">
            <MessageCircle /> WhatsApp
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={`tel:${c.telefone}`} aria-label="Ligar">
            <Phone /> Ligar
          </a>
        </Button>
        <Button
          size="sm"
          onClick={() => history.push(`/clientes/${c.id}/editar`)}
        >
          <Pencil /> Editar
        </Button>
      </div>

      {/* Guias */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {ABAS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                aba === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {aba === 'visao' && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Principais informações</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                <Linha rotulo="Categoria" valor={c.categoria} />
                {c.razao_social && (
                  <Linha rotulo="Razão social" valor={c.razao_social} />
                )}
                {c.cnpj && <Linha rotulo="CPF / CNPJ" valor={c.cnpj} />}
                <Linha rotulo="Telefone" valor={c.telefone} />
                {c.email && <Linha rotulo="E-mail" valor={c.email} />}
                {c.site && <Linha rotulo="Website" valor={c.site} />}
                {c.endereco && <Linha rotulo="Endereço" valor={c.endereco} />}
                {c.origem && <Linha rotulo="Origem" valor={c.origem} />}
                {(c.data_inicio || c.data_encerramento) && (
                  <Linha
                    rotulo="Período"
                    valor={`${dataBR(c.data_inicio) || '—'} → ${dataBR(c.data_encerramento) || 'ativo'}`}
                  />
                )}
                <Linha rotulo="Cadastrado" valor={haDias(c.created) || '—'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-4" /> Resumo de atividades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Projetos e tarefas deste cliente aparecerão aqui quando os
                  módulos de Projetos e Tarefas forem ativados.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Serviços contratados</CardTitle>
            </CardHeader>
            <CardContent>
              {c.servicos && c.servicos.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {c.servicos.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum serviço contratado registrado.
                </p>
              )}
            </CardContent>
          </Card>

          {(c.url_dashboard || c.url_drive || c.url_trello) && (
            <Card>
              <CardHeader>
                <CardTitle>Links</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {c.url_dashboard && (
                  <a className="block px-5 py-3.5 text-sm text-primary hover:underline"
                    href={c.url_dashboard} target="_blank" rel="noopener">Dashboard</a>
                )}
                {c.url_drive && (
                  <a className="block px-5 py-3.5 text-sm text-primary hover:underline"
                    href={c.url_drive} target="_blank" rel="noopener">Drive</a>
                )}
                {c.url_trello && (
                  <a className="block px-5 py-3.5 text-sm text-primary hover:underline"
                    href={c.url_trello} target="_blank" rel="noopener">Trello</a>
                )}
              </CardContent>
            </Card>
          )}

          {c.observacoes && (
            <Card>
              <CardHeader>
                <CardTitle>Observação</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
                {c.observacoes}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {aba === 'equipe' && <EquipeTab clienteId={c.id} />}
      {aba === 'acessos' && <EmBreve titulo="Dados de acesso" />}
      {aba === 'documentos' && <EmBreve titulo="Documentos" />}
    </div>
  );
}
