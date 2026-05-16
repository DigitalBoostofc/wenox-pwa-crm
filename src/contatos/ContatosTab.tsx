import { useEffect, useState, useCallback } from 'react';
import {
  UserPlus, Mail, Phone, Pencil, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  listContatos, createContato, updateContato, removeContato,
} from '@/contatos/contatosService';
import type { Contato, ContatoInput } from '@/contatos/types';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';
import { useAuth } from '@/auth/useAuth';
import { canGerirEquipe } from '@/auth/perms';
import { dataBR, statusVariant } from '@/clientes/format';
import { AtividadeFeed } from '@/atividade/AtividadeFeed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const vazio: Omit<ContatoInput, 'cliente'> = {
  nome: '', cargo: '', email: '', telefone: '', status: '', ultimo_acesso: '',
};
const inputCls =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

export function ContatosTab({ clienteId }: { clienteId: string }) {
  const { user } = useAuth();
  const podeGerir = canGerirEquipe(user?.role);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [statusOpts, setStatusOpts] = useState<Opcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...vazio });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setContatos(await listContatos(clienteId));
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    carregar();
    listOpcoes('status_contato').then(setStatusOpts);
  }, [carregar]);

  function abrirNovo() {
    setEditId(null);
    setForm({ ...vazio, status: statusOpts[0]?.valor ?? '' });
    setMostrarForm(true);
    setErro('');
  }
  function abrirEdicao(c: Contato) {
    setEditId(c.id);
    setForm({
      nome: c.nome, cargo: c.cargo ?? '', email: c.email ?? '',
      telefone: c.telefone ?? '', status: c.status ?? '',
      ultimo_acesso: c.ultimo_acesso ?? '',
    });
    setMostrarForm(true);
    setErro('');
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) {
      setErro('Nome é obrigatório');
      return;
    }
    try {
      if (editId) await updateContato(editId, form);
      else await createContato({ ...form, cliente: clienteId });
      setMostrarForm(false);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  async function excluir(c: Contato) {
    if (!confirm(`Remover ${c.nome}?`)) return;
    await removeContato(c);
    await carregar();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Pessoas do cliente que aprovam, acessam ou acompanham o trabalho.
        </p>
        {podeGerir && (
          <Button size="sm" onClick={abrirNovo}>
            <UserPlus /> Novo contato
          </Button>
        )}
      </div>

      {mostrarForm && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ct-nome" className="text-sm text-muted-foreground">Nome</label>
                <Input id="ct-nome" value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ct-cargo" className="text-sm text-muted-foreground">Função / cargo</label>
                <Input id="ct-cargo" value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ct-email" className="text-sm text-muted-foreground">E-mail</label>
                <Input id="ct-email" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ct-tel" className="text-sm text-muted-foreground">Telefone</label>
                <Input id="ct-tel" value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ct-st" className="text-sm text-muted-foreground">Status</label>
                <select id="ct-st" className={inputCls} value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="">—</option>
                  {statusOpts.map((o) => <option key={o.id} value={o.valor}>{o.valor}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ct-ua" className="text-sm text-muted-foreground">Último acesso</label>
                <Input id="ct-ua" type="date" value={form.ultimo_acesso}
                  onChange={(e) => setForm({ ...form, ultimo_acesso: e.target.value })} />
              </div>
              {erro && <p className="text-sm font-medium text-destructive sm:col-span-2">{erro}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" size="sm">{editId ? 'Salvar' : 'Adicionar'}</Button>
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => setMostrarForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {carregando ? (
        <Card><CardContent className="space-y-3 py-6">
          <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
        </CardContent></Card>
      ) : contatos.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum contato do cliente cadastrado.
        </CardContent></Card>
      ) : (
        <Card className="divide-y divide-border">
          {contatos.map((c) => {
            const exp = aberto === c.id;
            return (
              <div key={c.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => setAberto(exp ? null : c.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-label={`Detalhes de ${c.nome}`}
                  >
                    {exp ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                         : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {c.nome}
                        {c.cargo && <span className="text-muted-foreground"> · {c.cargo}</span>}
                      </p>
                      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {c.email && <span className="flex items-center gap-1"><Mail className="size-3" />{c.email}</span>}
                        {c.telefone && <span className="flex items-center gap-1"><Phone className="size-3" />{c.telefone}</span>}
                        {c.ultimo_acesso && <span>Último acesso: {dataBR(c.ultimo_acesso)}</span>}
                      </p>
                    </div>
                    {c.status && <Badge variant={statusVariant(c.status)}>{c.status}</Badge>}
                  </button>
                  {podeGerir && (
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" aria-label={`Editar ${c.nome}`}
                        onClick={() => abrirEdicao(c)}><Pencil /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive"
                        aria-label={`Remover ${c.nome}`} onClick={() => excluir(c)}><Trash2 /></Button>
                    </div>
                  )}
                </div>
                {exp && (
                  <div className="px-4 pb-4">
                    <AtividadeFeed entidade="contato" refId={c.id} />
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
