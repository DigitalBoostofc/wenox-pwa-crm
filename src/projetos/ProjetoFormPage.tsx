import { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import {
  criarProjeto, getProjeto, atualizarProjeto, removerProjeto,
} from './projetosService';
import { listEtapas } from './etapasService';
import type { ProjetoInput, EtapaProjeto } from './types';
import { TIPO_SOCIAL_MEDIA, statusesParaTipo } from './format';
import { listOpcoes } from '@/opcoes/opcoesService';
import { listClientes } from '@/clientes/clientesService';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Opcao } from '@/opcoes/types';
import type { Cliente } from '@/clientes/types';
import { nomeExibicao } from '@/clientes/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const vazio: ProjetoInput = {
  nome: '', cliente: '', tipo: '', status: 'Desenvolvimento', etapa: '',
  etiquetas: [], responsaveis: [], briefing: '', observacoes: '',
};

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

export function ProjetoFormPage({ id: idProp }: { id?: string } = {}) {
  const history = useHistory();
  const params = useParams<{ id?: string }>();
  const id = idProp ?? params.id;
  const [form, setForm] = useState<ProjetoInput>(vazio);
  const [tipos, setTipos] = useState<Opcao[]>([]);
  const [todasEtapas, setTodasEtapas] = useState<EtapaProjeto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [novaTag, setNovaTag] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listOpcoes('tipo_projeto').then(setTipos);
    listEtapas().then(setTodasEtapas);
    listClientes('').then(setClientes);
    listUsuarios().then(setUsuarios as never);
  }, []);

  useEffect(() => {
    if (id) {
      getProjeto(id).then((p) => {
        setForm({
          nome: p.nome,
          cliente: p.cliente,
          tipo: p.tipo ?? '',
          status: p.status ?? '',
          etapa: p.etapa ?? '',
          etiquetas: p.etiquetas ?? [],
          responsaveis: p.responsaveis ?? [],
          briefing: p.briefing ?? '',
          observacoes: p.observacoes ?? '',
          data_inicio: p.data_inicio ?? '',
          data_entrega: p.data_entrega ?? '',
        });
      });
    }
  }, [id]);

  const isSocialMedia = form.tipo === TIPO_SOCIAL_MEDIA;

  const etapasDoTipo = todasEtapas
    .filter((e) => e.tipo === (form.tipo ?? ''))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  function set<K extends keyof ProjetoInput>(k: K, v: ProjetoInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function addTag() {
    const v = novaTag.trim();
    if (!v) return;
    const atuais = form.etiquetas ?? [];
    if (atuais.includes(v)) { setNovaTag(''); return; }
    setForm((f) => ({ ...f, etiquetas: [...atuais, v] }));
    setNovaTag('');
  }
  function removerTag(v: string) {
    setForm((f) => ({ ...f, etiquetas: (f.etiquetas ?? []).filter((x) => x !== v) }));
  }

  function toggleResp(uid: string) {
    setForm((f) => {
      const atuais = f.responsaveis ?? [];
      return {
        ...f,
        responsaveis: atuais.includes(uid)
          ? atuais.filter((x) => x !== uid)
          : [...atuais, uid],
      };
    });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) { setErro('Nome do projeto é obrigatório'); return; }
    if (!form.cliente) { setErro('Selecione um cliente'); return; }
    setSalvando(true);
    try {
      if (id) await atualizarProjeto(id, form);
      else await criarProjeto(form);
      history.push('/projetos');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      setErro(`Não foi possível salvar: ${msg}`);
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!id) return;
    if (!confirm('Apagar este projeto? Esta ação não pode ser desfeita.')) return;
    try {
      await removerProjeto(id);
      history.push('/projetos');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro';
      setErro(`Não foi possível apagar: ${msg}`);
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => history.push('/projetos')} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h2 className="text-lg font-semibold">{id ? 'Editar' : 'Novo'} projeto</h2>
      </div>

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Campo id="nome" label="Nome do projeto">
              <Input id="nome" value={form.nome}
                onChange={(e) => set('nome', e.target.value)} />
            </Campo>
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="cli" label="Cliente">
                <select id="cli" value={form.cliente} className={selectClass}
                  onChange={(e) => set('cliente', e.target.value)}>
                  <option value="">—</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{nomeExibicao(c)}</option>
                  ))}
                </select>
              </Campo>
              <Campo id="tipo" label="Tipo">
                <select id="tipo" value={form.tipo ?? ''} className={selectClass}
                  onChange={(e) => {
                    const novoTipo = e.target.value;
                    set('tipo', novoTipo);
                    set('etapa', '');
                    const statusAtual = form.status ?? '';
                    const novosStatuses = statusesParaTipo(novoTipo);
                    if (!novosStatuses.includes(statusAtual as never)) {
                      set('status', novoTipo === TIPO_SOCIAL_MEDIA ? 'Ativo' : 'Desenvolvimento');
                    }
                  }}>
                  <option value="">—</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.valor}>{t.valor}</option>
                  ))}
                </select>
              </Campo>
              <Campo id="status" label="Status">
                <select id="status" value={form.status ?? ''} className={selectClass}
                  onChange={(e) => set('status', e.target.value)}>
                  <option value="">—</option>
                  {statusesParaTipo(form.tipo).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Campo>
              {!isSocialMedia && (
                <Campo id="etapa" label="Etapa">
                  {etapasDoTipo.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      {form.tipo
                        ? `Nenhuma etapa cadastrada para "${form.tipo}". Cadastre em Configurações → Etapas de projeto.`
                        : 'Selecione um tipo para escolher a etapa.'}
                    </p>
                  ) : (
                    <select id="etapa" value={form.etapa ?? ''} className={selectClass}
                      onChange={(e) => set('etapa', e.target.value)}>
                      <option value="">—</option>
                      {etapasDoTipo.map((et) => (
                        <option key={et.id} value={et.nome}>{et.nome}</option>
                      ))}
                    </select>
                  )}
                </Campo>
              )}
              <Campo id="di" label="Início">
                <Input id="di" type="date" value={form.data_inicio ?? ''}
                  onChange={(e) => set('data_inicio', e.target.value)} />
              </Campo>
              <Campo id="de" label="Entrega">
                <Input id="de" type="date" value={form.data_entrega ?? ''}
                  onChange={(e) => set('data_entrega', e.target.value)} />
              </Campo>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Etiquetas</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                aria-label="Nova etiqueta"
                placeholder="Ex: Urgente, Performance, Cliente VIP"
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Responsáveis</CardTitle></CardHeader>
          <CardContent>
            {usuarios.length === 0 ? (
              <p className="text-sm text-muted-foreground">Carregando usuários…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {usuarios.map((u) => {
                  const ativo = (form.responsaveis ?? []).includes(u.id);
                  const label = u.nome || u.email;
                  return (
                    <button key={u.id} type="button" onClick={() => toggleResp(u.id)}
                      className={
                        'rounded-full border px-3 py-1 text-sm transition-colors ' +
                        (ativo
                          ? 'border-primary/50 bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground hover:bg-secondary')
                      }>
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Briefing e observações</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Campo id="bf" label="Briefing">
              <textarea id="bf" rows={5} value={form.briefing ?? ''}
                onChange={(e) => set('briefing', e.target.value)}
                className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                placeholder="Resumo do projeto, objetivos, escopo, materiais necessários…" />
            </Campo>
            <Campo id="obs" label="Observações">
              <textarea id="obs" rows={3} value={form.observacoes ?? ''}
                onChange={(e) => set('observacoes', e.target.value)}
                className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
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
              Apagar projeto
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
