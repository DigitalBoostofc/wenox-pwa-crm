import { useEffect, useState } from 'react';
import { Camera, Image as ImageIcon, Trash2, X } from 'lucide-react';
import { listUsuarios, criarUsuario, excluirUsuario, fotoUrl } from '@/usuarios/usuariosService';
import { ROLES } from '@/usuarios/types';
import type { Usuario } from '@/usuarios/types';
import { EditarUsuarioSheet } from '@/usuarios/EditarUsuarioSheet';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

const ROTULO_CAMPO: Record<string, string> = {
  nome: 'Nome', email: 'E-mail', password: 'Senha', role: 'Papel', area: 'Função',
};

/** Extrai a mensagem real do erro do PocketBase (campo a campo, em PT). */
function mensagemErroUsuario(err: unknown): string {
  const e = err as {
    response?: { data?: Record<string, { message?: string }> };
    data?: Record<string, { message?: string }>;
    message?: string;
  };
  const campos = e?.response?.data ?? e?.data;
  if (campos && typeof campos === 'object' && Object.keys(campos).length) {
    const partes = Object.entries(campos).map(([campo, info]) => {
      const rotulo = ROTULO_CAMPO[campo] ?? campo;
      let msg = info?.message ?? 'inválido';
      if (/at least 8/i.test(msg)) msg = 'precisa de no mínimo 8 caracteres';
      else if (/already exists|not unique/i.test(msg)) msg = 'já está em uso';
      else if (/required|cannot be blank/i.test(msg)) msg = 'é obrigatório';
      else if (/valid email/i.test(msg)) msg = 'e-mail inválido';
      return `${rotulo}: ${msg}`;
    });
    return `Não foi possível criar — ${partes.join(' · ')}`;
  }
  return 'Erro ao criar usuário. Verifique os dados e tente de novo.';
}

