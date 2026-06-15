import { useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

// Converte o erro do PocketBase numa mensagem útil. Antes mostrava sempre
// "Credenciais inválidas", o que escondia problemas de rede/timeout/bloqueio
// — fundamental para diagnosticar falhas que não são senha errada.
function mensagemErroLogin(err: unknown): string {
  const e = err as { message?: string; status?: number };
  const msg = e?.message ?? '';
  if (msg.includes('desativada')) return msg;
  switch (e?.status) {
    case 0:
      return 'Sem conexão com o servidor. Verifique sua internet ou tente outra rede (Wi-Fi/4G).';
    case 429:
      return 'Muitas tentativas seguidas. Aguarde 1 minuto e tente novamente.';
    case 400:
    case 401:
      return 'Email ou senha incorretos.';
    case 403:
      return 'Acesso bloqueado. Fale com um administrador.';
    default:
      return e?.status
        ? `Não foi possível entrar (erro ${e.status}). Tente novamente.`
        : 'Não foi possível entrar. Verifique sua conexão e tente novamente.';
  }
}

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email, senha);
    } catch (err) {
      setErro(mensagemErroLogin(err));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="grid min-h-svh place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_32px_-8px_rgba(139,92,246,0.7)]">
            <span className="text-2xl font-black">W</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Wenox OS</h1>
            <p className="text-sm text-muted-foreground">
              Central de comando da agência
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="senha" className="text-sm font-medium text-muted-foreground">
                  Senha
                </label>
                <Input
                  id="senha"
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>
              {erro && (
                <p className="text-sm font-medium text-destructive">{erro}</p>
              )}
              <Button type="submit" size="lg" disabled={carregando} className="mt-2">
                {carregando ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
