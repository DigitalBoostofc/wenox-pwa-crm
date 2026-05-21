import { useEffect, useMemo, useState } from 'react';
import { useHistory, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import {
  criarTarefa, getTarefa, atualizarTarefa, removerTarefa,
} from './tarefasService';
import type { TarefaInput, LadoTarefa } from './types';
import { listProjetos } from '@/projetos/projetosService';
import type { Projeto } from '@/projetos/types';
import { listOpcoes } from '@/opcoes/opcoesService';
import { listUsuarios } from '@/usuarios/usuariosService';
import { listContatos } from '@/contatos/contatosService';
import type { Opcao } from '@/opcoes/types';
import type { Contato } from '@/contatos/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

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
  const id = idProp ?? params.id;

  const [form, setForm] = useState<TarefaInput>(vazia);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [statuses, setStatuses] = useState<Opcao[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [novaTag, setNovaTag] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listProjetos().then(setProjetos);
    listOpcoes('status_tarefa').then(setStatuses);
    listUsuarios().then(setUsuarios as never);
  }, []);

  // Pré-seleção via querystring (?projeto= / ?cliente=) ao criar.
  useEffect(() => {
    if (id) return;
    const qs = new URLSearchParams(search);
    const proj = qs.get('projeto');
    const cli = qs.get('cliente');
    if (proj || cli) {
      setForm((f) => ({ ...f, projeto: proj ?? '', cliente: cli ?? '' }));
    }
  }, [id, search]);

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

  const projetoSel = useMemo(
    () => projetos.find((p) => p.id === form.projeto),
    [projetos, form.projeto],
  );

  function set<K extends keyof TarefaInput>(k: K, v: TarefaInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  /** Trocar de projeto deriva o cliente; sem projeto → tarefa interna (lado Wenox). */
  function trocarProjeto(projetoId: string) {
    const p = projetos.find((x) => x.id === projetoId);
    setForm((f) => ({
      ...f,
      projeto: projetoId,
      cliente: p?.cliente ?? '',
      ...(projetoId ? {} : { lado: 'wenox' as LadoTarefa, contato: '' }),
    }));
  }

  function trocarLado(lado: LadoTarefa) {
    setForm((f) => ({
      ...f,
      lado,
      ...(lado === 'wenox' ? { contato: '' } : { responsaveis: [] }),
    }));
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

  function toggleResp(uid: string) {
    const atuais = form.responsaveis ?? [];
    set('responsaveis', atuais.includes(uid)
      ? atuais.filter((x) => x !== uid)
      : [...atuais, uid]);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) { setErro('Nome da tarefa é obrigatório'); return; }
    setSalvando(true);
    try {
      const payload: TarefaInput = {
        ...form,
        // Tarefa sem projeto não tem cliente (sempre interna).
        cliente: form.projeto ? form.cliente : '',
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

  const temProjeto = !!form.projeto;
  const isCliente = form.lado === 'cliente';

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
              <Campo id="proj" label="Projeto (opcional)">
                <select id="proj" value={form.projeto ?? ''} className={selectClass}
                  onChange={(e) => trocarProjeto(e.target.value)}>
                  <option value="">Sem projeto (tarefa interna)</option>
                  {projetos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </Campo>
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
            {temProjeto && projetoSel && (
              <p className="text-xs text-muted-foreground">
                Cliente do projeto: <strong>{projetoSel.expand?.cliente?.nome
                  ?? projetoSel.expand?.cliente?.nome_fantasia ?? '—'}</strong>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Responsabilidade</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {temProjeto ? (
              <Campo id="lado" label="Quem é responsável">
                <div className="flex gap-2">
                  {(['wenox', 'cliente'] as LadoTarefa[]).map((l) => (
                    <button key={l} type="button" onClick={() => trocarLado(l)}
                      className={
                        'rounded-full border px-4 py-1.5 text-sm transition-colors ' +
                        (form.lado === l
                          ? 'border-primary/50 bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground hover:bg-secondary')
                      }>
                      {l === 'wenox' ? 'Equipe Wenox' : 'Cliente'}
                    </button>
                  ))}
                </div>
              </Campo>
            ) : (
              <p className="text-xs text-muted-foreground">
                Tarefa interna da agência — responsável é a equipe Wenox.
              </p>
            )}

            {isCliente ? (
              <Campo id="contato" label="Contato responsável (do cliente)">
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
            ) : (
              <Campo id="resp" label="Responsáveis (equipe Wenox)">
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
          <Button type="submit" size="lg" disabled={salvando}>
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
