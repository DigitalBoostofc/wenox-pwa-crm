import { useEffect, useState } from 'react';
import { listUsuarios, criarUsuario } from '@/usuarios/usuariosService';
import { ROLES } from '@/usuarios/types';
import type { Usuario } from '@/usuarios/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [novo, setNovo] = useState({ nome: '', email: '', role: 'Membro' });
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const carregar = async () => setUsuarios(await listUsuarios());
  useEffect(() => {
    carregar();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      await criarUsuario(
        {
          nome: novo.nome,
          email: novo.email,
          role: novo.role as Usuario['role'],
          status: 'Ativo',
        },
        senha,
      );
      setNovo({ nome: '', email: '', role: 'Membro' });
      setSenha('');
      await carregar();
    } catch (err) {
      setErro(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Erro ao criar usuário',
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Novo usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="flex flex-col gap-4">
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
              <label htmlFor="up" className="text-sm font-medium text-muted-foreground">
                Senha inicial
              </label>
              <Input
                id="up"
                type="text"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            {erro && (
              <p className="text-sm font-medium text-destructive">{erro}</p>
            )}
            <Button type="submit">Adicionar usuário</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="divide-y divide-border">
        {usuarios.map((u) => (
          <div key={u.id} className="flex items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{u.nome}</p>
              <p className="text-sm text-muted-foreground">{u.email}</p>
            </div>
            <Badge variant={u.status === 'Ativo' ? 'success' : 'muted'}>
              {u.role}
            </Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
