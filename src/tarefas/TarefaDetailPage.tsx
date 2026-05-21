import { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { ArrowLeft, Pencil, ListChecks, Trash2 } from 'lucide-react';
import { getTarefa, removerTarefa } from './tarefasService';
import type { Tarefa } from './types';
import { statusTarefaClass, prazoVencido, LADO_LABEL } from './format';
import { responsaveisTarefa } from './TarefaCard';
import { AtividadeFeed } from '@/atividade/AtividadeFeed';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dataBR } from '@/clientes/format';
import { cn } from '@/lib/utils';

function Linha({ rotulo, valor }: { rotulo: string; valor?: React.ReactNode }) {
  if (!valor) return null;
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <span className="shrink-0 pt-0.5 text-sm text-muted-foreground">{rotulo}</span>
      <div className="text-right text-sm font-medium">{valor}</div>
    </div>
  );
}

export function TarefaDetailPage({ id: idProp }: { id?: string } = {}) {
  const params = useParams<{ id?: string }>();
  const id = idProp ?? params.id ?? '';
  const history = useHistory();
  const [t, setT] = useState<Tarefa | null>(null);

  useEffect(() => {
    if (id) getTarefa(id).then(setT);
  }, [id]);

  if (!t) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>;
  }

  const resps = responsaveisTarefa(t);
  const cli = t.expand?.cliente;
  const cliNome = cli?.nome?.trim() || cli?.nome_fantasia || '';
  const vencida = prazoVencido(t.prazo, t.status);

  async function apagar() {
    if (!t) return;
    if (!confirm(`Apagar a tarefa "${t.nome}"? Esta ação não pode ser desfeita.`)) return;
    await removerTarefa(t.id);
    history.push('/tarefas');
  }

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => history.goBack()} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <div className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <ListChecks className="size-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{t.nome}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {t.expand?.projeto?.nome
              ? <span>{t.expand.projeto.nome}{cliNome && ` · ${cliNome}`}</span>
              : <span>Tarefa interna</span>}
            {t.status && (
              <Badge className={cn('border text-[10px]', statusTarefaClass(t.status))}>
                {t.status}
              </Badge>
            )}
          </div>
        </div>
        {t.projeto && (
          <Button variant="outline" size="sm" onClick={() => history.push(`/projetos/${t.projeto}`)}>
            Abrir projeto
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={apagar} className="text-destructive hover:bg-destructive/10">
          <Trash2 /> Apagar
        </Button>
        <Button size="sm" onClick={() => history.push(`/tarefas/${t.id}/editar`)}>
          <Pencil /> Editar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border p-0">
            <Linha rotulo="Projeto" valor={t.expand?.projeto?.nome ?? 'Tarefa interna'} />
            <Linha rotulo="Cliente" valor={cliNome || undefined} />
            <Linha rotulo="Lado responsável" valor={t.lado ? LADO_LABEL[t.lado] : undefined} />
            <Linha rotulo="Status" valor={t.status ? (
              <Badge className={cn('border text-[10px]', statusTarefaClass(t.status))}>
                {t.status}
              </Badge>
            ) : undefined} />
            <Linha rotulo="Prazo" valor={t.prazo ? (
              <span className={vencida ? 'text-destructive' : undefined}>
                {dataBR(t.prazo)}{vencida && ' (vencida)'}
              </span>
            ) : undefined} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Responsáveis</CardTitle></CardHeader>
          <CardContent>
            {resps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum responsável atribuído.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {resps.map((r) => (
                  <Badge key={r.id} variant="muted">{r.nome}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(t.etiquetas?.length ?? 0) > 0 && (
        <Card>
          <CardHeader><CardTitle>Etiquetas</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(t.etiquetas ?? []).map((e) => (
                <Badge key={e} variant="muted">{e}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {t.descricao && (
        <Card>
          <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
            {t.descricao}
          </CardContent>
        </Card>
      )}

      <AtividadeFeed entidade="tarefa" refId={t.id} />
    </div>
  );
}
