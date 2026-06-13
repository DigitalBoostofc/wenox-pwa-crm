import { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Trash2, ExternalLink, Check, X, Plus } from 'lucide-react';
import {
  getTarefa, atualizarTarefa, removerTarefa, criarTarefa,
} from './tarefasService';
import type { Tarefa, TarefaInput } from './types';
import { RECORRENCIA_LABEL } from './types';
import { statusTarefaClass, temHoraPrazo } from './format';
import { STATUS_TAREFA, STATUS_INICIAL } from './status';
import { AprovacaoTarefa } from './TarefaDetailPage';
import { AtividadeFeed } from '@/atividade/AtividadeFeed';
import { listProjetos } from '@/projetos/projetosService';
import { listClientes } from '@/clientes/clientesService';
import { listContatos } from '@/contatos/contatosService';
import { listUsuarios } from '@/usuarios/usuariosService';
import { nomeExibicao } from '@/clientes/types';
import type { Projeto } from '@/projetos/types';
import type { Cliente } from '@/clientes/types';
import type { Contato } from '@/contatos/types';
import type { Usuario } from '@/usuarios/types';
import { useAuth } from '@/auth/useAuth';
import { ehCliente } from '@/auth/perms';
import {
  Sheet, SheetContent, SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const inputCls =
  'h-9 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50';

const selectCls =
  'h-9 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50';

function RotuloCampo({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium text-muted-foreground">{children}</span>
  );
}

/** Retorna a data de hoje em YYYY-MM-DD usando partes locais (sem toISOString). */
function hojeLocal(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function TarefaSheet({
  tarefaId, aberto, onClose, onMudou, criar, presetProjeto, presetCliente,
}: {
  tarefaId: string | null;
  aberto: boolean;
  onClose: () => void;
  onMudou: () => void;
  criar?: boolean;
  presetProjeto?: string;
  presetCliente?: string;
}) {
  const history = useHistory();
  const { user } = useAuth();
  const souCliente = ehCliente(user?.role);

  /** true = painel em modo rascunho (criação); false = edição de tarefa existente. */
  const modoRascunho = !!criar;

  const [t, setT] = useState<Tarefa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroSalvo, setErroSalvo] = useState('');
  const [salvandoCriar, setSalvandoCriar] = useState(false);

  // Listas de suporte
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // Inputs controlados de adição
  const [novaTag, setNovaTag] = useState('');
  const [novoItemChecklist, setNovoItemChecklist] = useState('');
  const inputTagRef = useRef<HTMLInputElement>(null);

  // Guarda se o rascunho já foi inicializado nesta abertura
  const rascunhoIniciado = useRef(false);

  // Carrega listas de suporte uma única vez
  useEffect(() => {
    listProjetos().then(setProjetos);
    listClientes('').then(setClientes);
    listUsuarios().then(setUsuarios as never);
  }, []);

  // Inicializa rascunho ou carrega tarefa existente ao abrir
  useEffect(() => {
    if (!aberto) {
      setT(null);
      rascunhoIniciado.current = false;
      return;
    }

    if (modoRascunho) {
      if (rascunhoIniciado.current) return; // evita reset quando projetos recarregam
      rascunhoIniciado.current = true;
      const projetoPreset = projetos.find((p) => p.id === presetProjeto);
      const clienteId = projetoPreset?.cliente ?? presetCliente ?? '';
      setT({
        id: '',
        nome: '',
        status: STATUS_INICIAL,
        prazo: hojeLocal(),
        projeto: presetProjeto ?? '',
        cliente: clienteId,
        lado: 'wenox',
        responsaveis: user?.id ? [user.id] : [],
        contato: '',
        checklist: [],
        etiquetas: [],
        descricao: '',
        recorrencia: '',
      });
      return;
    }

    if (!tarefaId) { setT(null); return; }
    setCarregando(true);
    setErroSalvo('');
    getTarefa(tarefaId).then((rec) => {
      setT(rec as Tarefa);
      setCarregando(false);
    }).catch(() => setCarregando(false));
  // projetos na dep: necessário para derivar cliente quando projetos carregam antes do init
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, modoRascunho, tarefaId, projetos, presetProjeto, presetCliente, user?.id]);

  // Carrega contatos quando o cliente muda
  useEffect(() => {
    const cliId = t?.cliente;
    if (cliId) listContatos(cliId).then(setContatos);
    else setContatos([]);
  }, [t?.cliente]);

  // ---------- helpers ----------

  /**
   * Modo edição: atualiza estado local otimistamente e persiste via API.
   * Modo rascunho: apenas merge local, sem chamada à API.
   */
  async function salvarCampo(parcial: Partial<Tarefa>) {
    if (!t) return;
    if (modoRascunho) {
      setT({ ...t, ...parcial });
      return;
    }
    const anterior = t;
    setT({ ...t, ...parcial });
    setErroSalvo('');
    try {
      const atualizado = await atualizarTarefa(t.id, parcial as never);
      setT(atualizado as Tarefa);
      onMudou();
    } catch (e) {
      setErroSalvo(e instanceof Error ? e.message : 'Erro ao salvar');
      setT(anterior);
    }
  }

  function temCliente(): boolean {
    return !!(t?.cliente);
  }

  function lado(): 'wenox' | 'cliente' {
    return t?.lado === 'cliente' ? 'cliente' : 'wenox';
  }

  function nomeUsuario(id: string) {
    return usuarios.find((u) => u.id === id)?.nome || id;
  }

  function nomeCliente(id: string) {
    const c = clientes.find((cl) => cl.id === id);
    return c ? nomeExibicao(c) : id;
  }

  // Projetos ordenados por nome do cliente, com label 'Projeto — Cliente'
  const projetosOrdenados = [...projetos].sort((a, b) =>
    nomeCliente(a.cliente).localeCompare(nomeCliente(b.cliente), 'pt-BR'),
  );

  // ---------- handlers ----------

  function handleNomeBlur(e: React.FocusEvent<HTMLInputElement>) {
    const v = e.target.value.trim();
    if (v && v !== t?.nome) salvarCampo({ nome: v });
  }

  function handleNomeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const v = e.currentTarget.value.trim();
      if (v && v !== t?.nome) salvarCampo({ nome: v });
      e.currentTarget.blur();
    }
  }

  function handleStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    salvarCampo({ status: e.target.value });
  }

  function montarPrazo(data: string, hora: string): string {
    if (!data) return '';
    if (!hora) return data;
    return `${data} ${hora}:00`;
  }

  function handlePrioridade(p: 'alta' | 'media' | 'baixa') {
    salvarCampo({ prioridade: p });
  }

  function handleRecorrencia(r: '' | 'semanal' | 'quinzenal' | 'mensal') {
    salvarCampo({ recorrencia: r });
  }

  async function handleProjeto(e: React.ChangeEvent<HTMLSelectElement>) {
    const projetoId = e.target.value;
    if (!projetoId) {
      await salvarCampo({ projeto: '' });
    } else {
      const proj = projetos.find((p) => p.id === projetoId);
      const clienteId = proj?.cliente ?? '';
      // Atualiza estado local (merge direto para preservar regras de cascata)
      setT((prev) => prev ? {
        ...prev,
        projeto: projetoId,
        cliente: clienteId,
        expand: {
          ...prev.expand,
          projeto: proj ? { id: proj.id, nome: proj.nome } : undefined,
        },
      } : prev);
      if (modoRascunho) return;
      // Modo edição: persiste via API
      setErroSalvo('');
      try {
        const atualizado = await atualizarTarefa(t!.id, { projeto: projetoId, cliente: clienteId });
        setT(atualizado as Tarefa);
        onMudou();
      } catch (e2) {
        setErroSalvo(e2 instanceof Error ? e2.message : 'Erro ao salvar');
        if (t) setT({ ...t });
      }
    }
  }

  function handleClienteAvulso(e: React.ChangeEvent<HTMLSelectElement>) {
    salvarCampo({ cliente: e.target.value, projeto: '', contato: '' });
  }

  function handleLado(novoLado: 'wenox' | 'cliente') {
    if (novoLado === 'wenox') salvarCampo({ lado: 'wenox', contato: '' });
    else salvarCampo({ lado: 'cliente', responsaveis: [] });
  }

  function handleContato(e: React.ChangeEvent<HTMLSelectElement>) {
    salvarCampo({ contato: e.target.value });
  }

  function toggleResponsavel(uid: string) {
    const atuais = t?.responsaveis ?? [];
    const proximos = atuais.includes(uid)
      ? atuais.filter((x) => x !== uid)
      : [...atuais, uid];
    salvarCampo({ responsaveis: proximos });
  }

  // Checklist
  function adicionarItemChecklist() {
    const texto = novoItemChecklist.trim();
    if (!texto) return;
    const atuais = t?.checklist ?? [];
    salvarCampo({ checklist: [...atuais, { texto, feito: false }] });
    setNovoItemChecklist('');
  }

  function toggleItemChecklist(idx: number) {
    const atuais = t?.checklist ?? [];
    salvarCampo({
      checklist: atuais.map((item, i) => i === idx ? { ...item, feito: !item.feito } : item),
    });
  }

  function removerItemChecklist(idx: number) {
    const atuais = t?.checklist ?? [];
    salvarCampo({ checklist: atuais.filter((_, i) => i !== idx) });
  }

  // Etiquetas
  function adicionarTag() {
    const v = novaTag.trim();
    if (!v) return;
    const atuais = t?.etiquetas ?? [];
    if (!atuais.includes(v)) salvarCampo({ etiquetas: [...atuais, v] });
    setNovaTag('');
  }

  function removerTag(v: string) {
    salvarCampo({ etiquetas: (t?.etiquetas ?? []).filter((x) => x !== v) });
  }

  function handleDescricaoBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    if (v !== (t?.descricao ?? '')) salvarCampo({ descricao: v });
  }

  async function apagar() {
    if (!t) return;
    if (!confirm(`Apagar a tarefa "${t.nome}"? Esta ação não pode ser desfeita.`)) return;
    await removerTarefa(t.id);
    onClose();
    onMudou();
  }

  /** Confirma a criação da tarefa a partir do rascunho local. */
  async function confirmarCriacao() {
    if (!t || !t.nome.trim()) return;
    setSalvandoCriar(true);
    setErroSalvo('');
    try {
      const input: TarefaInput = {
        nome: t.nome.trim(),
        descricao: t.descricao ?? '',
        projeto: t.projeto ?? '',
        cliente: t.cliente ?? '',
        lado: t.lado ?? 'wenox',
        responsaveis: t.responsaveis ?? [],
        contato: t.contato ?? '',
        status: t.status ?? STATUS_INICIAL,
        prazo: t.prazo ?? '',
        prioridade: t.prioridade,
        recorrencia: t.recorrencia ?? '',
        etiquetas: t.etiquetas ?? [],
        checklist: t.checklist ?? [],
        ordem: 0,
      };
      await criarTarefa(input);
      onMudou();
      onClose();
    } catch (e) {
      setErroSalvo(e instanceof Error ? e.message : 'Erro ao criar tarefa');
    } finally {
      setSalvandoCriar(false);
    }
  }

  // ---------- render ----------

  const checklist = t?.checklist ?? [];
  const checklistFeitos = checklist.filter((i) => i.feito).length;

  return (
    <Sheet open={aberto} onOpenChange={(abr) => { if (!abr) onClose(); }}>
      <SheetContent
        side="right"
        className={cn('flex flex-col gap-0 overflow-y-auto p-0 w-full sm:w-[33vw] sm:min-w-[480px] sm:max-w-none')}
      >
        {/* Topo */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3 pr-12">
          <SheetTitle className="truncate text-base">
            {modoRascunho ? 'Nova tarefa' : (t?.nome ?? 'Carregando…')}
          </SheetTitle>
          {!modoRascunho && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-muted-foreground"
                onClick={() => {
                  if (t) { history.push(`/tarefas/${t.id}`); onClose(); }
                }}
              >
                <ExternalLink className="size-3.5" /> Abrir página completa
              </Button>
              {!souCliente && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={apagar}
                >
                  <Trash2 className="size-3.5" /> Apagar
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Corpo */}
        <div className="flex flex-col gap-5 px-5 py-5">
          {carregando && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!carregando && t && (
            <>
              {erroSalvo && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {erroSalvo}
                </p>
              )}

              {/* 1. Nome */}
              <div>
                <input
                  key={`nome-${t.id || 'rascunho'}`}
                  defaultValue={t.nome}
                  // Em rascunho captura cada tecla para habilitar o botão Criar
                  onChange={modoRascunho ? (e) => salvarCampo({ nome: e.target.value }) : undefined}
                  onBlur={handleNomeBlur}
                  onKeyDown={handleNomeKeyDown}
                  placeholder="Nome da tarefa"
                  className={cn(inputCls, 'h-10 text-base font-medium')}
                />
              </div>

              {/* 2. Status + Prazo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <RotuloCampo>Status</RotuloCampo>
                  <select
                    value={t.status ?? ''}
                    onChange={handleStatus}
                    className={selectCls}
                  >
                    <option value="">—</option>
                    {STATUS_TAREFA.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {t.status && (
                    <Badge className={cn('mt-1 border text-[10px]', statusTarefaClass(t.status))}>
                      {t.status}
                    </Badge>
                  )}
                </div>
                <div>
                  <RotuloCampo>Prazo</RotuloCampo>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      key={`prazo-d-${t.id || 'rascunho'}`}
                      defaultValue={(t.prazo ?? '').slice(0, 10)}
                      onChange={(e) => {
                        const hora = temHoraPrazo(t.prazo)
                          ? (t.prazo ?? '').replace('T', ' ').replace('Z', '').trim().split(/\s+/)[1]?.slice(0, 5) ?? ''
                          : '';
                        salvarCampo({ prazo: montarPrazo(e.target.value, hora) });
                      }}
                      className={cn(inputCls, 'flex-1 [color-scheme:dark]')}
                    />
                    <input
                      type="time"
                      key={`prazo-h-${t.id || 'rascunho'}`}
                      defaultValue={
                        temHoraPrazo(t.prazo)
                          ? (t.prazo ?? '').replace('T', ' ').replace('Z', '').trim().split(/\s+/)[1]?.slice(0, 5) ?? ''
                          : ''
                      }
                      onChange={(e) => {
                        const data = (t.prazo ?? '').slice(0, 10);
                        salvarCampo({ prazo: montarPrazo(data, e.target.value) });
                      }}
                      placeholder="HH:MM"
                      title="Horário limite (opcional)"
                      className={cn(inputCls, 'w-28 [color-scheme:dark]')}
                    />
                  </div>
                </div>
              </div>

              {/* 2b. Prioridade */}
              <div>
                <RotuloCampo>Prioridade</RotuloCampo>
                <div className="flex gap-2">
                  {(
                    [
                      { valor: 'alta', label: 'Alta' },
                      { valor: 'media', label: 'Média' },
                      { valor: 'baixa', label: 'Baixa' },
                    ] as const
                  ).map(({ valor, label }) => {
                    const ativo = (t.prioridade ?? 'media') === valor;
                    return (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => handlePrioridade(valor)}
                        className={cn(
                          'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                          ativo && valor === 'alta' &&
                            'border-orange-500/60 bg-orange-500/15 text-orange-400',
                          ativo && valor === 'media' &&
                            'border-primary/60 bg-primary/15 text-primary',
                          ativo && valor === 'baixa' &&
                            'border-border bg-secondary text-muted-foreground',
                          !ativo && 'border-border text-muted-foreground hover:bg-secondary',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2c. Repetir */}
              <div>
                <RotuloCampo>Repetir</RotuloCampo>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { valor: '' as const, label: 'Não' },
                      { valor: 'semanal' as const, label: RECORRENCIA_LABEL.semanal },
                      { valor: 'quinzenal' as const, label: RECORRENCIA_LABEL.quinzenal },
                      { valor: 'mensal' as const, label: RECORRENCIA_LABEL.mensal },
                    ]
                  ).map(({ valor, label }) => {
                    const ativo = (t.recorrencia ?? '') === valor;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleRecorrencia(valor)}
                        className={cn(
                          'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                          ativo
                            ? 'border-primary/60 bg-primary/15 text-primary'
                            : 'border-border text-muted-foreground hover:bg-secondary',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {t.recorrencia && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Ao concluir, uma nova ocorrência é criada com o próximo prazo.
                  </p>
                )}
              </div>

              {/* 3. Projeto */}
              <div>
                <RotuloCampo>Projeto</RotuloCampo>
                <select
                  value={t.projeto ?? ''}
                  onChange={handleProjeto}
                  className={selectCls}
                >
                  <option value="">Sem projeto</option>
                  {projetosOrdenados.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — {nomeCliente(p.cliente)}
                    </option>
                  ))}
                </select>
                {/* Cliente derivado do projeto */}
                {t.projeto && t.cliente && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cliente: {nomeCliente(t.cliente)}
                  </p>
                )}
                {/* Sem projeto: select opcional de cliente */}
                {!t.projeto && (
                  <div className="mt-2">
                    <RotuloCampo>Cliente (opcional)</RotuloCampo>
                    <select
                      value={t.cliente ?? ''}
                      onChange={handleClienteAvulso}
                      className={selectCls}
                    >
                      <option value="">Sem cliente</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>{nomeExibicao(c)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 4. Executor (lado) — só quando tem cliente */}
              {temCliente() && (
                <div>
                  <RotuloCampo>Executor</RotuloCampo>
                  <div className="flex gap-2">
                    {(['wenox', 'cliente'] as const).map((op) => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => handleLado(op)}
                        className={cn(
                          'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                          lado() === op
                            ? 'border-primary/60 bg-primary/15 text-primary'
                            : 'border-border text-muted-foreground hover:bg-secondary',
                        )}
                      >
                        {op === 'wenox' ? 'Wenox' : 'Cliente'}
                      </button>
                    ))}
                  </div>

                  {lado() === 'cliente' && (
                    <div className="mt-3">
                      <RotuloCampo>Contato responsável</RotuloCampo>
                      {contatos.length === 0 ? (
                        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                          Nenhum contato cadastrado para este cliente.
                        </p>
                      ) : (
                        <select
                          value={t.contato ?? ''}
                          onChange={handleContato}
                          className={selectCls}
                        >
                          <option value="">—</option>
                          {contatos.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}{c.cargo ? ` · ${c.cargo}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Responsáveis — lado wenox (ou sem cliente) */}
              {(!temCliente() || lado() === 'wenox') && (
                <div>
                  <RotuloCampo>Responsáveis</RotuloCampo>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          selectCls,
                          'flex items-center justify-between text-left',
                          !(t.responsaveis?.length) && 'text-muted-foreground',
                        )}
                      >
                        {(t.responsaveis?.length ?? 0) > 0
                          ? `${t.responsaveis!.length} selecionado(s)`
                          : 'Selecionar responsáveis'}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-64 w-64 overflow-y-auto">
                      {usuarios.map((u) => {
                        const ativo = (t.responsaveis ?? []).includes(u.id);
                        return (
                          <DropdownMenuItem
                            key={u.id}
                            onSelect={(e) => { e.preventDefault(); toggleResponsavel(u.id); }}
                          >
                            <Check className={cn('mr-2 size-3.5', ativo ? 'opacity-100' : 'opacity-0')} />
                            {u.nome || u.email}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {(t.responsaveis?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(t.responsaveis ?? []).map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs"
                        >
                          {nomeUsuario(id)}
                          <button
                            type="button"
                            onClick={() => toggleResponsavel(id)}
                            aria-label={`Remover ${nomeUsuario(id)}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5b. Checklist */}
              <div>
                <RotuloCampo>
                  Checklist{checklist.length > 0 && (
                    <span className="ml-1.5 font-normal text-muted-foreground/70">
                      {checklistFeitos}/{checklist.length}
                    </span>
                  )}
                </RotuloCampo>
                {checklist.length > 0 && (
                  <ul className="mb-2 flex flex-col gap-1.5">
                    {checklist.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleItemChecklist(idx)}
                          aria-label={item.feito ? 'Desmarcar' : 'Marcar como feito'}
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                            item.feito
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background hover:border-primary/60',
                          )}
                        >
                          {item.feito && <Check className="size-2.5" />}
                        </button>
                        <span className={cn('flex-1 text-sm', item.feito && 'line-through text-muted-foreground')}>
                          {item.texto}
                        </span>
                        <button
                          type="button"
                          onClick={() => removerItemChecklist(idx)}
                          aria-label={`Remover "${item.texto}"`}
                          className="text-muted-foreground/50 hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    value={novoItemChecklist}
                    onChange={(e) => setNovoItemChecklist(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarItemChecklist(); } }}
                    placeholder="Adicionar item…"
                    className={cn(inputCls, 'flex-1')}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={adicionarItemChecklist}>
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* 6. Etiquetas */}
              <div>
                <RotuloCampo>Etiquetas</RotuloCampo>
                {(t.etiquetas?.length ?? 0) > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {(t.etiquetas ?? []).map((et) => (
                      <span
                        key={et}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs"
                      >
                        {et}
                        <button
                          type="button"
                          onClick={() => removerTag(et)}
                          aria-label={`Remover ${et}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={inputTagRef}
                    value={novaTag}
                    onChange={(e) => setNovaTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarTag(); } }}
                    placeholder="Nova etiqueta…"
                    className={cn(inputCls, 'flex-1')}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={adicionarTag}>
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* 7. Descrição */}
              <div>
                <RotuloCampo>Descrição</RotuloCampo>
                <textarea
                  key={`desc-${t.id || 'rascunho'}`}
                  rows={4}
                  defaultValue={t.descricao ?? ''}
                  onBlur={handleDescricaoBlur}
                  placeholder="Detalhes da tarefa…"
                  className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                />
              </div>

              {/* Aprovação e atividade — apenas no modo edição */}
              {!modoRascunho && (
                <>
                  <AprovacaoTarefa
                    t={t}
                    souCliente={souCliente}
                    onMudou={(nova) => { setT(nova as Tarefa); onMudou(); }}
                  />
                  <AtividadeFeed entidade="tarefa" refId={t.id} />
                </>
              )}

              {/* Rodapé do modo rascunho */}
              {modoRascunho && (
                <div className="flex gap-2 border-t border-border pt-4">
                  <Button
                    onClick={confirmarCriacao}
                    disabled={salvandoCriar || !t.nome.trim()}
                  >
                    {salvandoCriar ? 'Criando…' : 'Criar tarefa'}
                  </Button>
                  <Button variant="ghost" onClick={onClose} disabled={salvandoCriar}>
                    Cancelar
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
