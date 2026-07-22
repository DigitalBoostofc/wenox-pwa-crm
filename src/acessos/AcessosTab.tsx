import { useEffect, useState, useCallback } from 'react';
import {
  KeyRound, Plus, Trash2, Eye, EyeOff, Copy, ExternalLink,
  MessageSquare, ShieldCheck, ChevronRight,
} from 'lucide-react';
import {
  listAcessos, createAcesso, updateAcesso, removeAcesso,
} from '@/acessos/acessosService';
import type { Acesso, AcessoInput } from '@/acessos/types';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { useAuth } from '@/auth/useAuth';
import { canGerirEquipe } from '@/auth/perms';
import { haDias } from '@/clientes/format';
import { AtividadeFeed } from '@/atividade/AtividadeFeed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const vazio: Omit<AcessoInput, 'cliente'> = {
  plataforma: '', categoria: '', url: '', login: '', senha: '',
  tem_2fa: false, responsavel: '', observacoes: '',
};
const inputCls =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

async function copiar(texto: string) {
  try {
    await navigator.clipboard?.writeText(texto);
  } catch { /* */ }
}

function LoginInline({ valor }: { valor?: string }) {
  if (!valor) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="max-w-[180px] truncate font-mono text-sm">{valor}</span>
      <button type="button" aria-label="Copiar login"
        onClick={(e) => { e.stopPropagation(); void copiar(valor); }}
        className="text-muted-foreground hover:text-foreground">
        <Copy className="size-3.5" />
      </button>
    </span>
  );
}

function SenhaInline({ valor }: { valor?: string }) {
  const [ver, setVer] = useState(false);
  if (!valor) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-sm">{ver ? valor : '••••••••'}</span>
      <button type="button" aria-label={ver ? 'Ocultar senha' : 'Revelar senha'}
        onClick={(e) => { e.stopPropagation(); setVer((v) => !v); }}
        className="text-muted-foreground hover:text-foreground">
        {ver ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
      <button type="button" aria-label="Copiar senha"
        onClick={(e) => { e.stopPropagation(); void copiar(valor); }}
        className="text-muted-foreground hover:text-foreground">
        <Copy className="size-3.5" />
      </button>
    </span>
  );
}

