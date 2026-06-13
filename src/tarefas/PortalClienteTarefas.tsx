import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ListChecks, RotateCcw } from 'lucide-react';
import {
  listTarefas, aprovarTarefa, pedirAlteracaoTarefa,
} from './tarefasService';
import type { Tarefa } from './types';
import { statusTarefaClass, tarefaConcluida, prazoVencido } from './format';
import { temEtapas, etapaAtual, progressoEtapas, aguardandoAprovacaoCliente } from './etapas';
import { dataBR } from '@/clientes/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Cabeçalho de seção                                                         */
/* -------------------------------------------------------------------------- */

function CabecalhoSecao({
  titulo, total, aberta, onToggle, destaque,
}: {
  titulo: string;
  total: number;
  aberta: boolean;
  onToggle: () => void;
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground',
        destaque ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {aberta
        ? <ChevronDown className="size-3.5" />
        : <ChevronRight className="size-3.5" />}
      <span>{titulo}</span>
      <span className={cn(
        'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
        destaque
          ? 'bg-primary/15 text-primary'
          : 'bg-secondary text-muted-foreground',
      )}>
        {total}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Seção 1: Aguardando aprovação (cards com ações inline)                     */
/* -------------------------------------------------------------------------- */

function CardAprovacao({
  t, onAbrir, onAcao,
}: {
  t: Tarefa;
  onAbrir: (id: string) => void;
  onAcao: () => void;
}) {
  const [pedindo, setPedindo] = useState(false);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const vencida = prazoVencido(t.prazo, t.status);

  async function handleAprovar(e: React.MouseEvent) {
    e.stopPropagation();
    setSalvando(true);
    setErro('');
    try {
      await aprovarTarefa(t.id);
      onAcao();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao aprovar');
    } finally {
      setSalvando(false);
    }
  }

  async function handleEnviarAlteracao(e: React.MouseEvent) {
    e.stopPropagation();
    if (!texto.trim()) return;
    setSalvando(true);
    setErro('');
    try {
      await pedirAlteracaoTarefa(t.id, texto);
      onAcao();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAbrir(t.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAbrir(t.id); }}
      className="flex cursor-pointer flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
    >
      {/* Cabeçalho do card */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{t.nome}</p>
          {t.expand?.projeto?.nome && (
            <p className="mt-0.5 text-xs text-muted-foreground">{t.expand.projeto.nome}</p>
          )}
          {temEtapas(t) && etapaAtual(t.etapas) && (
            <p className="mt-1 text-xs font-medium text-primary">
              Aprovar: {etapaAtual(t.etapas)!.texto}
              {(() => { const p = progressoEtapas(t.etapas); return ` · Etapa ${p.feitas + 1} de ${p.total}`; })()}
            </p>
          )}
        </div>
        {t.prazo && (
          <span className={cn(
            'shrink-0 text-xs',
            vencida ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}>
            {dataBR(t.prazo)}{vencida && ' (vencido)'}
          </span>
        )}
      </div>

      {/* Ações de aprovação */}
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
        className="flex flex-col gap-2"
      >
        {!pedindo && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleAprovar} disabled={salvando}>
              <CheckCircle2 className="size-3.5" />
              {salvando ? 'Aprovando…' : 'Aprovar'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); setPedindo(true); }}
              disabled={salvando}
            >
              <RotateCcw className="size-3.5" /> Pedir alteração
            </Button>
          </div>
        )}

        {pedindo && (
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="O que precisa ser alterado?"
              className="w-full rounded-md border border-input bg-background/60 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEnviarAlteracao} disabled={salvando || !texto.trim()}>
                {salvando ? 'Enviando…' : 'Enviar pedido'}
              </Button>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setPedindo(false); setTexto(''); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Linha simples (seções 2, 3 e 4)                                            */
/* -------------------------------------------------------------------------- */

function LinhaTarefa({
  t, onAbrir, riscado,
}: {
  t: Tarefa;
  onAbrir: (id: string) => void;
  riscado?: boolean;
}) {
  const vencida = prazoVencido(t.prazo, t.status);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAbrir(t.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onAbrir(t.id); }}
      className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-secondary/60"
    >
      {/* Nome */}
      <span className={cn('min-w-0 flex-1 font-medium', riscado && 'line-through text-muted-foreground')}>
        {t.nome}
      </span>

      {/* Metadados à direita */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Projeto ou contato responsável */}
        {t.expand?.projeto?.nome && (
          <span className="text-xs text-muted-foreground">{t.expand.projeto.nome}</span>
        )}
        {t.expand?.contato?.nome && (
          <span className="text-xs text-muted-foreground">{t.expand.contato.nome}</span>
        )}

        {/* Status (só nas tarefas "Em andamento") */}
        {t.status && !riscado && (
          <Badge className={cn('border text-[10px]', statusTarefaClass(t.status))}>
            {t.status}
          </Badge>
        )}

        {/* Prazo */}
        {t.prazo && (
          <span className={cn(
            'text-[11px]',
            vencida ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}>
            {dataBR(t.prazo)}
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Seção genérica (título + lista de linhas)                                  */
/* -------------------------------------------------------------------------- */

function SecaoLinhas({
  titulo, tarefas, onAbrir, recolhidaInicial, destaque, riscado,
}: {
  titulo: string;
  tarefas: Tarefa[];
  onAbrir: (id: string) => void;
  recolhidaInicial?: boolean;
  destaque?: boolean;
  riscado?: boolean;
}) {
  const [aberta, setAberta] = useState(!recolhidaInicial);
  if (tarefas.length === 0) return null;

  return (
    <div className="flex flex-col">
      <CabecalhoSecao
        titulo={titulo}
        total={tarefas.length}
        aberta={aberta}
        onToggle={() => setAberta((v) => !v)}
        destaque={destaque}
      />
      {aberta && (
        <div className="flex flex-col divide-y divide-border/40">
          {tarefas.map((t) => (
            <LinhaTarefa key={t.id} t={t} onAbrir={onAbrir} riscado={riscado} />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Seção de aprovação (cards)                                                 */
/* -------------------------------------------------------------------------- */

function SecaoAprovacao({
  tarefas, onAbrir, onRecarregar,
}: {
  tarefas: Tarefa[];
  onAbrir: (id: string) => void;
  onRecarregar: () => void;
}) {
  const [aberta, setAberta] = useState(true);
  if (tarefas.length === 0) return null;

  return (
    <div className="flex flex-col">
      <CabecalhoSecao
        titulo="Aguardando sua aprovação"
        total={tarefas.length}
        aberta={aberta}
        onToggle={() => setAberta((v) => !v)}
        destaque
      />
      {aberta && (
        <div className="flex flex-col gap-3 px-2 py-2">
          {tarefas.map((t) => (
            <CardAprovacao key={t.id} t={t} onAbrir={onAbrir} onAcao={onRecarregar} />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Componente principal                                                        */
/* -------------------------------------------------------------------------- */

export function PortalClienteTarefas({
  clienteId, onAbrir,
}: {
  clienteId: string;
  onAbrir: (id: string) => void;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const res = await listTarefas({ clienteId });
      setTarefas(res);
    } catch {
      setErro('Não foi possível carregar as tarefas. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  // ---------- agrupamento ----------

  /** Seção 1: não concluídas, aguardando aprovação, sem veredito ainda. */
  const aguardandoAprovacao = tarefas.filter(
    (t) => !tarefaConcluida(t.status)
      && ((t.status ?? '').toLowerCase().includes('aprova') || aguardandoAprovacaoCliente(t))
      && !t.aprovacao,
  );

  /** Seção 2: pendências do cliente (lado cliente, não concluídas, fora da seção 1). */
  const pendenciasCliente = tarefas.filter(
    (t) => !tarefaConcluida(t.status)
      && t.lado === 'cliente'
      && !aguardandoAprovacao.some((a) => a.id === t.id),
  );

  /** IDs já alocados nas seções 1 e 2 (para não repetir na seção 3). */
  const idsAlocados = new Set([
    ...aguardandoAprovacao.map((t) => t.id),
    ...pendenciasCliente.map((t) => t.id),
  ]);

  /** Seção 3: em andamento com a Wenox (demais não concluídas). */
  const emAndamento = tarefas.filter(
    (t) => !tarefaConcluida(t.status) && !idsAlocados.has(t.id),
  );

  /** Seção 4: concluídas. */
  const concluidas = tarefas.filter((t) => tarefaConcluida(t.status));

  const temAlguma =
    aguardandoAprovacao.length + pendenciasCliente.length +
    emAndamento.length + concluidas.length > 0;

  // ---------- render ----------

  if (carregando) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (erro) {
    return (
      <Card className="px-5 py-8 text-center">
        <p className="text-sm text-destructive">{erro}</p>
        <Button variant="ghost" size="sm" className="mt-3" onClick={carregar}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  if (!temAlguma) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <ListChecks className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma tarefa por aqui ainda.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-border/40">
      <SecaoAprovacao
        tarefas={aguardandoAprovacao}
        onAbrir={onAbrir}
        onRecarregar={carregar}
      />
      <SecaoLinhas
        titulo="Suas pendências"
        tarefas={pendenciasCliente}
        onAbrir={onAbrir}
      />
      <SecaoLinhas
        titulo="Em andamento com a Wenox"
        tarefas={emAndamento}
        onAbrir={onAbrir}
      />
      <SecaoLinhas
        titulo="Concluídas"
        tarefas={concluidas}
        onAbrir={onAbrir}
        recolhidaInicial
        riscado
      />
    </Card>
  );
}
