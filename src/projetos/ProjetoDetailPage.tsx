import { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import {
  ArrowLeft, Pencil, FolderKanban, Plus, Trash2, CalendarDays, ListChecks,
} from 'lucide-react';
import { TarefasTabProjeto } from '@/tarefas/TarefasTabProjeto';
import { getProjeto, removerProjeto } from './projetosService';
import { listEtapas } from './etapasService';
import type { Projeto, EtapaProjeto } from './types';
import {
  listAtividadesSocial, criarAtividadeSocial,
  atualizarAtividadeSocial, removerAtividadeSocial,
} from './atividadesSocialService';
import type { AtividadeSocial } from './atividadesSocialService';
import { AtividadeFeed } from '@/atividade/AtividadeFeed';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dataBR } from '@/clientes/format';
import {
  statusVariantParaTipo,
  STATUS_ATIVIDADE_SOCIAL,
  TIPO_SOCIAL_MEDIA,
} from './format';
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

const selectCls =
  'h-9 rounded-md border border-input bg-background/40 px-2 text-xs text-foreground [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

function AtividadesSection({ projetoId }: { projetoId: string }) {
  const [atividades, setAtividades] = useState<AtividadeSocial[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [adicionando, setAdicionando] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoMes, setNovoMes] = useState('');
  const [novoStatus, setNovoStatus] = useState<string>(STATUS_ATIVIDADE_SOCIAL[0]);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setCarregando(true);
    try { setAtividades(await listAtividadesSocial(projetoId)); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, [projetoId]);

  async function salvarNova() {
    if (!novoNome.trim()) return;
    setSalvando(true);
    try {
      await criarAtividadeSocial({
        nome: novoNome.trim(),
        projeto: projetoId,
        status: novoStatus,
        mes_referencia: novoMes.trim() || undefined,
        ordem: atividades.length + 1,
      });
      setNovoNome(''); setNovoMes(''); setNovoStatus(STATUS_ATIVIDADE_SOCIAL[0]);
      setAdicionando(false);
      await carregar();
    } finally { setSalvando(false); }
  }

  async function trocarStatus(id: string, status: string) {
    setAtividades((lst) => lst.map((a) => (a.id === id ? { ...a, status } : a)));
    await atualizarAtividadeSocial(id, { status });
  }

  async function apagar(id: string) {
    if (!confirm('Apagar esta atividade?')) return;
    await removerAtividadeSocial(id);
    setAtividades((lst) => lst.filter((a) => a.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            Atividades
          </CardTitle>
          {!adicionando && (
            <Button size="sm" variant="outline" onClick={() => setAdicionando(true)}>
              <Plus className="size-3.5" /> Nova atividade
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {carregando ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="divide-y divide-border">
            {/* Linha de nova atividade */}
            {adicionando && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-secondary/40">
                <input
                  autoFocus
                  placeholder="Nome da atividade (ex: Calendário de Posts - Maio 2026)"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarNova(); if (e.key === 'Escape') setAdicionando(false); }}
                  className="h-9 min-w-48 flex-1 rounded-md border border-input bg-background/40 px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                />
                <input
                  placeholder="Mês (ex: Maio 2026)"
                  value={novoMes}
                  onChange={(e) => setNovoMes(e.target.value)}
                  className="h-9 w-36 rounded-md border border-input bg-background/40 px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                />
                <select
                  value={novoStatus}
                  onChange={(e) => setNovoStatus(e.target.value)}
                  className={selectCls}
                >
                  {STATUS_ATIVIDADE_SOCIAL.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Button size="sm" onClick={salvarNova} disabled={salvando || !novoNome.trim()}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdicionando(false)}>
                  Cancelar
                </Button>
              </div>
            )}

            {atividades.length === 0 && !adicionando ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhuma atividade cadastrada. Clique em <strong>Nova atividade</strong> para começar.
              </p>
            ) : (
              atividades.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{a.nome}</p>
                    {a.mes_referencia && (
                      <p className="text-xs text-muted-foreground">{a.mes_referencia}</p>
                    )}
                  </div>
                  <select
                    value={a.status ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { e.stopPropagation(); trocarStatus(a.id, e.target.value); }}
                    className={cn(
                      selectCls, 'rounded-full border px-3 font-medium',
                      a.status === 'Copy'        && 'border-amber-500/50 bg-amber-500/15 text-amber-400',
                      a.status === 'Layout'      && 'border-primary/50 bg-primary/15 text-primary',
                      a.status === 'Aprovação'   && 'border-border bg-secondary text-muted-foreground',
                      a.status === 'Alteração'   && 'border-destructive/50 bg-destructive/15 text-destructive',
                      a.status === 'Agendamento' && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400',
                      a.status === 'Publicação'  && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400',
                      !a.status && 'border-border bg-secondary text-muted-foreground',
                    )}
                  >
                    <option value="">—</option>
                    {STATUS_ATIVIDADE_SOCIAL.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => apagar(a.id)}
                    aria-label="Apagar atividade"
                    className="rounded-md p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
    if (p?.tipo && p.tipo !== TIPO_SOCIAL_MEDIA) listEtapas(p.tipo).then(setEtapas);
  }, [p?.tipo]);

  if (!p) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>
    );
  }

  const isSocialMedia = p.tipo === TIPO_SOCIAL_MEDIA;
  const cli = p.expand?.cliente;

  async function apagar() {
    if (!p) return;
    if (!confirm(`Apagar o projeto "${p.nome}" definitivamente? Esta ação não pode ser desfeita.`)) return;
    await removerProjeto(p.id);
    history.push('/projetos');
  }
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
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{cliNome} · {p.tipo || 'Sem tipo'}</span>
            {p.status && (
              <Badge variant={statusVariantParaTipo(p.tipo, p.status)} className="text-[10px]">
                {p.status}
              </Badge>
            )}
            {!isSocialMedia && p.etapa && (
              <Badge variant="muted" className="text-[10px]">
                {p.etapa}
                {etapas.length > 0 && etapaIdx >= 0 && ` (${etapaIdx + 1}/${etapas.length})`}
              </Badge>
            )}
          </div>
        </div>
        {cli && (
          <Button variant="outline" size="sm" onClick={() => history.push(`/clientes/${cli.id}`)}>
            Abrir cliente
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={apagar} className="text-destructive hover:bg-destructive/10">
          <Trash2 /> Apagar
        </Button>
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
            <Linha rotulo="Status" valor={p.status ? (
              <Badge variant={statusVariantParaTipo(p.tipo, p.status)} className="text-[10px]">
                {p.status}
              </Badge>
            ) : undefined} />
            {!isSocialMedia && <Linha rotulo="Etapa" valor={p.etapa} />}
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

      {isSocialMedia && <AtividadesSection projetoId={p.id} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-4 text-muted-foreground" />
            Tarefas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TarefasTabProjeto projetoId={p.id} />
        </CardContent>
      </Card>

      <AtividadeFeed entidade="projeto" refId={p.id} />
    </div>
  );
}
