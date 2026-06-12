import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trocarMinhaSenha } from '@/usuarios/usuariosService';
import { useAuth } from '@/auth/useAuth';

export function TrocarSenhaCard() {
  const { user } = useAuth();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setOk(false);
    if (nova.length < 8) {
      setErro('A nova senha precisa de no mínimo 8 caracteres.'); return;
    }
    if (nova !== confirma) {
      setErro('A confirmação não confere com a nova senha.'); return;
    }
    if (!user?.email) { setErro('Sessão inválida. Entre novamente.'); return; }
    setSalvando(true);
    try {
      await trocarMinhaSenha(user.email, atual, nova);
      setAtual(''); setNova(''); setConfirma('');
      setOk(true);
      setTimeout(() => setOk(false), 3000);
    } catch {
      setErro('Não foi possível trocar. Confira se a senha atual está correta.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> Trocar minha senha
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={salvar} className="flex max-w-sm flex-col gap-3">
          <Input type="password" autoComplete="current-password"
            placeholder="Senha atual"
            value={atual} onChange={(e) => setAtual(e.target.value)} />
          <Input type="password" autoComplete="new-password"
            placeholder="Nova senha (mín. 8)"
            value={nova} onChange={(e) => setNova(e.target.value)} />
          <Input type="password" autoComplete="new-password"
            placeholder="Confirmar nova senha"
            value={confirma} onChange={(e) => setConfirma(e.target.value)} />
          {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
          <Button type="submit" variant="outline" disabled={salvando}
            className="self-start">
            {salvando ? 'Salvando…' : ok ? 'Senha trocada!' : 'Trocar senha'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
