import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Plus, Check, ExternalLink, X } from 'lucide-react';
import { criarTarefa, atualizarTarefa } from './tarefasService';
import type { Tarefa, TarefaInput, LadoTarefa } from './types';
import { statusTarefaClass } from './format';
import { listOpcoes } from '@/opcoes/opcoesService';
import { listClientes } from '@/clientes/clientesService';
import { listProjetos } from '@/projetos/projetosService';
import { listUsuarios } from '@/usuarios/usuariosService';
import { listContatos } from '@/contatos/contatosService';
import { nomeExibicao } from '@/clientes/types';
import type { Opcao } from '@/opcoes/types';
import type { Cliente } from '@/clientes/types';
import type { Projeto } from '@/projetos/types';
import type { Contato } from '@/contatos/types';
import { dataBR } from '@/clientes/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Modo = 'interna' | 'equipe' | 'cliente';
type Campo =
  | 'nome' | 'status' | 'prazo' | 'vinculo'
  | 'cliente' | 'projeto' | 'pessoas' | 'descricao' | 'etiquetas';

interface Usuario { id: string; nome?: string; email: string }

/** Estado editável de uma linha (tarefa existente ou rascunho da nova). */
interface Linha {
  id: string; // id real, ou 'nova'
  nome: string;
  status: string;
  prazo: string;
  modo: Modo;
  cliente: string;
  projeto: string;
  responsaveis: string[];
  contato: string;
  descricao: string;
  etiquetas: string[];
}

function modoDe(t: Tarefa): Modo {
  if (t.lado === 'cliente') return 'cliente';
  if (t.cliente || t.projeto) return 'equipe';
  return 'interna';
}
function tarefaParaLinha(t: Tarefa): Linha {
  return {
    id: t.id,
    nome: t.nome ?? '',
    status: t.status ?? '',
    prazo: t.prazo ?? '',
    modo: modoDe(t),
    cliente: t.cliente ?? '',
    projeto: t.projeto ?? '',
    responsaveis: t.responsaveis ?? [],
    contato: t.contato ?? '',
    descricao: t.descricao ?? '',
    etiquetas: t.etiquetas ?? [],
  };
}
/** Converte a linha para o payload da tarefa (aplica as regras do vínculo). */
function linhaParaInput(l: Linha): TarefaInput {
  const lado: LadoTarefa = l.modo === 'cliente' ? 'cliente' : 'wenox';
  return {
    nome: l.nome.trim(),
    status: l.status,
    prazo: l.prazo,
    lado,
    cliente: l.modo === 'interna' ? '' : l.cliente,
    projeto: l.modo === 'interna' ? '' : l.projeto,
    responsaveis: l.modo === 'cliente' ? [] : l.responsaveis,
    contato: l.modo === 'cliente' ? l.contato : '',
    descricao: l.descricao,
    etiquetas: l.etiquetas,
  };
}

const COLS: { campo: Campo; label: string; w: string }[] = [
  { campo: 'nome',      label: 'Tarefa',       w: 'min-w-44' },
  { campo: 'status',    label: 'Status',       w: 'min-w-32' },
  { campo: 'prazo',     label: 'Prazo',        w: 'min-w-32' },
  { campo: 'vinculo',   label: 'Vínculo',      w: 'min-w-32' },
  { campo: 'cliente',   label: 'Cliente',      w: 'min-w-40' },
  { campo: 'projeto',   label: 'Projeto',      w: 'min-w-40' },
  { campo: 'pessoas',   label: 'Responsáveis', w: 'min-w-40' },
  { campo: 'descricao', label: 'Descrição',    w: 'min-w-48' },
  { campo: 'etiquetas', label: 'Etiquetas',    w: 'min-w-40' },
];
const MODO_LABEL: Record<Modo, string> = {
  interna: 'Interna', equipe: 'Equipe', cliente: 'Cliente',
};

const inputCls =
  'h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 [color-scheme:dark]';

