import { useEffect, useMemo, useState } from 'react';
import { useHistory, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, X, Building2, Users, ClipboardList } from 'lucide-react';
import {
  criarTarefa, getTarefa, atualizarTarefa, removerTarefa,
} from './tarefasService';
import type { TarefaInput } from './types';
import { listProjetos } from '@/projetos/projetosService';
import type { Projeto } from '@/projetos/types';
import { listOpcoes } from '@/opcoes/opcoesService';
import { listUsuarios } from '@/usuarios/usuariosService';
import { listClientes } from '@/clientes/clientesService';
import { listContatos } from '@/contatos/contatosService';
import { nomeExibicao } from '@/clientes/types';
import type { Opcao } from '@/opcoes/types';
import type { Cliente } from '@/clientes/types';
import type { Contato } from '@/contatos/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/auth/useAuth';
import { ehCliente } from '@/auth/perms';
import { cn } from '@/lib/utils';

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50';

/** Modo de vínculo da tarefa — controla o cascateamento do formulário. */
type Modo = 'interna' | 'equipe' | 'cliente';

function Campo({
  id, label, children, className = '',
}: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

interface Usuario { id: string; nome?: string; email: string }

function vazia(): TarefaInput {
  return {
    nome: '', descricao: '', projeto: '', cliente: '', lado: 'wenox',
    responsaveis: [], contato: '', status: '', prazo: '', etiquetas: [], ordem: 0,
  };
}

export function TarefaFormPage({ id: idProp }: { id?: string } = {}) {
  const history = useHistory();
  const params = useParams<{ id?: string }>();
  const { search } = useLocation();
  const { user } = useAuth();
  const souCliente = ehCliente(user?.role);
  const id = idProp ?? params.id;

  const [form, setForm] = useState<TarefaInput>(vazia);
  const [modo, setModo] = useState<Modo>('interna');
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [statuses, setStatuses] = useState<Opcao[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [novaTag, setNovaTag] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    listProjetos().then(setProjetos);
    listClientes('').then(setClientes);
    listOpcoes('status_tarefa').then(setStatuses);
    listUsuarios().then(setUsuarios as never);
  }, []);

  // Pré-seleção via querystring (?projeto= / ?cliente=) ao criar.
  useEffect(() => {
    if (id) return;
    // Conta Cliente: tarefa já nasce travada na empresa dele.
    if (souCliente) {
      setModo('cliente');
      setForm((f) => ({ ...f, cliente: user?.cliente ?? '', lado: 'cliente' }));
      setCarregado(true);
      return;
    }
    const qs = new URLSearchParams(search);
    const proj = qs.get('projeto');
    const cli = qs.get('cliente');
    if (proj || cli) {
      setModo('cliente');
      setForm((f) => ({ ...f, projeto: proj ?? '', cliente: cli ?? '', lado: 'cliente' }));
    }
    setCarregado(true);
  }, [id, search, souCliente, user?.cliente]);

  useEffect(() => {
    if (id) {
      getTarefa(id).then((t) => {
        setForm({
          nome: t.nome,
          descricao: t.descricao ?? '',
          projeto: t.projeto ?? '',
          cliente: t.cliente ?? '',
          lado: t.lado ?? 'wenox',
          responsaveis: t.responsaveis ?? [],
          contato: t.contato ?? '',
          status: t.status ?? '',
          prazo: t.prazo ?? '',
          etiquetas: t.etiquetas ?? [],
          ordem: t.ordem ?? 0,
        });
        // Deriva o modo a partir dos campos salvos.
        if (t.lado === 'cliente') setModo('cliente');
        else if (t.cliente || t.projeto) setModo('equipe');
        else setModo('interna');
        setCarregado(true);
      });
    }
  }, [id]);

  // Status default = primeira opção, quando ainda não escolhido.
  useEffect(() => {
    if (!id && !form.status && statuses.length > 0) {
      setForm((f) => ({ ...f, status: statuses[0].valor }));
    }
  }, [statuses, id, form.status]);

  // Carrega contatos do cliente vinculado (para tarefa do lado cliente).
  useEffect(() => {
    if (form.cliente) listContatos(form.cliente).then(setContatos);
    else setContatos([]);
  }, [form.cliente]);

  function set<K extends keyof TarefaInput>(k: K, v: TarefaInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  /** Clientes em que os membros selecionados trabalham (via projetos). */
  const clientesDoMembro = useMemo(() => {
    const membros = new Set(form.responsaveis ?? []);
    if (membros.size === 0) return [] as Cliente[];
    const ids = new Set<string>();
    for (const p of projetos) {
      if ((p.responsaveis ?? []).some((r) => membros.has(r)) && p.cliente) {
        ids.add(p.cliente);
      }
    }
    return clientes.filter((c) => ids.has(c.id));
  }, [form.responsaveis, projetos, clientes]);

  /** Projetos do cliente selecionado. */
  const projetosDoCliente = useMemo(
    () => projetos.filter((p) => p.cliente === form.cliente),
    [projetos, form.cliente],
  );

  // Auto-seleciona o projeto quando o cliente tem só um.
  useEffect(() => {
    if (modo === 'interna' || !form.cliente) return;
    if (projetosDoCliente.length === 1 && form.projeto !== projetosDoCliente[0].id) {
      set('projeto', projetosDoCliente[0].id);
    }
  }, [modo, form.cliente, projetosDoCliente]);

  /** Troca de modo — limpa os campos do cascateamento. */
  function trocarModo(m: Modo) {
    setModo(m);
    setForm((f) => ({
      ...f,
      lado: m === 'cliente' ? 'cliente' : 'wenox',
      projeto: '',
      cliente: '',
      contato: '',
      responsaveis: [],
    }));
  }

  /** Em modo equipe: liga/desliga um membro e revalida o cliente escolhido. */
  function toggleMembro(uid: string) {
    setForm((f) => {
      const atuais = f.responsaveis ?? [];
      const proximos = atuais.includes(uid)
        ? atuais.filter((x) => x !== uid)
        : [...atuais, uid];
      // Se o cliente atual não pertence mais a nenhum membro, zera a cascata.
      const membros = new Set(proximos);
      const clienteAindaVale = projetos.some(
        (p) => p.cliente === f.cliente
          && (p.responsaveis ?? []).some((r) => membros.has(r)),
      );
      return {
        ...f,
        responsaveis: proximos,
        ...(clienteAindaVale ? {} : { cliente: '', projeto: '', contato: '' }),
      };
    });
  }

  function escolherCliente(clienteId: string) {
    setForm((f) => ({ ...f, cliente: clienteId, projeto: '', contato: '' }));
  }

  function toggleResp(uid: string) {
    const atuais = form.responsaveis ?? [];
    set('responsaveis', atuais.includes(uid)
      ? atuais.filter((x) => x !== uid)
      : [...atuais, uid]);
  }

  function addTag() {
    const v = novaTag.trim();
    if (!v) return;
    const atuais = form.etiquetas ?? [];
    if (!atuais.includes(v)) set('etiquetas', [...atuais, v]);
    setNovaTag('');
  }
  function removerTag(v: string) {
    set('etiquetas', (form.etiquetas ?? []).filter((x) => x !== v));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) { setErro('Nome da tarefa é obrigatório'); return; }
    if (modo !== 'interna' && !form.cliente) {
      setErro('Selecione o cliente da tarefa'); return;
    }
    setSalvando(true);
    try {
      const payload: TarefaInput = {
        ...form,
        lado: modo === 'cliente' ? 'cliente' : 'wenox',
        // Tarefa interna não tem cliente nem projeto.
        cliente: modo === 'interna' ? '' : form.cliente,
        projeto: modo === 'interna' ? '' : form.projeto,
        contato: modo === 'cliente' ? form.contato : '',
      };
      if (id) await atualizarTarefa(id, payload);
      else await criarTarefa(payload);
      history.push('/tarefas');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      setErro(`Não foi possível salvar: ${msg}`);
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!id) return;
    if (!confirm('Apagar esta tarefa? Esta ação não pode ser desfeita.')) return;
    try {
      await removerTarefa(id);
      history.push('/tarefas');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro';
      setErro(`Não foi possível apagar: ${msg}`);
    }
  }

  const MODOS: { v: Modo; label: string; desc: string; icon: typeof Users }[] = [
    { v: 'interna', label: 'Interna', desc: 'Tarefa da agência, sem cliente', icon: ClipboardList },
    { v: 'equipe', label: 'Equipe', desc: 'Por membro da equipe', icon: Users },
    { v: 'cliente', label: 'Cliente', desc: 'Direto pelo cliente', icon: Building2 },
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => history.goBack()} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h2 className="text-lg font-semibold">{id ? 'Editar' : 'Nova'} tarefa</h2>
      </div>

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Campo id="nome" label="Nome da tarefa">
              <Input id="nome" value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Ex: Aprovar layout do post de Maio" />
            </Campo>
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="status" label="Status">
                <select id="status" value={form.status ?? ''} className={selectClass}
                  onChange={(e) => set('status', e.target.value)}>
                  <option value="">—</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.valor}>{s.valor}</option>
                  ))}
                </select>
              </Campo>
              <Campo id="prazo" label="Prazo">
                <Input id="prazo" type="date" value={form.prazo ?? ''}
                  onChange={(e) => set('prazo', e.target.value)} />
              </Campo>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vínculo da tarefa</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {souCliente && (
              <p className="text-xs text-muted-foreground">
                A tarefa fica vinculada à sua empresa. Escolha o projeto, se
                quiser.
              </p>
            )}
            {/* Seletor de modo */}
            {!souCliente && (
            <div className="grid gap-2 sm:grid-cols-3">
              {MODOS.map((m) => {
                const Icon = m.icon;
                const ativo = modo === m.v;
                return (
                  <button
                    key={m.v}
                    type="button"
                    onClick={() => trocarModo(m.v)}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
                      ativo
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border hover:bg-secondary',
                    )}
                  >
                    <span className={cn(
                      'flex items-center gap-1.5 text-sm font-medium',
                      ativo ? 'text-primary' : 'text-foreground',
                    )}>
                      <Icon className="size-4" /> {m.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{m.desc}</span>
                  </button>
                );
              })}
            </div>
            )}

            {/* ----- Modo INTERNA ----- */}
            {!souCliente && modo === 'interna' && (
              <Campo id="resp-int" label="Responsáveis (equipe Wenox)">
                {usuarios.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Carregando usuários…</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {usuarios.map((u) => {
                      const ativo = (form.responsaveis ?? []).includes(u.id);
                      return (
                        <button key={u.id} type="button" onClick={() => toggleResp(u.id)}
                          className={
                            'rounded-full border px-3 py-1 text-sm transition-colors ' +
                            (ativo
                              ? 'border-primary/50 bg-primary/15 text-primary'
                              : 'border-border text-muted-foreground hover:bg-secondary')
                          }>
                          {u.nome || u.email}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Campo>
            )}

            {/* ----- Modo EQUIPE: membro → cliente → projeto ----- */}
            {!souCliente && modo === 'equipe' && (
              <>
                <Campo id="membros" label="1. Membro(s) da equipe">
                  {usuarios.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Carregando usuários…</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {usuarios.map((u) => {
                        const ativo = (form.responsaveis ?? []).includes(u.id);
                        return (
                          <button key={u.id} type="button" onClick={() => toggleMembro(u.id)}
                            className={
                              'rounded-full border px-3 py-1 text-sm transition-colors ' +
                              (ativo
                                ? 'border-primary/50 bg-primary/15 text-primary'
                                : 'border-border text-muted-foreground hover:bg-secondary')
                            }>
                            {u.nome || u.email}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Campo>
                <Campo id="cli-eq" label="2. Cliente">
                  {(form.responsaveis ?? []).length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      Selecione um membro acima para ver os clientes dele.
                    </p>
                  ) : clientesDoMembro.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      Esse(s) membro(s) não estão em nenhum projeto com cliente.
                    </p>
                  ) : (
                    <select id="cli-eq" value={form.cliente ?? ''} className={selectClass}
                      onChange={(e) => escolherCliente(e.target.value)}>
                      <option value="">—</option>
                      {clientesDoMembro.map((c) => (
                        <option key={c.id} value={c.id}>{nomeExibicao(c)}</option>
                      ))}
                    </select>
                  )}
                </Campo>
              </>
            )}

            {/* ----- Modo CLIENTE: cliente → projeto + contato ----- */}
            {!souCliente && modo === 'cliente' && (
              <Campo id="cli" label="1. Cliente">
                <select id="cli" value={form.cliente ?? ''} className={selectClass}
                  onChange={(e) => escolherCliente(e.target.value)}>
                  <option value="">—</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{nomeExibicao(c)}</option>
                  ))}
                </select>
              </Campo>
            )}

            {/* Projeto — comum a equipe e cliente, após escolher o cliente */}
            {modo !== 'interna' && form.cliente && (
              <Campo id="proj" label={souCliente ? 'Projeto' : `${modo === 'equipe' ? '3' : '2'}. Projeto`}>
                {projetosDoCliente.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Este cliente ainda não tem projetos. A tarefa fica ligada só
                    ao cliente.
                  </p>
                ) : (
                  <select id="proj" value={form.projeto ?? ''} className={selectClass}
                    onChange={(e) => set('projeto', e.target.value)}>
                    <option value="">Sem projeto específico</option>
                    {projetosDoCliente.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                )}
              </Campo>
            )}

            {/* Contato responsável — só no modo cliente (lado interno) */}
            {!souCliente && modo === 'cliente' && form.cliente && (
              <Campo id="contato" label="3. Contato responsável (do cliente)">
                {contatos.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Nenhum contato cadastrado para este cliente. Cadastre na aba
                    Equipe do cliente.
                  </p>
                ) : (
                  <select id="contato" value={form.contato ?? ''} className={selectClass}
                    onChange={(e) => set('contato', e.target.value)}>
                    <option value="">—</option>
                    {contatos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}{c.cargo ? ` · ${c.cargo}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Etiquetas e descrição</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                aria-label="Nova etiqueta"
                placeholder="Ex: Urgente, Aprovação"
                value={novaTag}
                onChange={(e) => setNovaTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                className={selectClass}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
            {(form.etiquetas ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(form.etiquetas ?? []).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-xs">
                    {t}
                    <button type="button" onClick={() => removerTag(t)} aria-label={`Remover ${t}`} className="text-muted-foreground hover:text-destructive">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Campo id="desc" label="Descrição">
              <textarea id="desc" rows={4} value={form.descricao ?? ''}
                onChange={(e) => set('descricao', e.target.value)}
                className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                placeholder="Detalhes da tarefa, o que precisa ser feito…" />
            </Campo>
          </CardContent>
        </Card>

        {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" disabled={salvando || !carregado}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
          {id && (
            <Button type="button" variant="ghost" onClick={apagar} className="text-destructive hover:bg-destructive/10">
              Apagar tarefa
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
