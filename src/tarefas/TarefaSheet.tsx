import { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Trash2, ExternalLink, Check, X, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import {
  getTarefa, atualizarTarefa, removerTarefa, criarTarefa,
  salvarEtapas, concluirEtapa, reabrirEtapa, reenviarAprovacao,
} from './tarefasService';
import type { Tarefa, TarefaInput, EtapaTarefa, TipoEtapa } from './types';
import { RECORRENCIA_LABEL } from './types';
import { etapaAtualIndex, progressoEtapas, novaEtapaId } from './etapas';
import { EtapasStepper } from './EtapasStepper';
import { usePresetsEtapa, presetsDoTipo, type PresetEtapa } from './etapasPreset';
import { StatusOpcaoChip } from './StatusOpcaoChip';
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
import { ehCliente, canGerirEquipe } from '@/auth/perms';
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

/* -------------------------------------------------------------------------- */
/*  Etapas do fluxo                                                           */
/* -------------------------------------------------------------------------- */

function EtapasFluxoEditor({
  tarefa: t,
  setTarefa: setT,
  modoRascunho,
  nomeUsuario,
  tipoTarefa,
  onMudou,
  setErro,
}: {
  tarefa: Tarefa;
  setTarefa: (t: Tarefa) => void;
  modoRascunho: boolean;
  nomeUsuario: (id: string) => string;
  /** Tipo da tarefa (do projeto) — define quais etapas-modelo aparecem. */
  tipoTarefa: string;
  onMudou: () => void;
  setErro: (e: string) => void;
}) {
  const [novoTexto, setNovoTexto] = useState('');
  const [novoTipo, setNovoTipo] = useState<TipoEtapa>('interna');
  const [novoResp, setNovoResp] = useState('');
  usePresetsEtapa(); // re-renderiza quando os modelos mudam
  const presets = presetsDoTipo(tipoTarefa);

  const etapas = t.etapas ?? [];
  const { feitas, total } = progressoEtapas(etapas);
  const idxAtual = etapaAtualIndex(etapas);

  async function persistirEtapas(novas: EtapaTarefa[]) {
    // R3.c: ao remover a última etapa com >1 responsável, truncar para 1.
    const trimResp = novas.length === 0 && (t.responsaveis?.length ?? 0) > 1;
    if (modoRascunho) {
      setT({ ...t, etapas: novas, ...(trimResp ? { responsaveis: [t.responsaveis![0]] } : {}) });
      return;
    }
    setErro('');
    try {
      const atualizada = await salvarEtapas(t, novas, trimResp ? { responsaveis: [t.responsaveis![0]] } : {});
      setT(atualizada);
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar etapas');
    }
  }

  function adicionar() {
    const texto = novoTexto.trim();
    if (!texto) return;
    const nova: EtapaTarefa = {
      id: novaEtapaId(),
      texto,
      tipo: novoTipo,
      responsavel: novoTipo === 'interna' ? novoResp : undefined,
      feito: false,
    };
    persistirEtapas([...etapas, nova]);
    setNovoTexto('');
    setNovoTipo('interna');
    setNovoResp('');
  }

  function remover(id: string) {
    persistirEtapas(etapas.filter((e) => e.id !== id));
  }

  /** Insere uma ou mais etapas-modelo, garantindo o responsável na tarefa. */
  async function inserirPresets(ps: PresetEtapa[]) {
    if (ps.length === 0) return;
    const novas: EtapaTarefa[] = ps.map((p) => ({
      id: novaEtapaId(),
      texto: p.texto,
      tipo: p.tipo,
      responsavel: p.tipo === 'interna' ? (p.responsavel || undefined) : undefined,
      feito: false,
    }));
    const respAtuais = new Set(t.responsaveis ?? []);
    const addResp: string[] = [];
    for (const n of novas) {
      if (n.responsavel && !respAtuais.has(n.responsavel)) { respAtuais.add(n.responsavel); addResp.push(n.responsavel); }
    }
    const novosResp = [...(t.responsaveis ?? []), ...addResp];
    const todas = [...etapas, ...novas];
    if (modoRascunho) {
      setT({ ...t, etapas: todas, responsaveis: novosResp });
      return;
    }
    setErro('');
    try {
      const atualizada = await salvarEtapas(t, todas, addResp.length ? { responsaveis: novosResp } : {});
      setT(atualizada);
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar etapas');
    }
  }

  function mover(idx: number, dir: -1 | 1) {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= etapas.length) return;
    const copia = [...etapas];
    [copia[idx], copia[alvo]] = [copia[alvo], copia[idx]];
    persistirEtapas(copia);
  }

  function editarTexto(id: string, texto: string) {
    persistirEtapas(etapas.map((e) => e.id === id ? { ...e, texto } : e));
  }

  function editarResp(id: string, responsavel: string) {
    persistirEtapas(etapas.map((e) => e.id === id ? { ...e, responsavel } : e));
  }

  function editarTipo(id: string, tipo: TipoEtapa) {
    persistirEtapas(etapas.map((e) => e.id === id ? {
      ...e, tipo, responsavel: tipo === 'aprovacao_cliente' ? undefined : e.responsavel,
    } : e));
  }

  function editarPrazo(id: string, prazo: string) {
    setErro('');
    persistirEtapas(etapas.map((e) => e.id === id ? { ...e, prazo: prazo || undefined } : e));
  }

  async function handleConcluir(etapaId: string) {
    setErro('');
    try {
      const atualizada = await concluirEtapa(t, etapaId);
      setT(atualizada);
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao concluir etapa');
    }
  }

  async function handleReabrir(etapaId: string) {
    setErro('');
    try {
      const atualizada = await reabrirEtapa(t, etapaId);
      setT(atualizada);
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao reabrir etapa');
    }
  }

  async function handleReenviar() {
    setErro('');
    try {
      const atualizada = await reenviarAprovacao(t);
      setT(atualizada);
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao reenviar aprovação');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <RotuloCampo>
        Etapas do fluxo{total > 0 && (
          <span className="ml-1.5 font-normal text-muted-foreground/70">
            {feitas}/{total}
          </span>
        )}
      </RotuloCampo>

      {etapas.length > 0 && (
        <ul className="flex flex-col gap-1">
          {etapas.map((e, idx) => {
            const ehAtual = idx === idxAtual;
            const ehFutura = idxAtual >= 0 && idx > idxAtual;

            return (
              <li
                key={e.id}
                className={cn(
                  'flex flex-col gap-1.5 rounded-md border px-3 py-2',
                  ehAtual ? 'border-primary/50 bg-primary/5' : 'border-border',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
                    {e.feito ? '✓' : idx + 1}
                  </span>

                  <input
                    defaultValue={e.texto}
                    onBlur={(ev) => {
                      const v = ev.target.value.trim();
                      if (v && v !== e.texto) editarTexto(e.id, v);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                  />

                  <Badge
                    className={cn(
                      'shrink-0 border text-[10px]',
                      e.tipo === 'aprovacao_cliente'
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                        : 'border-border bg-secondary text-muted-foreground',
                    )}
                  >
                    {e.tipo === 'aprovacao_cliente' ? 'Aprovação' : 'Interna'}
                  </Badge>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button type="button" onClick={() => mover(idx, -1)} disabled={idx === 0}
                      className="text-muted-foreground/50 hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => mover(idx, 1)} disabled={idx === etapas.length - 1}
                      className="text-muted-foreground/50 hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => remover(e.id)}
                      className="ml-1 text-muted-foreground/50 hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Linha de meta: responsável + select tipo + estado */}
                <div className="flex flex-wrap items-center gap-2 pl-7 text-xs">
                  {e.tipo === 'interna' && (
                    (t.responsaveis?.length ?? 0) > 0 ? (
                      <select
                        value={e.responsavel ?? ''}
                        onChange={(ev) => editarResp(e.id, ev.target.value)}
                        className="h-7 rounded border border-input bg-background/40 px-2 text-xs"
                      >
                        <option value="">Sem responsável</option>
                        {(t.responsaveis ?? []).map((id) => (
                          <option key={id} value={id}>{nomeUsuario(id)}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        Selecione os responsáveis da tarefa para atribuir etapas.
                      </span>
                    )
                  )}
                  <select
                    value={e.tipo}
                    onChange={(ev) => editarTipo(e.id, ev.target.value as TipoEtapa)}
                    className="h-7 rounded border border-input bg-background/40 px-2 text-xs"
                  >
                    <option value="interna">Interna</option>
                    <option value="aprovacao_cliente">Aprovação do cliente</option>
                  </select>

                  <input
                    type="date"
                    value={(e.prazo ?? '').slice(0, 10)}
                    onChange={(ev) => editarPrazo(e.id, ev.target.value)}
                    title="Prazo da etapa"
                    className="h-7 rounded border border-input bg-background/40 px-2 text-xs text-muted-foreground"
                  />

                  {/* Estado */}
                  {e.feito ? (
                    <span className="text-emerald-500">
                      ✓ {e.feito_por ? (e.feito_por === 'cliente' ? 'Cliente' : nomeUsuario(e.feito_por)) : 'concluída'}
                    </span>
                  ) : ehAtual ? (
                    <span className="font-medium text-primary">Etapa atual</span>
                  ) : ehFutura ? (
                    <span className="text-muted-foreground">Aguardando</span>
                  ) : null}
                </div>

                {/* Ações da etapa atual (só modo edição) */}
                {!modoRascunho && ehAtual && e.tipo === 'interna' && (
                  <div className="flex gap-2 pl-7">
                    <Button type="button" size="sm" className="h-7 text-xs" onClick={() => handleConcluir(e.id)}>
                      Concluir etapa
                    </Button>
                  </div>
                )}
                {!modoRascunho && ehAtual && e.tipo === 'aprovacao_cliente' && (
                  <div className="pl-7">
                    {t.aprovacao === 'alteracao' ? (
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={handleReenviar}>
                        Reenviar para aprovação
                      </Button>
                    ) : (
                      <span className="text-xs text-amber-400">Aguardando aprovação do cliente</span>
                    )}
                  </div>
                )}
                {/* Reabrir etapa feita (só modo edição) */}
                {!modoRascunho && e.feito && (
                  <div className="flex gap-2 pl-7">
                    <button
                      type="button"
                      onClick={() => handleReabrir(e.id)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Reabrir
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Adicionar etapa */}
      <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2">
        {presets.length > 0 && (
          <select
            value=""
            onChange={(ev) => {
              const v = ev.target.value;
              if (v === '__todas__') inserirPresets(presets);
              else { const p = presets.find((x) => x.id === v); if (p) inserirPresets([p]); }
              ev.target.value = '';
            }}
            className="h-7 rounded border border-primary/40 bg-primary/5 px-2 text-xs text-primary"
            aria-label="Inserir etapa do modelo"
          >
            <option value="">+ Inserir etapa do modelo…</option>
            <option value="__todas__">★ Aplicar modelo completo ({presets.length})</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.texto}
                {p.tipo === 'aprovacao_cliente'
                  ? ' · Aprovação'
                  : p.responsavel ? ` · ${nomeUsuario(p.responsavel)}` : ''}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          <input
            value={novoTexto}
            onChange={(ev) => setNovoTexto(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); adicionar(); } }}
            placeholder="Nova etapa…"
            className={cn(inputCls, 'flex-1')}
          />
          <Button type="button" variant="outline" size="sm" onClick={adicionar} disabled={!novoTexto.trim()}>
            <Plus className="size-3.5" />
          </Button>
        </div>
        <div className="flex gap-2">
          <select
            value={novoTipo}
            onChange={(ev) => setNovoTipo(ev.target.value as TipoEtapa)}
            className="h-7 rounded border border-input bg-background/40 px-2 text-xs"
          >
            <option value="interna">Interna</option>
            <option value="aprovacao_cliente">Aprovação do cliente</option>
          </select>
          {novoTipo === 'interna' && (
            (t.responsaveis?.length ?? 0) > 0 ? (
              <select
                value={novoResp}
                onChange={(ev) => setNovoResp(ev.target.value)}
                className="h-7 flex-1 rounded border border-input bg-background/40 px-2 text-xs"
              >
                <option value="">Sem responsável</option>
                {(t.responsaveis ?? []).map((id) => (
                  <option key={id} value={id}>{nomeUsuario(id)}</option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                Selecione os responsáveis da tarefa para atribuir etapas.
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export function TarefaSheet({
  tarefaId, aberto, onClose, onMudou, criar, presetProjeto, presetCliente, tipoProjeto,
}: {
  tarefaId: string | null;
  aberto: boolean;
  onClose: () => void;
  onMudou: () => void;
  criar?: boolean;
  presetProjeto?: string;
  presetCliente?: string;
  /** Restringe o dropdown de Projeto a este tipo (vem da barra de tipos da página). */
  tipoProjeto?: string;
}) {
  const history = useHistory();
  const { user } = useAuth();
  const souCliente = ehCliente(user?.role);
  /** Membro/Visualizador: precisa ficar como responsável da tarefa que cria. */
  const ehMembro = !souCliente && !canGerirEquipe(user?.role);

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
        prazo: hojeLocal(),
        projeto: presetProjeto ?? '',
        cliente: clienteId,
        lado: 'wenox',
        responsaveis: user?.id ? [user.id] : [],
        contato: '',
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
    // Membro não pode se remover: tem que ser responsável da própria tarefa.
    if (ehMembro && uid === user?.id && atuais.includes(uid)) return;
    // R3.c: sem etapas → modo single (substitui em vez de acumular).
    const semEtapas = (t?.etapas?.length ?? 0) === 0;
    const proximos = atuais.includes(uid)
      ? atuais.filter((x) => x !== uid)
      : semEtapas ? [uid] : [...atuais, uid];
    salvarCampo({ responsaveis: proximos });
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
        prazo: t.prazo ?? '',
        prioridade: t.prioridade,
        recorrencia: t.recorrencia ?? '',
        etiquetas: t.etiquetas ?? [],
        etapas: t.etapas ?? [],
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

              {/* 2. Status (manual — definido no quadro/kanban ou na visão da tarefa) */}
              <div>
                <RotuloCampo>Status</RotuloCampo>
                <div className="flex items-center gap-2">
                  <StatusOpcaoChip opcaoId={t.status_opcao} statusLegado={t.status} />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  O status é definido manualmente — arraste no quadro (kanban) ou escolha na visão da tarefa. As etapas abaixo são um checklist informativo; o prazo fica em cada etapa.
                </p>
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

              {/* 2c. Repetir — oculto para tarefas Social Media (gerenciadas pelo quadro) */}
              {t.tipo !== 'Social Media' && (
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
              )}

              {/* 3. Projeto */}
              <div>
                <RotuloCampo>Projeto</RotuloCampo>
                <select
                  value={t.projeto ?? ''}
                  onChange={handleProjeto}
                  className={selectCls}
                >
                  <option value="">Sem projeto</option>
                  {projetosOrdenados
                    .filter((p) => p.id === t.projeto || !tipoProjeto || p.tipo === tipoProjeto)
                    .map((p) => (
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
                  <RotuloCampo>
                    {(t.etapas?.length ?? 0) === 0 ? 'Responsável' : 'Responsáveis'}
                  </RotuloCampo>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={(t.etapas?.length ?? 0) === 0 ? 'Selecionar responsável' : 'Selecionar responsáveis'}
                        className={cn(
                          selectCls,
                          'flex items-center justify-between text-left',
                          !(t.responsaveis?.length) && 'text-muted-foreground',
                        )}
                      >
                        {(t.responsaveis?.length ?? 0) > 0
                          ? `${t.responsaveis!.length} selecionado(s)`
                          : (t.etapas?.length ?? 0) === 0
                            ? 'Selecionar responsável'
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
                  {(t.etapas?.length ?? 0) === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sem etapas: apenas 1 responsável. Adicione etapas para atribuir múltiplos.
                    </p>
                  )}
                  {(t.responsaveis?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(t.responsaveis ?? []).map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs"
                        >
                          {nomeUsuario(id)}
                          {!(ehMembro && id === user?.id) && (
                            <button
                              type="button"
                              onClick={() => toggleResponsavel(id)}
                              aria-label={`Remover ${nomeUsuario(id)}`}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5b. Progresso visual das etapas (R3.b) */}
              {!modoRascunho && (t.etapas?.length ?? 0) > 0 && (
                <div>
                  <RotuloCampo>Progresso das etapas</RotuloCampo>
                  <EtapasStepper
                    etapas={t.etapas}
                    responsaveis={
                      (t.responsaveis ?? [])
                        .map((id) => {
                          const u = usuarios.find((u2) => u2.id === id);
                          if (!u) return null;
                          return {
                            id: u.id,
                            nome: u.nome ?? u.email ?? '',
                            foto: u.foto,
                            collectionId: u.collectionId,
                            collectionName: u.collectionName,
                          };
                        })
                        .filter((r): r is NonNullable<typeof r> => r !== null)
                    }
                    variant="full"
                    prazo={t.prazo}
                    status={t.status}
                  />
                </div>
              )}

              {/* 5b. Editor de etapas do fluxo */}
              <EtapasFluxoEditor
                tarefa={t}
                setTarefa={setT}
                modoRascunho={modoRascunho}
                nomeUsuario={nomeUsuario}
                tipoTarefa={projetos.find((p) => p.id === t.projeto)?.tipo ?? tipoProjeto ?? ''}
                onMudou={onMudou}
                setErro={setErroSalvo}
              />

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
