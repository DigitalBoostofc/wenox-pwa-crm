import { useEffect, useState, useCallback } from 'react';
import {
  FileText, Link2, Plus, Trash2, ExternalLink, Download, Eye, Image as ImageIcon,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  listDocumentos, createDocumento, removeDocumento, abrir, isImagem,
} from '@/documentos/documentosService';
import type { Documento, TipoDocumento } from '@/documentos/types';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';
import { useAuth } from '@/auth/useAuth';
import { canGerirEquipe } from '@/auth/perms';
import { haDias } from '@/clientes/format';
import { AtividadeFeed } from '@/atividade/AtividadeFeed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const inputCls =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

export function DocumentosTab({ clienteId }: { clienteId: string }) {
  const { user } = useAuth();
  const podeGerir = canGerirEquipe(user?.role);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [cats, setCats] = useState<Opcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({
    nome: '', categoria: '', tipo: 'arquivo' as TipoDocumento,
    url: '', observacoes: '',
  });
  const [arquivo, setArquivo] = useState<File | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDocs(await listDocumentos(clienteId));
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    carregar();
    listOpcoes('categoria_documento').then(setCats);
  }, [carregar]);

  function abrirNovo() {
    setForm({ nome: '', categoria: '', tipo: 'arquivo', url: '', observacoes: '' });
    setArquivo(null);
    setErro('');
    setMostrarForm(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!form.nome.trim()) return setErro('Nome é obrigatório');
    if (form.tipo === 'arquivo' && !arquivo) return setErro('Selecione um arquivo');
    if (form.tipo === 'link' && !form.url.trim()) return setErro('Informe o link');
    setSalvando(true);
    try {
      await createDocumento({ ...form, cliente: clienteId }, arquivo);
      setMostrarForm(false);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(d: Documento) {
    if (!confirm(`Remover "${d.nome}"?`)) return;
    await removeDocumento(d);
    await carregar();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Principais documentos do cliente — arquivo ou link (ex: Drive).
        </p>
        {podeGerir && (
          <Button size="sm" onClick={abrirNovo}><Plus /> Novo documento</Button>
        )}
      </div>

      {mostrarForm && (
        <Card><CardContent className="pt-6">
          <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dc-nome" className="text-sm text-muted-foreground">Nome</label>
              <Input id="dc-nome" value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dc-cat" className="text-sm text-muted-foreground">Categoria</label>
              <select id="dc-cat" className={inputCls} value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                <option value="">—</option>
                {cats.map((o) => <option key={o.id} value={o.valor}>{o.valor}</option>)}
              </select>
            </div>
            <div className="flex gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="tipo" checked={form.tipo === 'arquivo'}
                  onChange={() => setForm({ ...form, tipo: 'arquivo' })} /> Arquivo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="tipo" checked={form.tipo === 'link'}
                  onChange={() => setForm({ ...form, tipo: 'link' })} /> Link (ex: Drive)
              </label>
            </div>
            {form.tipo === 'arquivo' ? (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="dc-file" className="text-sm text-muted-foreground">Arquivo (até 25MB)</label>
                <input id="dc-file" type="file" className="text-sm"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="dc-url" className="text-sm text-muted-foreground">Link</label>
                <Input id="dc-url" placeholder="https://drive.google.com/..."
                  value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
            )}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="dc-obs" className="text-sm text-muted-foreground">Observações</label>
              <Input id="dc-obs" value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            {erro && <p className="text-sm font-medium text-destructive sm:col-span-2">{erro}</p>}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" disabled={salvando}>
                {salvando ? 'Salvando…' : 'Adicionar'}
              </Button>
              <Button type="button" size="sm" variant="ghost"
                onClick={() => setMostrarForm(false)}>Cancelar</Button>
            </div>
          </form>
        </CardContent></Card>
      )}

      {carregando ? (
        <Card><CardContent className="space-y-3 py-6">
          <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
        </CardContent></Card>
      ) : docs.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum documento cadastrado.
        </CardContent></Card>
      ) : (
        <Card className="divide-y divide-border">
          {docs.map((d) => {
            const exp = aberto === d.id;
            const link = abrir(d);
            const img = isImagem(d);
            return (
              <div key={d.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setAberto(exp ? null : d.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-label={`Detalhes de ${d.nome}`}>
                    {exp ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                         : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                    {d.tipo === 'link'
                      ? <Link2 className="size-4 shrink-0 text-primary" />
                      : img
                        ? <ImageIcon className="size-4 shrink-0 text-primary" />
                        : <FileText className="size-4 shrink-0 text-primary" />}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.tipo === 'link' ? 'Link' : 'Arquivo'} · adicionado {haDias(d.created) || '—'}
                      </p>
                    </div>
                    {d.categoria && <Badge variant="muted">{d.categoria}</Badge>}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {link && (
                      <a href={link} target="_blank" rel="noopener"
                        aria-label={`Abrir ${d.nome}`}
                        className="text-muted-foreground hover:text-foreground">
                        {d.tipo === 'link'
                          ? <ExternalLink className="size-4" />
                          : img
                            ? <Eye className="size-4" />
                            : <Download className="size-4" />}
                      </a>
                    )}
                    {podeGerir && (
                      <Button size="icon" variant="ghost" className="text-destructive"
                        aria-label={`Remover ${d.nome}`}
                        onClick={() => excluir(d)}><Trash2 /></Button>
                    )}
                  </div>
                </div>
                {exp && (
                  <div className="px-4 pb-4">
                    {img && (
                      <a href={link} target="_blank" rel="noopener"
                        className="mb-3 block" title="Abrir em tamanho real">
                        <img src={link} alt={d.nome}
                          className="max-h-96 w-auto rounded-lg border border-border object-contain" />
                      </a>
                    )}
                    {d.observacoes && (
                      <p className="mb-3 rounded-md bg-secondary/50 p-3 text-sm text-muted-foreground">
                        {d.observacoes}
                      </p>
                    )}
                    <AtividadeFeed entidade="documento" refId={d.id} />
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