export function UsuariosPage() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [editando, setEditando] = useState<Usuario | null>(null);
  /** id do usuário com confirmação de exclusão aberta. */
  const [confirmarExclusao, setConfirmarExclusao] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [erroLista, setErroLista] = useState('');
  const [novo, setNovo] = useState({ nome: '', email: '', telefone: '', role: 'Membro', area: '' });
  const [senha, setSenha] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [funcoes, setFuncoes] = useState<Opcao[]>([]);
  const [erro, setErro] = useState('');
  /** Credenciais do último usuário criado — exibidas pra o admin repassar. */
  const [criado, setCriado] = useState<{ nome: string; email: string; senha: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = async () => setUsuarios(await listUsuarios());
  useEffect(() => {
    carregar();
    listOpcoes('tipo_projeto').then(setFuncoes);
  }, []);

  const [salvando, setSalvando] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    // Validação no front — evita ida ao servidor com dado inválido.
    if (!novo.nome.trim()) { setErro('Informe o nome do usuário.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(novo.email.trim())) {
      setErro('Informe um e-mail válido.'); return;
    }
    if (senha.length < 8) {
      setErro('A senha inicial precisa ter no mínimo 8 caracteres.'); return;
    }
    setSalvando(true);
    try {
      const nome = novo.nome.trim();
      const email = novo.email.trim();
      await criarUsuario(
        {
          nome,
          email,
          telefone: novo.telefone.trim() || undefined,
          role: novo.role as Usuario['role'],
          area: novo.area || undefined,
          status: 'Ativo',
        },
        senha,
        foto,
      );
      setCriado({ nome, email, senha });
      setCopiado(false);
      setNovo({ nome: '', email: '', telefone: '', role: 'Membro', area: '' });
      setSenha('');
      setFoto(null);
      await carregar();
    } catch (err) {
      setErro(mensagemErroUsuario(err));
    } finally {
      setSalvando(false);
    }
  }

  async function copiarCredenciais() {
    if (!criado) return;
    const txt =
      `Acesso Wenox OS\n` +
      `Site: https://app.wenox.com.br\n` +
      `E-mail: ${criado.email}\n` +
      `Senha: ${criado.senha}`;
    try {
      await navigator.clipboard.writeText(txt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* clipboard pode falhar sem https/permissão — ignora */
    }
  }

  async function excluir(u: Usuario) {
    setErroLista('');
    setRemovendo(true);
    try {
      await excluirUsuario(u.id);
      setUsuarios((prev) => prev.filter((x) => x.id !== u.id));
      setConfirmarExclusao(null);
    } catch {
      setErroLista('Não foi possível excluir o acesso. Tente novamente.');
    } finally {
      setRemovendo(false);
    }
  }

  /** Gera uma senha inicial aleatória de 10 caracteres. */
  function gerarSenha() {
    const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 10; i++) s += cs[Math.floor(Math.random() * cs.length)];
    setSenha(s);
  }

  return (
    <div className="flex flex-col gap-5">
      {criado && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="flex flex-col gap-3 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-emerald-400">
                  Usuário "{criado.nome}" criado!
                </p>
                <p className="text-sm text-muted-foreground">
                  Repasse estas credenciais — a senha não fica visível depois.
                </p>
              </div>
              <button
                onClick={() => setCriado(null)}
                aria-label="Fechar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-1 rounded-md border border-border bg-background/40 px-4 py-3 text-sm">
              <span><span className="text-muted-foreground">E-mail:</span> <span className="font-medium">{criado.email}</span></span>
              <span><span className="text-muted-foreground">Senha:</span> <span className="font-mono font-medium">{criado.senha}</span></span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={copiarCredenciais}
            >
              {copiado ? 'Copiado!' : 'Copiar credenciais'}
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Novo usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">
                Foto de perfil
              </span>
              <div className="flex items-center gap-4">
                <label
                  title="Selecionar foto"
                  className="group relative grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-secondary text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {foto ? (
                    <img src={URL.createObjectURL(foto)} alt="Prévia"
                      className="size-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-center">
                      <Camera className="size-6" />
                      <span className="text-[10px] leading-tight">Adicionar<br />foto</span>
                    </div>
                  )}
                  <span className="absolute inset-0 hidden place-items-center bg-black/50 text-xs font-medium text-white group-hover:grid">
                    {foto ? 'Trocar' : 'Selecionar'}
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
                </label>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-secondary">
                      <ImageIcon className="size-4" />
                      {foto ? 'Trocar foto' : 'Escolher foto'}
                    </span>
                    <input type="file" accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
                  </label>
                  {foto ? (
                    <button type="button" onClick={() => setFoto(null)}
                      className="inline-flex items-center gap-1 text-left text-xs text-muted-foreground hover:text-destructive">
                      <X className="size-3" /> Remover
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">PNG, JPG ou WEBP</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="un" className="text-sm font-medium text-muted-foreground">
                Nome
              </label>
              <Input
                id="un"
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ue" className="text-sm font-medium text-muted-foreground">
                E-mail
              </label>
              <Input
                id="ue"
                type="email"
                value={novo.email}
                onChange={(e) => setNovo({ ...novo, email: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="utel" className="text-sm font-medium text-muted-foreground">
                Celular
              </label>
              <Input
                id="utel"
                type="tel"
                inputMode="tel"
                placeholder="(00) 00000-0000"
                value={novo.telefone}
                onChange={(e) => setNovo({ ...novo, telefone: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ur" className="text-sm font-medium text-muted-foreground">
                Papel
              </label>
              <select
                id="ur"
                value={novo.role}
                onChange={(e) => setNovo({ ...novo, role: e.target.value })}
                className={selectClass}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="uf" className="text-sm font-medium text-muted-foreground">
                Função
              </label>
              <select
                id="uf"
                value={novo.area}
                onChange={(e) => setNovo({ ...novo, area: e.target.value })}
                className={selectClass}
              >
                <option value="">—</option>
                {funcoes.map((f) => <option key={f.id} value={f.valor}>{f.valor}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="up" className="text-sm font-medium text-muted-foreground">
                Senha inicial
              </label>
              <div className="flex gap-2">
                <Input
                  id="up"
                  type="text"
                  value={senha}
                  placeholder="Mínimo 8 caracteres"
                  onChange={(e) => setSenha(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={gerarSenha}>
                  Gerar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O usuário entra com esse e-mail e senha; depois pode trocá-la.
              </p>
            </div>
            {erro && (
              <p className="text-sm font-medium text-destructive">{erro}</p>
            )}
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Criando…' : 'Adicionar usuário'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {erroLista && (
        <p className="text-sm font-medium text-destructive">{erroLista}</p>
      )}

      <Card className="divide-y divide-border">
        {usuarios.map((u) => (
          <div
            key={u.id}
            className="flex w-full items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50"
          >
            <button
              type="button"
              onClick={() => setEditando(u)}
              className="flex min-w-0 flex-1 items-center gap-4 text-left"
            >
              {u.foto ? (
                <img src={fotoUrl(u, '100x100')} alt={u.nome}
                  loading="lazy" decoding="async"
                  className="size-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-primary ring-1 ring-primary/40">
                  {(u.nome || u.email || '?').charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{u.nome}</p>
                <p className="text-sm text-muted-foreground">{u.email}</p>
              </div>
            </button>

            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {u.status !== 'Ativo' && <Badge variant="muted">Inativo</Badge>}
              {u.area && <Badge variant="muted">{u.area}</Badge>}
              <Badge variant={u.status === 'Ativo' ? 'success' : 'muted'}>
                {u.role}
              </Badge>
            </div>

            {/* Excluir acesso: só aparece para contas desativadas. */}
            {u.status !== 'Ativo' && u.id !== user?.id && (
              confirmarExclusao === u.id ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={removendo}
                    onClick={() => excluir(u)}
                  >
                    {removendo ? 'Excluindo…' : 'Confirmar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={removendo}
                    onClick={() => setConfirmarExclusao(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  title="Excluir acesso"
                  aria-label={`Excluir acesso de ${u.nome || u.email}`}
                  onClick={() => { setErroLista(''); setConfirmarExclusao(u.id); }}
                  className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              )
            )}
          </div>
        ))}
      </Card>

      {editando && (
        <EditarUsuarioSheet
          usuario={editando}
          funcoes={funcoes}
          meRole={user?.role}
          meId={user?.id}
          onClose={() => setEditando(null)}
          onSaved={(u) => {
            setUsuarios((prev) => prev.map((x) => (x.id === u.id ? u : x)));
            setEditando(u);
          }}
        />
      )}
    </div>
  );
}
