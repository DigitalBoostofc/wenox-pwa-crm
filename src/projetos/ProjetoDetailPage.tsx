import { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { ArrowLeft, Pencil, FolderKanban } from 'lucide-react';
import { getProjeto } from './projetosService';
import { listEtapas } from './etapasService';
import type { Projeto, EtapaProjeto } from './types';
import { AtividadeFeed } from '@/atividade/AtividadeFeed';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dataBR } from '@/clientes/format';

function Linha({ rotulo, valor }: { rotulo: string; valor?: React.ReactNode }) {
  if (!valor) return null;
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <span className="shrink-0 pt-0.5 text-sm text-muted-foreground">{rotulo}</span>
      <div className="text-right text-sm font-medium">{valor}</div>
    </div>
  );
}

export function ProjetoDetailPage({ id: idProp }: { id?: string } = {}) {
  const params = useParams<{ id?: string }>();
  const id = idProp ?? params.id ?? '';
  const history = useHistory();
  const [p, setP] = useState<Projeto | null>(null);
  const [etapas, setEtapas] = useState<EtapaProjeto[]>([]);

  useEffect(() => {
    if (id) getProjeto(id).then(setP);
  }, [id]);
  useEffect(() => {
    if (p?.tipo) listEtapas(p.tipo).then(setEtapas);
  }, [p?.tipo]);

  if (!p) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>
    );
  }

  const cli = p.expand?.cliente;
  const cliNome = cli?.nome?.trim() || cli?.nome_fantasia || '—';
  const responsaveis = p.expand?.responsaveis ?? [];
  const etapaIdx = p.etapa ? etapas.findIndex((e) => e.nome === p.etapa) : -1;

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => history.push('/projetos')} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <div className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <FolderKanban className="size-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{p.nome}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {cliNome} · {p.tipo || 'Sem tipo'}
            {p.etapa && (
              <>
                {' · '}
                <Badge variant="default" className="ml-1 text-[10px]">{p.etapa}</Badge>
                {etapas.length > 0 && etapaIdx >= 0 && (
                  <span className="ml-1 text-xs">({etapaIdx + 1}/{etapas.length})</span>
                )}
              </>
            )}
          </p>
        </div>
        {cli && (
          <Button variant="outline" size="sm" onClick={() => history.push(`/clientes/${cli.id}`)}>
            Abrir cliente
          </Button>
        )}
        <Button size="sm" onClick={() => history.push(`/projetos/${p.id}/editar`)}>
          <Pencil /> Editar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border p-0">
            <Linha rotulo="Cliente" valor={cliNome} />
            <Linha rotulo="Tipo" valor={p.tipo} />
            <Linha rotulo="Etapa" valor={p.etapa} />
            <Linha rotulo="Início" valor={dataBR(p.data_inicio)} />
            <Linha rotulo="Entrega" valor={dataBR(p.data_entrega)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Responsáveis</CardTitle></CardHeader>
          <CardContent>
            {responsaveis.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum responsável atribuído.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {responsaveis.map((r) => (
                  <Badge key={r.id} variant="muted">{r.nome ?? r.email}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(p.etiquetas?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle>Etiquetas</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(p.etiquetas ?? []).map((t) => (
                <Badge key={t} variant="muted">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {p.briefing && (
        <Card>
          <CardHeader><CardTitle>Briefing</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {p.briefing}
          </CardContent>
        </Card>
      )}

      {p.observacoes && (
        <Card>
          <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {p.observacoes}
          </CardContent>
        </Card>
      )}

      <AtividadeFeed entidade="projeto" refId={p.id} />
    </div>
  );
}