export function AcessosTab({ clienteId }: { clienteId: string }) {
  const { user } = useAuth();
  const podeGerir = canGerirEquipe(user?.role);
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [cats, setCats] = useState<Opcao[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...vazio });
  const [mostrarForm, setMostrarForm] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [historicoId, setHistoricoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setAcessos(await listAcessos(clienteId));
    } finally {
      setCarregando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    carregar();
    listOpcoes('categoria_acesso').then(setCats);
    listUsuarios().then(setUsuarios).catch(() => {});
  }, [carregar]);

  function abrirNovo() {
    setEditId(null);
    setForm({ ...vazio });
    setMostrarForm(true);
    setErro('');
  }

  /** Clique no acesso → modal flutuante com o formulário. */
  function abrirEdicao(a: Acesso) {
    if (!podeGerir) {
      setHistoricoId(a.id);
      return;
    }
    setEditId(a.id);
    setForm({
      plataforma: a.plataforma, categoria: a.categoria ?? '', url: a.url ?? '',
      login: a.login ?? '', senha: a.senha ?? '', tem_2fa: !!a.tem_2fa,
      responsavel: a.responsavel ?? '', observacoes: a.observacoes ?? '',
    });
    setMostrarForm(true);
    setErro('');
  }

  /** Fecha sem salvar (X, clique fora, Cancelar, Esc). */
  function fecharSemSalvar() {
    setMostrarForm(false);
    setEditId(null);
    setForm({ ...vazio });
    setErro('');
    setSalvando(false);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!form.plataforma.trim()) {
      setErro('Plataforma é obrigatória');
      return;
    }
    setSalvando(true);
    try {
      if (editId) await updateAcesso(editId, form);
      else await createAcesso({ ...form, cliente: clienteId });
      fecharSemSalvar();
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
      setSalvando(false);
    }
  }

  async function excluir(a: Acesso) {
    if (!confirm(`Remover o acesso "${a.plataforma}"?`)) return;
    await removeAcesso(a);
    if (editId === a.id) fecharSemSalvar();
    await carregar();
  }

  function nomeResp(a: Acesso) {
    return a.expand?.responsavel?.nome ?? a.expand?.responsavel?.email ?? '—';
  }

  const acessoHistorico = historicoId ? acessos.find((x) => x.id === historicoId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Logins e senhas das ferramentas usadas para este cliente.
          {podeGerir && ' Clique em um acesso para editar.'}
        </p>
        {podeGerir && (
          <Button size="sm" onClick={abrirNovo}><Plus /> Novo acesso</Button>
        )}
      </div>

      {/* Modal flutuante — fundo embasado; clique fora fecha sem salvar */}
      <Dialog
        open={mostrarForm}
        onOpenChange={(o) => {
          if (!o) fecharSemSalvar();
        }}
      >
        <DialogContent className="max-w-xl gap-0 overflow-y-auto p-0 sm:max-w-xl">
          <div className="border-b border-border px-5 py-4 pr-12">
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              {editId ? (form.plataforma || 'Editar acesso') : 'Novo acesso'}
            </DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Altere os campos e clique em Salvar. Fechar ou clicar fora descarta as alterações.
            </p>
          </div>

          <form onSubmit={salvar} className="grid gap-3 p-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ac-pl" className="text-sm text-muted-foreground">Plataforma</label>
              <Input id="ac-pl" value={form.plataforma}
                onChange={(e) => setForm({ ...form, plataforma: e.target.value })}
                autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ac-cat" className="text-sm text-muted-foreground">Categoria</label>
              <select id="ac-cat" className={inputCls} value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                <option value="">—</option>
                {cats.map((o) => <option key={o.id} value={o.valor}>{o.valor}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="ac-url" className="text-sm text-muted-foreground">URL / site</label>
              <Input id="ac-url" value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ac-login" className="text-sm text-muted-foreground">Login</label>
              <Input id="ac-login" value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ac-senha" className="text-sm text-muted-foreground">Senha</label>
              <Input id="ac-senha" value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ac-resp" className="text-sm text-muted-foreground">Responsável (Wenox)</label>
              <select id="ac-resp" className={inputCls} value={form.responsavel}
                onChange={(e) => setForm({ ...form, responsavel: e.target.value })}>
                <option value="">—</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={!!form.tem_2fa}
                onChange={(e) => setForm({ ...form, tem_2fa: e.target.checked })} />
              Tem 2FA (autenticação em duas etapas)
            </label>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="ac-obs" className="text-sm text-muted-foreground">Observações</label>
              <textarea id="ac-obs" rows={3} value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="w-full rounded-md border border-input bg-background/40 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
            </div>
            {erro && <p className="text-sm font-medium text-destructive sm:col-span-2">{erro}</p>}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4 sm:col-span-2">
              <Button type="submit" size="sm" disabled={salvando}>
                {salvando ? 'Salvando…' : (editId ? 'Salvar' : 'Adicionar')}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={fecharSemSalvar}>
                Cancelar
              </Button>
              {editId && (
                <>
                  <span className="mx-1 h-4 w-px bg-border" />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setHistoricoId(editId)}
                  >
                    <MessageSquare className="size-3.5" /> Comentários
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      const a = acessos.find((x) => x.id === editId);
                      if (a) void excluir(a);
                    }}
                  >
                    <Trash2 className="size-3.5" /> Remover
                  </Button>
                </>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {carregando ? (
        <Card><CardContent className="space-y-3 py-6">
          <Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" />
        </CardContent></Card>
      ) : acessos.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum acesso cadastrado para este cliente.
        </CardContent></Card>
      ) : (
        <Card className="divide-y divide-border">
          {acessos.map((a) => (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              onClick={() => abrirEdicao(a)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  abrirEdicao(a);
                }
              }}
              className={cn(
                'flex flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors',
                'cursor-pointer hover:bg-secondary/50',
              )}
              aria-label={`${podeGerir ? 'Editar' : 'Ver'} ${a.plataforma}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <KeyRound className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {a.plataforma}
                    {a.categoria && (
                      <span className="text-muted-foreground"> · {a.categoria}</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {nomeResp(a)} · atualizado {haDias(a.updated) || '—'}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </div>

              <div
                className="flex items-center gap-3"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <LoginInline valor={a.login} />
                <SenhaInline valor={a.senha} />
                {a.tem_2fa && (
                  <Badge variant="info" className="gap-1">
                    <ShieldCheck className="size-3" />2FA
                  </Badge>
                )}
                {a.url && (
                  <a
                    href={a.url.startsWith('http') ? a.url : `https://${a.url}`}
                    target="_blank"
                    rel="noopener"
                    aria-label="Abrir site"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      <Sheet open={!!historicoId} onOpenChange={(o) => { if (!o) setHistoricoId(null); }}>
        <SheetContent className="flex w-full max-w-lg flex-col gap-4 overflow-y-auto sm:max-w-lg">
          <SheetTitle className="flex items-center gap-2 pr-8">
            <MessageSquare className="size-5 text-primary" />
            {acessoHistorico?.plataforma ?? 'Acesso'}
          </SheetTitle>
          {acessoHistorico && (
            <div className="flex flex-col gap-4">
              {acessoHistorico.observacoes && (
                <p className="rounded-md bg-secondary/50 p-3 text-sm text-muted-foreground">
                  {acessoHistorico.observacoes}
                </p>
              )}
              <AtividadeFeed entidade="acesso" refId={acessoHistorico.id} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
