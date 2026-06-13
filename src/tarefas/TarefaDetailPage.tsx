import { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { TarefaSheet } from './TarefaSheet';
import {
  ArrowLeft, Pencil, ListChecks, Trash2, Check, RotateCcw,
} from 'lucide-react';
import {
  getTarefa, removerTarefa, aprovarTarefa, pedirAlteracaoTarefa,
} from './tarefasService';
import type { Tarefa } from './types';
import { statusTarefaClass, prazoVencido, LADO_LABEL } from './format';
import { temEtapas, etapaAtual, progressoEtapas, aguardandoAprovacaoCliente } from './etapas';
import { responsaveisTarefa } from './TarefaCard';
import { AtividadeFeed } from '@/atividade/AtividadeFeed';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dataBR } from '@/clientes/format';
import { useAuth } from '@/auth/useAuth';
import { ehCliente } from '@/auth/perms';
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
  const { user } = useAuth();
  const souCliente = ehCliente(user?.role);
  const [t, setT] = useState<Tarefa | null>(null);
  const [editando, setEditando] = useState(false);

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
              : cliNome
                ? <span>{cliNome}</span>
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
        {!souCliente && (
          <Button size="sm" variant="ghost" onClick={apagar} className="text-destructive hover:bg-destructive/10">
            <Trash2 /> Apagar
          </Button>
        )}
        <Button size="sm" onClick={() => setEditando(true)}>
          <Pencil /> Editar
        </Button>
      </div>

      <TarefaSheet
        tarefaId={t.id}
        aberto={editando}
        onClose={() => setEditando(false)}
        onMudou={() => getTarefa(id).then(setT)}
      />

      <AprovacaoTarefa t={t} souCliente={souCliente} onMudou={(nova) => setT(nova)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border p-0">
            <Linha
              rotulo="Projeto"
              valor={t.expand?.projeto?.nome ?? (cliNome ? '— (sem projeto específico)' : 'Tarefa interna')}
            />
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

/** Bloco de aprovação — o cliente aprova/pede alteração; a equipe vê o veredito. */
export function AprovacaoTarefa({
  t, souCliente, onMudou,
}: {
  t: Tarefa;
  souCliente: boolean;
  onMudou: (nova: Tarefa) => void;
}) {
  const [pedindo, setPedindo] = useState(false);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const aguardando = (t.status ?? '').toLowerCase().includes('aprova') || aguardandoAprovacaoCliente(t);
  const podeAgir = souCliente && aguardando;
  // Nada a mostrar pra equipe se ainda não há veredito nem está aguardando.
  if (!podeAgir && !t.aprovacao && !aguardando) return null;

  const etapa = temEtapas(t) ? etapaAtual(t.etapas) : null;
  const progresso = temEtapas(t) ? progressoEtapas(t.etapas) : null;

  async function aprovar() {
    setSalvando(true);
    setErro('');
    try { onMudou(await aprovarTarefa(t.id)); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro'); }
    finally { setSalvando(false); }
  }
  async function pedir() {
    setSalvando(true);
    setErro('');
    try {
      onMudou(await pedirAlteracaoTarefa(t.id, texto));
      setPedindo(false);
      setTexto('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro');
    } finally { setSalvando(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Aprovação do cliente</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {t.aprovacao === 'aprovada' && (
          <Badge className="w-fit border border-emerald-500/50 bg-emerald-500/15 text-emerald-400">
            <Check className="size-3.5" /> Aprovada pelo cliente
          </Badge>
        )}
        {t.aprovacao === 'alteracao' && (
          <Badge className="w-fit border border-destructive/50 bg-destructive/15 text-destructive">
            <RotateCcw className="size-3.5" /> Alteração solicitada
          </Badge>
        )}
        {!t.aprovacao && aguardando && (
          <div className="flex flex-col gap-1">
            {etapa && (
              <p className="text-sm font-medium text-primary">
                Aprovar: {etapa.texto}
                {progresso && ` · Etapa ${progresso.feitas + 1} de ${progresso.total}`}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {souCliente
                ? etapa ? 'Avalie a etapa acima e aprove ou solicite revisão.' : 'Esta tarefa está aguardando sua aprovação.'
                : 'Aguardando o cliente aprovar.'}
            </p>
          </div>
        )}

        {podeAgir && !pedindo && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={aprovar} disabled={salvando}>
              <Check /> Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPedindo(true)} disabled={salvando}>
              <RotateCcw /> Revisar
            </Button>
          </div>
        )}
        {podeAgir && pedindo && (
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Descreva o que precisa ser revisado nesta etapa…"
              className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={pedir} disabled={salvando || !texto.trim()}>
                {salvando ? 'Enviando…' : 'Enviar revisão'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPedindo(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </CardContent>
    </Card>
  );
}
