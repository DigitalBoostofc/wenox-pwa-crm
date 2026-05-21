import { useEffect, useState } from 'react';
import { KeyRound, Check, Copy } from 'lucide-react';
import {
  getAcessoCliente, criarAcessoCliente, resetarSenhaAcesso,
} from './acessoClienteService';
import type { Usuario } from '@/usuarios/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet, SheetTrigger, SheetContent, SheetTitle,
} from '@/components/ui/sheet';

/** Gera uma senha inicial aleatória de 10 caracteres. */
function gerarSenha(): string {
  const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => cs[Math.floor(Math.random() * cs.length)]).join('');
}

export function CriarAcessoCliente({
  clienteId, clienteNome, emailSugerido,
}: {
  clienteId: string;
  clienteNome: string;
  emailSugerido?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [acesso, setAcesso] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState(clienteNome);
  const [email, setEmail] = useState(emailSugerido ?? '');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [criado, setCriado] = useState<{ email: string; senha: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setCarregando(true);
    setCriado(null);
    setErro('');
    getAcessoCliente(clienteId)
      .then(setAcesso)
      .finally(() => setCarregando(false));
  }, [aberto, clienteId]);

  async function criar() {
    setErro('');
    if (!nome.trim()) { setErro('Informe o nome'); return; }
    if (!email.trim()) { setErro('Informe o e-mail'); return; }
    if (senha.length < 8) { setErro('A senha precisa ter ao menos 8 caracteres'); return; }
    setSalvando(true);
    try {
      await criarAcessoCliente(clienteId, { nome, email, senha });
      setCriado({ email, senha });
      setAcesso(await getAcessoCliente(clienteId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro';
      setErro(`Não foi possível criar o acesso: ${msg}`);
    } finally {
      setSalvando(false);
    }
  }

  async function resetar() {
    if (!acesso) return;
    const nova = gerarSenha();
    setSalvando(true);
    setErro('');
    try {
      await resetarSenhaAcesso(acesso.id, nova);
      setCriado({ email: acesso.email, senha: nova });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro';
      setErro(`Não foi possível redefinir: ${msg}`);
    } finally {
      setSalvando(false);
    }
  }

  async function copiar() {
    if (!criado) return;
    const txt = `Acesso Wenox OS\nLink: https://app.wenox.com.br\nE-mail: ${criado.email}\nSenha: ${criado.senha}`;
    try {
      await navigator.clipboard.writeText(txt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* */ }
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <KeyRound /> Acesso do cliente
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetTitle>Acesso do cliente</SheetTitle>

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : criado ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                <Check className="size-4" /> Pronto — repasse ao cliente
              </p>
              <p className="text-xs text-muted-foreground">
                A senha não fica visível depois. Copie agora.
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-sm">
              <span><span className="text-muted-foreground">Link:</span> app.wenox.com.br</span>
              <span><span className="text-muted-foreground">E-mail:</span> <span className="font-mono">{criado.email}</span></span>
              <span><span className="text-muted-foreground">Senha:</span> <span className="font-mono font-medium">{criado.senha}</span></span>
            </div>
            <Button onClick={copiar} variant="outline" size="sm">
              {copiado ? <><Check /> Copiado!</> : <><Copy /> Copiar credenciais</>}
            </Button>
          </div>
        ) : acesso ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-card p-3 text-sm">
              <p className="font-medium">Acesso já criado</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {acesso.nome} · {acesso.email}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Esqueceu a senha? Gere uma nova pra repassar.
            </p>
            <Button onClick={resetar} variant="outline" size="sm" disabled={salvando}>
              {salvando ? 'Gerando…' : 'Redefinir senha'}
            </Button>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Cria o login para o cliente acompanhar projetos, tarefas e
              documentos da empresa dele.
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ac-nome" className="text-xs font-medium text-muted-foreground">Nome</label>
              <Input id="ac-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ac-email" className="text-xs font-medium text-muted-foreground">E-mail (login)</label>
              <Input id="ac-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ac-senha" className="text-xs font-medium text-muted-foreground">Senha inicial</label>
              <div className="flex gap-2">
                <Input id="ac-senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
                <Button type="button" variant="outline" size="sm" onClick={() => setSenha(gerarSenha())}>
                  Gerar
                </Button>
              </div>
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button onClick={criar} disabled={salvando}>
              {salvando ? 'Criando…' : 'Criar acesso'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
