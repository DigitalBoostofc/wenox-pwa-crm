import { useEffect, useState } from 'react';
import { Camera, KeyRound, Save } from 'lucide-react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/auth/useAuth';
import { atualizarUsuario, trocarMinhaSenha, fotoUrl } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { dataBR } from '@/clientes/format';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export function MeusDadosSheet({
  aberto,
  onClose,
  onSalvo,
}: {
  aberto: boolean;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const { user } = useAuth();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Campos editáveis
  const [nome, setNome] = useState('');
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [endereco, setEndereco] = useState('');
  const [foto, setFoto] = useState<File | null>(null);

  // Senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Estado de UI
  const [salvando, setSalvando] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    if (!aberto || !user?.id) return;
    setCarregando(true);
    setErro('');
    setOk('');
    setFoto(null);
    pb.collection('usuarios')
      .getOne(user.id)
      .then((rec) => {
        const u = rec as unknown as Usuario;
        setUsuario(u);
        setNome(u.nome ?? '');
        setNomeCompleto(u.nome_completo ?? '');
        setTelefone(u.telefone ?? '');
        setCpf(u.cpf ?? '');
        setCnpj(u.cnpj ?? '');
        setChavePix(u.chave_pix ?? '');
        setDataNascimento((u.data_nascimento ?? '').slice(0, 10));
        setEndereco(u.endereco ?? '');
      })
      .catch(() => setErro('Não foi possível carregar seus dados.'))
      .finally(() => setCarregando(false));
  }, [aberto, user?.id]);

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setOk('');
    if (!nome.trim()) { setErro('Informe o nome.'); return; }
    setSalvando(true);
    try {
      // SOMENTE os 8 campos editáveis — role/status/cliente ausentes propositalmente
      const patch: Partial<Omit<Usuario, 'id'>> = {
        nome: nome.trim(),
        nome_completo: nomeCompleto.trim(),
        telefone: telefone.trim(),
        cpf: cpf.trim(),
        cnpj: cnpj.trim(),
        chave_pix: chavePix.trim(),
        data_nascimento: dataNascimento.trim(),
        endereco: endereco.trim(),
      };
      const u = await atualizarUsuario(user!.id, patch, foto);
      setFoto(null);
      setUsuario(u);
      setOk('Alterações salvas.');
      onSalvo();
    } catch {
      setErro('Não foi possível salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarSenha() {
    setErro('');
    setOk('');
    if (novaSenha.length < 8) {
      setErro('A nova senha precisa de no mínimo 8 caracteres.'); return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não conferem.'); return;
    }
    setSalvandoSenha(true);
    try {
      await trocarMinhaSenha(user!.email, senhaAtual, novaSenha);
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      setOk('Senha alterada com sucesso.');
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      if (msg.includes('invalid') || msg.includes('password') || msg.includes('credentials')) {
        setErro('Senha atual incorreta.');
      } else {
        setErro('Não foi possível alterar a senha. Tente novamente.');
      }
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <Sheet open={aberto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full max-w-md overflow-y-auto sm:max-w-lg"
      >
        <SheetTitle className="pr-8 text-base">Meus dados</SheetTitle>

        {carregando ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-16 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : usuario ? (
          <>
            {/* Foto */}
            <div className="flex items-center gap-3">
              <label
                title="Trocar foto"
                className="group relative grid size-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-border bg-secondary text-muted-foreground hover:border-primary"
              >
                {foto ? (
                  <img
                    src={URL.createObjectURL(foto)}
                    alt="Prévia"
                    className="size-full object-cover"
                  />
                ) : usuario.foto ? (
                  <img
                    src={fotoUrl(usuario, '100x100')}
                    alt={usuario.nome}
                    className="size-full object-cover"
                  />
                ) : (
                  <Camera className="size-5" />
                )}
                <span className="absolute inset-0 hidden place-items-center bg-black/50 text-[10px] font-medium text-white group-hover:grid">
                  Trocar
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                />
              </label>
              <div className="min-w-0">
                <p className="truncate font-medium">{usuario.nome}</p>
                <p className="truncate text-xs text-muted-foreground">{usuario.email}</p>
              </div>
            </div>

            {/* Campos somente leitura */}
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-muted-foreground">Papel</span>
                  <span className="text-sm">{usuario.role}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-muted-foreground">Área</span>
                  <span className="text-sm">{usuario.area || '—'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-muted-foreground">Admissão</span>
                <span className="text-sm">{dataBR(usuario.periodo) || '—'}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Papel, área e admissão são alterados pela gestão.
              </p>
            </div>

            {/* Form de dados editáveis */}
            <form onSubmit={salvarDados} className="flex flex-col gap-3">
              <Campo label="Nome">
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </Campo>
              <Campo label="Nome completo">
                <Input
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                />
              </Campo>
              <Campo label="Telefone">
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="CPF">
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} />
                </Campo>
                <Campo label="CNPJ">
                  <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
                </Campo>
              </div>
              <Campo label="Chave Pix">
                <Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} />
              </Campo>
              <Campo label="Data de nascimento">
                <Input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                />
              </Campo>
              <Campo label="Endereço">
                <Input
                  value={endereco}
                  placeholder="Rua, nº, bairro, cidade/UF"
                  onChange={(e) => setEndereco(e.target.value)}
                />
              </Campo>

              <Button type="submit" disabled={salvando}>
                <Save className="size-4" />
                {salvando ? 'Salvando…' : 'Salvar alterações'}
              </Button>
            </form>

            {/* Trocar senha */}
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="size-4" /> Trocar minha senha
              </p>
              <Input
                type="password"
                placeholder="Senha atual"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Nova senha (mín. 8)"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Confirmar nova senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={salvandoSenha || !senhaAtual || !novaSenha}
                onClick={salvarSenha}
              >
                {salvandoSenha ? 'Alterando…' : 'Alterar senha'}
              </Button>
            </div>

            {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
            {ok && <p className="text-sm font-medium text-emerald-500">{ok}</p>}
          </>
        ) : (
          !carregando && (
            <p className="text-sm text-muted-foreground">
              {erro || 'Não foi possível carregar seus dados.'}
            </p>
          )
        )}
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
