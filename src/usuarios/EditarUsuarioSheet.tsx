import { useState } from 'react';
import { Camera, KeyRound, Power, Save } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  atualizarUsuario,
  definirSenhaUsuario,
  fotoUrl,
} from '@/usuarios/usuariosService';
import { ROLES } from '@/usuarios/types';
import type { Usuario } from '@/usuarios/types';
import type { Opcao } from '@/opcoes/types';

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

interface Props {
  usuario: Usuario;
  funcoes: Opcao[];
  /** Papel de quem está editando — só Owner pode atribuir/editar Owner. */
  meRole?: string;
  /** id de quem está logado — impede desativar a própria conta. */
  meId?: string;
  onClose: () => void;
  onSaved: (u: Usuario) => void;
}

export function EditarUsuarioSheet({
  usuario,
  funcoes,
  meRole,
  meId,
  onClose,
  onSaved,
}: Props) {
  const [nome, setNome] = useState(usuario.nome ?? '');
  const [email, setEmail] = useState(usuario.email ?? '');
  const [role, setRole] = useState<string>(usuario.role);
  const [area, setArea] = useState(usuario.area ?? '');
  const [telefone, setTelefone] = useState(usuario.telefone ?? '');
  const [foto, setFoto] = useState<File | null>(null);

  // Dados cadastrais completos.
  const [extra, setExtra] = useState({
    nome_completo: usuario.nome_completo ?? '',
    cpf: usuario.cpf ?? '',
    cnpj: usuario.cnpj ?? '',
    endereco: usuario.endereco ?? '',
    data_nascimento: usuario.data_nascimento ?? '',
    chave_pix: usuario.chave_pix ?? '',
    contrato: usuario.contrato ?? '',
    periodo: usuario.periodo ?? '',
    observacao: usuario.observacao ?? '',
  });
  const setCampo = (k: keyof typeof extra, v: string) =>
    setExtra((e) => ({ ...e, [k]: v }));

  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [trocandoStatus, setTrocandoStatus] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  const ativo = usuario.status === 'Ativo';
  const ehEu = usuario.id === meId;
  const ehOwner = usuario.role === 'Owner';
  const souOwner = meRole === 'Owner';
  // Só Owner mexe em contas Owner; ninguém rebaixa a si mesmo por aqui.
  const bloqueado = (ehOwner && !souOwner) || ehEu;

  // Owner só aparece como opção para quem já é Owner — mas o papel atual da
  // conta sempre aparece (senão o select travado mostraria o papel errado).
  const rolesDisponiveis = ROLES.filter(
    (r) => r === usuario.role || r !== 'Owner' || souOwner,
  );

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setOk('');
    if (!nome.trim()) { setErro('Informe o nome.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErro('Informe um e-mail válido.'); return;
    }
    setSalvando(true);
    try {
      const u = await atualizarUsuario(
        usuario.id,
        {
          nome: nome.trim(),
          email: email.trim(),
          role: role as Usuario['role'],
          area: area || undefined,
          telefone: telefone.trim() || undefined,
          nome_completo: extra.nome_completo.trim(),
          cpf: extra.cpf.trim(),
          cnpj: extra.cnpj.trim(),
          endereco: extra.endereco.trim(),
          data_nascimento: extra.data_nascimento.trim(),
          chave_pix: extra.chave_pix.trim(),
          contrato: extra.contrato.trim(),
          periodo: extra.periodo.trim(),
          observacao: extra.observacao.trim(),
        },
        foto,
      );
      setFoto(null);
      setOk('Alterações salvas.');
      onSaved(u);
    } catch {
      setErro('Não foi possível salvar. Verifique os dados (e-mail pode já estar em uso).');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarStatus() {
    setErro('');
    setOk('');
    setTrocandoStatus(true);
    try {
      const novo = ativo ? 'Inativo' : 'Ativo';
      const u = await atualizarUsuario(usuario.id, { status: novo });
      setOk(novo === 'Inativo' ? 'Conta desativada.' : 'Conta reativada.');
      onSaved(u);
    } catch {
      setErro('Não foi possível alterar o status.');
    } finally {
      setTrocandoStatus(false);
    }
  }

  async function salvarSenha() {
    setErro('');
    setOk('');
    if (senha.length < 8) {
      setErro('A nova senha precisa de no mínimo 8 caracteres.'); return;
    }
    if (senha !== senha2) {
      setErro('As senhas não conferem.'); return;
    }
    setSalvandoSenha(true);
    try {
      await definirSenhaUsuario(usuario.id, senha);
      setSenha('');
      setSenha2('');
      setOk('Senha redefinida. Repasse a nova senha ao usuário.');
    } catch {
      setErro(
        'Não foi possível redefinir a senha. Verifique se a "Manage rule" da coleção usuarios está configurada no PocketBase.',
      );
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full max-w-md overflow-y-auto sm:max-w-lg"
      >
        <SheetTitle className="pr-8 text-base">Editar usuário</SheetTitle>

        {/* Cabeçalho com foto atual */}
        <div className="flex items-center gap-3">
          <label
            title="Trocar foto"
            className="group relative grid size-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-border bg-secondary text-muted-foreground hover:border-primary"
          >
            {foto ? (
              <img src={URL.createObjectURL(foto)} alt="Prévia"
                className="size-full object-cover" />
            ) : usuario.foto ? (
              <img src={fotoUrl(usuario, '100x100')} alt={usuario.nome}
                className="size-full object-cover" />
            ) : (
              <Camera className="size-5" />
            )}
            <span className="absolute inset-0 hidden place-items-center bg-black/50 text-[10px] font-medium text-white group-hover:grid">
              Trocar
            </span>
            <input type="file" accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
          </label>
          <div className="min-w-0">
            <p className="truncate font-medium">{usuario.nome}</p>
            <Badge variant={ativo ? 'success' : 'muted'}>
              {ativo ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </div>

        {/* Form de dados */}
        <form onSubmit={salvarDados} className="flex flex-col gap-3">
          <Campo label="Nome">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <Campo label="Nome completo">
            <Input value={extra.nome_completo}
              onChange={(e) => setCampo('nome_completo', e.target.value)} />
          </Campo>
          <Campo label="E-mail">
            <Input type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          <Campo label="Telefone">
            <Input value={telefone}
              onChange={(e) => setTelefone(e.target.value)} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="CPF">
              <Input value={extra.cpf}
                onChange={(e) => setCampo('cpf', e.target.value)} />
            </Campo>
            <Campo label="CNPJ">
              <Input value={extra.cnpj}
                onChange={(e) => setCampo('cnpj', e.target.value)} />
            </Campo>
          </div>
          <Campo label="Chave Pix">
            <Input value={extra.chave_pix}
              onChange={(e) => setCampo('chave_pix', e.target.value)} />
          </Campo>
          <Campo label="Data de nascimento">
            <Input type="date" value={extra.data_nascimento}
              onChange={(e) => setCampo('data_nascimento', e.target.value)} />
          </Campo>
          <Campo label="Endereço">
            <Input value={extra.endereco}
              placeholder="Rua, nº, bairro, cidade/UF"
              onChange={(e) => setCampo('endereco', e.target.value)} />
          </Campo>
          <Campo label="Papel">
            <select
              value={role}
              disabled={bloqueado}
              onChange={(e) => setRole(e.target.value)}
              className={selectClass}
            >
              {rolesDisponiveis.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {bloqueado && (
              <span className="text-xs text-muted-foreground">
                {ehEu ? 'Você não pode alterar o próprio papel aqui.'
                  : 'Apenas um Owner pode alterar contas Owner.'}
              </span>
            )}
          </Campo>
          <Campo label="Função / Cargo">
            <select value={area} onChange={(e) => setArea(e.target.value)}
              className={selectClass}>
              <option value="">—</option>
              {funcoes.map((f) => <option key={f.id} value={f.valor}>{f.valor}</option>)}
            </select>
          </Campo>
          <Campo label="Período (admissão)">
            <Input type="date" value={extra.periodo}
              onChange={(e) => setCampo('periodo', e.target.value)} />
          </Campo>
          <Campo label="Contrato">
            <Input value={extra.contrato}
              placeholder="Link ou referência do contrato"
              onChange={(e) => setCampo('contrato', e.target.value)} />
          </Campo>
          <Campo label="Observação">
            <textarea
              value={extra.observacao}
              onChange={(e) => setCampo('observacao', e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </Campo>

          <Button type="submit" disabled={salvando}>
            <Save className="size-4" />
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </form>

        {/* Redefinir senha (admin) */}
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4" /> Redefinir senha
          </p>
          <p className="text-xs text-muted-foreground">
            Define uma nova senha sem precisar da atual. Repasse ao usuário.
          </p>
          <Input type="text" placeholder="Nova senha (mín. 8)"
            value={senha} onChange={(e) => setSenha(e.target.value)} />
          <Input type="text" placeholder="Confirmar nova senha"
            value={senha2} onChange={(e) => setSenha2(e.target.value)} />
          <Button type="button" variant="outline"
            disabled={salvandoSenha || !senha}
            onClick={salvarSenha}>
            {salvandoSenha ? 'Redefinindo…' : 'Redefinir senha'}
          </Button>
        </div>

        {/* Ativar / desativar */}
        {!bloqueado && (
          <Button
            type="button"
            variant={ativo ? 'destructive' : 'default'}
            disabled={trocandoStatus}
            onClick={alternarStatus}
          >
            <Power className="size-4" />
            {trocandoStatus
              ? 'Aguarde…'
              : ativo ? 'Desativar conta' : 'Reativar conta'}
          </Button>
        )}

        {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
        {ok && <p className="text-sm font-medium text-emerald-500">{ok}</p>}
      </SheetContent>
    </Sheet>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
