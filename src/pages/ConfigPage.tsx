import { Link } from 'react-router-dom';
import { ShieldCheck, Palette, SlidersHorizontal, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/useAuth';
import { canGerirUsuarios } from '@/auth/perms';
import { useTheme } from '@/components/layout/ThemeProvider';
import { TrocarSenhaCard } from '@/config/TrocarSenhaCard';

export function ConfigPage() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <span className="text-foreground">{user?.email}</span>
          <span className="capitalize text-muted-foreground">{user?.role}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4" /> Aparência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={toggle}>
            Tema: {theme === 'dark' ? 'Escuro' : 'Claro'} — alternar
          </Button>
        </CardContent>
      </Card>

      <TrocarSenhaCard />

      {canGerirUsuarios(user?.role) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" /> Administração
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/usuarios">Gerenciar usuários</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/config/parametros">
                <SlidersHorizontal /> Parâmetros (listas)
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/config/etapas-projeto">Etapas de projeto</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/config/privacidade">
                <Lock /> Privacidade &amp; Acessos
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Button variant="destructive" className="self-start" onClick={logout}>
        Sair
      </Button>
    </div>
  );
}
