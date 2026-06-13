import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { criarProjeto } from './projetosService';
import { listEtapas } from './etapasService';
import type { ProjetoInput, EtapaProjeto } from './types';
import { TIPO_SOCIAL_MEDIA, statusesParaTipo } from './format';
import { listOpcoes } from '@/opcoes/opcoesService';
import { listClientes } from '@/clientes/clientesService';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Opcao } from '@/opcoes/types';
import type { Cliente } from '@/clientes/types';
import { nomeExibicao } from '@/clientes/types';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Usuario { id: string; nome?: string; email: string }

const selectCls =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

function RotuloCampo({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-muted-foreground">{children}</span>;
}

function formInicial(tipoPreset?: string, clientePreset?: string): ProjetoInput {
  return {
    nome: '', cliente: clientePreset ?? '', tipo: tipoPreset ?? '',
    status: tipoPreset === TIPO_SOCIAL_MEDIA ? 'Ativo' : 'Desenvolvimento',
    etapa: '', etiquetas: [], responsaveis: [], briefing: '', observacoes: '',
    data_inicio: '', data_entrega: '',
  };
}

/** Painel lateral de criação de projeto (espelha o "Nova tarefa").
 *  Já vem com o Tipo pré-selecionado pelo filtro da barra. */
export function ProjetoSheet({
  aberto, onClose, onCriado, tipoPreset, clientePreset,
}: {
  aberto: boolean;
  onClose: () => void;
  onCriado: (id: string) => void;
  tipoPreset?: string;
  clientePreset?: string;
}) {
  const [form, setForm] = useState<ProjetoInput>(() => formInicial(tipoPreset, clientePreset));
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

  // Reinicializa o formulário a cada abertura (com o tipo do filtro atual).
  useEffect(() => {
    if (aberto) {
      setForm(formInicial(tipoPreset, clientePreset));
      setErro('');
      setNovaTag('');
    }
  }, [aberto, tipoPreset, clientePreset]);

  // Clientes ativos, em ordem alfabética.
  const clientesAtivos = useMemo(
    () => clientes
      .filter((c) => c.status === 'Ativo')
      .sort((a, b) => nomeExibicao(a).localeCompare(nomeExibicao(b), 'pt-BR', { sensitivity: 'base' })),
    [clientes],
  );

  const isSocialMedia = form.tipo === TIPO_SOCIAL_MEDIA;
  const etapasDoTipo = useMemo(
    () => todasEtapas
      .filter((e) => e.tipo === (form.tipo ?? ''))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [todasEtapas, form.tipo],
  );

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
        responsaveis: atuais.includes(uid) ? atuais.filter((x) => x !== uid) : [...atuais, uid],
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
      const novo = await criarProjeto(form);
      onCriado(novo.id);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      setErro(`Não foi possível salvar: ${msg}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={(abr) => { if (!abr) onClose(); }}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 overflow-y-auto p-0 w-full sm:w-[40vw] sm:min-w-[460px] sm:max-w-none"
      >
        <div className="border-b border-border px-5 py-3 pr-12">
          <SheetTitle className="text-base leading-snug">Novo projeto</SheetTitle>
        </div>

        <form onSubmit={salvar} className="flex flex-col gap-5 px-5 py-5">
          {/* Nome */}
          <div>
            <RotuloCampo>Nome do projeto</RotuloCampo>
            <input
              autoFocus
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              className={selectCls}
              placeholder="Ex.: Social Media — Cliente X"
            />
          </div>

          {/* Cliente + Tipo */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <RotuloCampo>Cliente</RotuloCampo>
              <select value={form.cliente} onChange={(e) => set('cliente', e.target.value)} className={selectCls}>
                <option value="">—</option>
                {clientesAtivos.map((c) => (
                  <option key={c.id} value={c.id}>{nomeExibicao(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <RotuloCampo>Tipo</RotuloCampo>
              <select
                value={form.tipo ?? ''}
                onChange={(e) => {
                  const novoTipo = e.target.value;
                  set('tipo', novoTipo);
                  set('etapa', '');
                  const statusAtual = form.status ?? '';
                  if (!statusesParaTipo(novoTipo).includes(statusAtual as never)) {
                    set('status', novoTipo === TIPO_SOCIAL_MEDIA ? 'Ativo' : 'Desenvolvimento');
                  }
                }}
                className={selectCls}
              >
                <option value="">—</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.valor}>{t.valor}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status + Etapa */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <RotuloCampo>Status</RotuloCampo>
              <select value={form.status ?? ''} onChange={(e) => set('status', e.target.value)} className={selectCls}>
                <option value="">—</option>
                {statusesParaTipo(form.tipo).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {!isSocialMedia && (
              <div>
                <RotuloCampo>Etapa</RotuloCampo>
                {etapasDoTipo.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    {form.tipo
                      ? `Nenhuma etapa cadastrada para "${form.tipo}".`
                      : 'Selecione um tipo para escolher a etapa.'}
                  </p>
                ) : (
                  <select value={form.etapa ?? ''} onChange={(e) => set('etapa', e.target.value)} className={selectCls}>
                    <option value="">—</option>
                    {etapasDoTipo.map((et) => (
                      <option key={et.id} value={et.nome}>{et.nome}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Início + Entrega */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <RotuloCampo>Início</RotuloCampo>
              <input type="date" value={form.data_inicio ?? ''} onChange={(e) => set('data_inicio', e.target.value)} className={selectCls} />
            </div>
            <div>
              <RotuloCampo>Entrega</RotuloCampo>
              <input type="date" value={form.data_entrega ?? ''} onChange={(e) => set('data_entrega', e.target.value)} className={selectCls} />
            </div>
          </div>

          {/* Etiquetas */}
          <div>
            <RotuloCampo>Etiquetas</RotuloCampo>
            <div className="flex gap-2">
              <input
                aria-label="Nova etiqueta"
                placeholder="Ex: Urgente, Performance"
                value={novaTag}
                onChange={(e) => setNovaTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                className={selectCls}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
            {(form.etiquetas ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(form.etiquetas ?? []).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs">
                    {t}
                    <button type="button" onClick={() => removerTag(t)} aria-label={`Remover ${t}`} className="text-muted-foreground hover:text-destructive">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Responsáveis */}
          <div>
            <RotuloCampo>Responsáveis</RotuloCampo>
            {usuarios.length === 0 ? (
              <p className="text-sm text-muted-foreground">Carregando usuários…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {usuarios.map((u) => {
                  const ativo = (form.responsaveis ?? []).includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleResp(u.id)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm transition-colors',
                        ativo
                          ? 'border-primary/50 bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground hover:bg-secondary',
                      )}
                    >
                      {u.nome || u.email}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Briefing + Observações */}
          <div>
            <RotuloCampo>Briefing</RotuloCampo>
            <textarea
              rows={4}
              value={form.briefing ?? ''}
              onChange={(e) => set('briefing', e.target.value)}
              className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              placeholder="Resumo do projeto, objetivos, escopo…"
            />
          </div>
          <div>
            <RotuloCampo>Observações</RotuloCampo>
            <textarea
              rows={3}
              value={form.observacoes ?? ''}
              onChange={(e) => set('observacoes', e.target.value)}
              className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </div>

          {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Criar projeto'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