export function TabelaTarefas({
  tarefas, onMudou, presetProjeto, presetCliente,
}: {
  tarefas: Tarefa[];
  onMudou: () => void;
  presetProjeto?: string;
  presetCliente?: string;
}) {
  const history = useHistory();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [statuses, setStatuses] = useState<Opcao[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [contatosPorCliente, setContatosPorCliente] = useState<Record<string, Contato[]>>({});
  const [edit, setEdit] = useState<{ id: string; campo: Campo } | null>(null);
  const [nova, setNova] = useState<Linha | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => { setLinhas(tarefas.map(tarefaParaLinha)); }, [tarefas]);
  useEffect(() => {
    listOpcoes('status_tarefa').then(setStatuses);
    listClientes('').then(setClientes);
    listProjetos().then(setProjetos);
    listUsuarios().then(setUsuarios as never);
  }, []);

  const nomeUsuario = useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of usuarios) m[u.id] = u.nome || u.email;
    return m;
  }, [usuarios]);
  const nomeCliente = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clientes) m[c.id] = nomeExibicao(c);
    return m;
  }, [clientes]);
  const nomeProjeto = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of projetos) m[p.id] = p.nome;
    return m;
  }, [projetos]);

  /** Garante os contatos de um cliente carregados (para o vínculo Cliente). */
  function carregarContatos(clienteId: string) {
    if (!clienteId || contatosPorCliente[clienteId]) return;
    listContatos(clienteId).then((cs) =>
      setContatosPorCliente((m) => ({ ...m, [clienteId]: cs })));
  }
  const contatosDe = (clienteId: string) => contatosPorCliente[clienteId] ?? [];

  function projetosDe(clienteId: string) {
    return projetos.filter((p) => p.cliente === clienteId);
  }

  /** Aplica uma alteração de campo a uma linha (regras de cascata do vínculo). */
  function aplicar(l: Linha, campo: Campo, valor: unknown): Linha {
    const n = { ...l };
    if (campo === 'nome') n.nome = valor as string;
    else if (campo === 'status') n.status = valor as string;
    else if (campo === 'prazo') n.prazo = valor as string;
    else if (campo === 'descricao') n.descricao = valor as string;
    else if (campo === 'etiquetas') n.etiquetas = valor as string[];
    else if (campo === 'vinculo') {
      n.modo = valor as Modo;
      if (n.modo === 'interna') { n.cliente = ''; n.projeto = ''; n.contato = ''; }
      if (n.modo === 'equipe') n.contato = '';
      if (n.modo === 'cliente') n.responsaveis = [];
    } else if (campo === 'cliente') {
      n.cliente = valor as string;
      n.projeto = ''; n.contato = '';
      carregarContatos(n.cliente);
    } else if (campo === 'projeto') n.projeto = valor as string;
    else if (campo === 'pessoas') {
      if (n.modo === 'cliente') n.contato = valor as string;
      else n.responsaveis = valor as string[];
    }
    return n;
  }

  /** Persiste a alteração de uma linha existente (otimista). */
  async function salvar(l: Linha, campo: Campo, valor: unknown) {
    const atualizada = aplicar(l, campo, valor);
    if (!atualizada.nome.trim()) return; // nome é obrigatório
    setLinhas((ls) => ls.map((x) => (x.id === l.id ? atualizada : x)));
    setErro('');
    try {
      await atualizarTarefa(l.id, linhaParaInput(atualizada));
    } catch {
      setErro('Não foi possível salvar a alteração.');
      onMudou();
    }
  }

  function abrirNova() {
    setNova({
      id: 'nova', nome: '', status: statuses[0]?.valor ?? '', prazo: '',
      modo: presetCliente ? 'equipe' : 'interna',
      cliente: presetCliente ?? '', projeto: presetProjeto ?? '',
      responsaveis: [], contato: '', descricao: '', etiquetas: [],
    });
  }
  async function criarNova() {
    if (!nova || !nova.nome.trim()) return;
    setErro('');
    try {
      await criarTarefa(linhaParaInput(nova));
      setNova(null);
      onMudou();
    } catch {
      setErro('Não foi possível criar a tarefa.');
    }
  }

  /** true quando a célula não se aplica ao vínculo da linha. */
  function inativa(l: Linha, campo: Campo): boolean {
    if (l.modo === 'interna') return campo === 'cliente' || campo === 'projeto';
    if (campo === 'projeto') return !l.cliente;
    return false;
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              {COLS.map((c) => (
                <th key={c.campo} className={cn('px-3 py-2.5 font-medium', c.w)}>{c.label}</th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <Row
                key={l.id} l={l} ehNova={false}
                edit={edit} setEdit={setEdit}
                statuses={statuses} clientes={clientes}
                projetosDe={projetosDe} usuarios={usuarios}
                contatosDe={contatosDe} carregarContatos={carregarContatos}
                nomeUsuario={nomeUsuario} nomeCliente={nomeCliente} nomeProjeto={nomeProjeto}
                inativa={inativa}
                onCampo={(campo, v) => salvar(l, campo, v)}
                onAbrir={() => history.push(`/tarefas/${l.id}`)}
              />
            ))}

            {nova ? (
              <Row
                l={nova} ehNova
                edit={edit} setEdit={setEdit}
                statuses={statuses} clientes={clientes}
                projetosDe={projetosDe} usuarios={usuarios}
                contatosDe={contatosDe} carregarContatos={carregarContatos}
                nomeUsuario={nomeUsuario} nomeCliente={nomeCliente} nomeProjeto={nomeProjeto}
                inativa={inativa}
                onCampo={(campo, v) => setNova((n) => (n ? aplicar(n, campo, v) : n))}
                onCriar={criarNova}
                onCancelar={() => setNova(null)}
              />
            ) : (
              <tr>
                <td colSpan={COLS.length + 1} className="p-0">
                  <button
                    type="button"
                    onClick={abrirNova}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                  >
                    <Plus className="size-4" /> Nova tarefa
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ----------------------------- Linha da grade ----------------------------- */

interface RowProps {
  l: Linha;
  ehNova: boolean;
  edit: { id: string; campo: Campo } | null;
  setEdit: (e: { id: string; campo: Campo } | null) => void;
  statuses: Opcao[];
  clientes: Cliente[];
  projetosDe: (clienteId: string) => Projeto[];
  usuarios: Usuario[];
  contatosDe: (clienteId: string) => Contato[];
  carregarContatos: (clienteId: string) => void;
  nomeUsuario: Record<string, string>;
  nomeCliente: Record<string, string>;
  nomeProjeto: Record<string, string>;
  inativa: (l: Linha, campo: Campo) => boolean;
  onCampo: (campo: Campo, valor: unknown) => void;
  onAbrir?: () => void;
  onCriar?: () => void;
  onCancelar?: () => void;
}

function Row(p: RowProps) {
  const { l, ehNova, edit, setEdit, inativa, onCampo } = p;
  const editando = (campo: Campo) => edit?.id === l.id && edit.campo === campo;
  const abrirEdit = (campo: Campo) => {
    if (inativa(l, campo)) return;
    if (campo === 'cliente') p.carregarContatos(l.cliente);
    setEdit({ id: l.id, campo });
  };
  const fechar = () => setEdit(null);

  function celula(campo: Campo) {
    if (inativa(l, campo)) {
      return <span className="text-muted-foreground/50">—</span>;
    }
    const emEdicao = editando(campo);

    // -------- editores --------
    const parseTags = (v: string) =>
      v.split(',').map((s) => s.trim()).filter(Boolean);
    if (emEdicao && campo === 'nome') {
      return (
        <input autoFocus defaultValue={l.nome} className={inputCls}
          onChange={ehNova ? (e) => onCampo('nome', e.target.value) : undefined}
          onBlur={(e) => { if (!ehNova) onCampo('nome', e.target.value); fechar(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { if (!ehNova) onCampo('nome', e.currentTarget.value); fechar(); }
            if (e.key === 'Escape') fechar();
          }} />
      );
    }
    if (emEdicao && campo === 'descricao') {
      return (
        <textarea autoFocus defaultValue={l.descricao} rows={2}
          className={cn(inputCls, 'h-auto py-1')}
          onChange={ehNova ? (e) => onCampo('descricao', e.target.value) : undefined}
          onBlur={(e) => { if (!ehNova) onCampo('descricao', e.target.value); fechar(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') fechar(); }} />
      );
    }
    if (emEdicao && campo === 'etiquetas') {
      return (
        <input autoFocus defaultValue={l.etiquetas.join(', ')} className={inputCls}
          placeholder="separadas por vírgula"
          onChange={ehNova ? (e) => onCampo('etiquetas', parseTags(e.target.value)) : undefined}
          onBlur={(e) => { if (!ehNova) onCampo('etiquetas', parseTags(e.target.value)); fechar(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { if (!ehNova) onCampo('etiquetas', parseTags(e.currentTarget.value)); fechar(); }
            if (e.key === 'Escape') fechar();
          }} />
      );
    }
    if (emEdicao && campo === 'prazo') {
      return (
        <input autoFocus type="date" defaultValue={l.prazo} className={inputCls}
          onChange={ehNova ? (e) => onCampo('prazo', e.target.value) : undefined}
          onBlur={(e) => { if (!ehNova) onCampo('prazo', e.target.value); fechar(); }} />
      );
    }
    if (emEdicao && campo === 'status') {
      return (
        <select autoFocus value={l.status} className={inputCls}
          onChange={(e) => { onCampo('status', e.target.value); fechar(); }}
          onBlur={fechar}>
          <option value="">—</option>
          {p.statuses.map((s) => <option key={s.id} value={s.valor}>{s.valor}</option>)}
        </select>
      );
    }
    if (emEdicao && campo === 'vinculo') {
      return (
        <select autoFocus value={l.modo} className={inputCls}
          onChange={(e) => { onCampo('vinculo', e.target.value); fechar(); }}
          onBlur={fechar}>
          <option value="interna">Interna</option>
          <option value="equipe">Equipe</option>
          <option value="cliente">Cliente</option>
        </select>
      );
    }
    if (emEdicao && campo === 'cliente') {
      return (
        <select autoFocus value={l.cliente} className={inputCls}
          onChange={(e) => { onCampo('cliente', e.target.value); fechar(); }}
          onBlur={fechar}>
          <option value="">—</option>
          {p.clientes.map((c) => (
            <option key={c.id} value={c.id}>{p.nomeCliente[c.id]}</option>
          ))}
        </select>
      );
    }
    if (emEdicao && campo === 'projeto') {
      const opts = p.projetosDe(l.cliente);
      return (
        <select autoFocus value={l.projeto} className={inputCls}
          onChange={(e) => { onCampo('projeto', e.target.value); fechar(); }}
          onBlur={fechar}>
          <option value="">Sem projeto específico</option>
          {opts.map((pr) => <option key={pr.id} value={pr.id}>{pr.nome}</option>)}
        </select>
      );
    }

    // -------- pessoas (dropdown próprio, sem usar o estado edit) --------
    if (campo === 'pessoas') {
      if (l.modo === 'cliente') {
        if (emEdicao) {
          return (
            <select autoFocus value={l.contato} className={inputCls}
              onChange={(e) => { onCampo('pessoas', e.target.value); fechar(); }}
              onBlur={fechar}>
              <option value="">—</option>
              {p.contatosDe(l.cliente).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          );
        }
        const nome = p.contatosDe(l.cliente).find((c) => c.id === l.contato)?.nome;
        return (
          <button type="button" className="w-full text-left"
            onClick={() => abrirEdit('pessoas')}>
            {nome ?? <span className="text-muted-foreground">—</span>}
          </button>
        );
      }
      // multi (interna/equipe)
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="w-full truncate text-left">
              {l.responsaveis.length
                ? l.responsaveis.map((id) => p.nomeUsuario[id] ?? '?').join(', ')
                : <span className="text-muted-foreground">—</span>}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            {p.usuarios.map((u) => {
              const ativo = l.responsaveis.includes(u.id);
              return (
                <DropdownMenuItem key={u.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    onCampo('pessoas', ativo
                      ? l.responsaveis.filter((x) => x !== u.id)
                      : [...l.responsaveis, u.id]);
                  }}>
                  <Check className={cn('size-3.5', ativo ? 'opacity-100' : 'opacity-0')} />
                  {u.nome || u.email}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    // -------- display (clicável p/ editar) --------
    let conteudo: React.ReactNode;
    if (campo === 'nome') conteudo = l.nome || <span className="text-muted-foreground">Sem nome</span>;
    else if (campo === 'status') {
      conteudo = l.status
        ? <Badge className={cn('border text-[10px]', statusTarefaClass(l.status))}>{l.status}</Badge>
        : <span className="text-muted-foreground">—</span>;
    } else if (campo === 'prazo') {
      conteudo = dataBR(l.prazo) || <span className="text-muted-foreground">—</span>;
    } else if (campo === 'vinculo') conteudo = MODO_LABEL[l.modo];
    else if (campo === 'cliente') {
      conteudo = l.cliente
        ? p.nomeCliente[l.cliente] ?? '—'
        : <span className="text-muted-foreground">—</span>;
    } else if (campo === 'projeto') {
      conteudo = l.projeto
        ? p.nomeProjeto[l.projeto] ?? '—'
        : <span className="text-muted-foreground">—</span>;
    } else if (campo === 'descricao') {
      conteudo = l.descricao
        ? <span className="line-clamp-2 text-xs text-muted-foreground">{l.descricao}</span>
        : <span className="text-muted-foreground">—</span>;
    } else if (campo === 'etiquetas') {
      conteudo = l.etiquetas.length
        ? (
          <span className="flex flex-wrap gap-1">
            {l.etiquetas.map((t) => (
              <Badge key={t} variant="muted" className="text-[10px]">{t}</Badge>
            ))}
          </span>
        )
        : <span className="text-muted-foreground">—</span>;
    }
    return (
      <button type="button" className="w-full truncate text-left"
        onClick={() => abrirEdit(campo)}>
        {conteudo}
      </button>
    );
  }

  return (
    <tr className={cn('border-b border-border', ehNova && 'bg-primary/[0.04]')}>
      {COLS.map((c) => (
        <td key={c.campo} className={cn('px-3 py-2 align-top', c.w)}>
          {celula(c.campo)}
        </td>
      ))}
      <td className="px-2 py-2 text-center align-top">
        {ehNova ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={p.onCriar} aria-label="Salvar tarefa"
              className="rounded-md p-1 text-primary hover:bg-primary/10" title="Salvar">
              <Check className="size-4" />
            </button>
            <button type="button" onClick={p.onCancelar} aria-label="Cancelar"
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary" title="Cancelar">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={p.onAbrir} aria-label="Abrir tarefa"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Abrir página da tarefa">
            <ExternalLink className="size-4" />
          </button>
        )}
      </td>
    </tr>
  );
}
