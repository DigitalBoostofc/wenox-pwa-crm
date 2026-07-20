import { useEffect, useState } from 'react';
import { Redirect } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ehCliente } from '@/auth/perms';
import { pathProjetosPadrao } from '@/lib/rotaPadraoArea';
import { ProjetosListPage } from './ProjetosListPage';

/**
 * Entrada de /projetos: redireciona para a área do usuário
 * (Design / Social / Gestão…) e só cai na lista geral se não houver área.
 */
export function ProjetosHomeRedirect() {
  const { user } = useAuth();
  const [destino, setDestino] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    if (!user || ehCliente(user.role)) {
      setDestino(null);
      return;
    }
    pathProjetosPadrao(user).then((path) => {
      if (vivo) setDestino(path);
    });
    return () => { vivo = false; };
  }, [user]);

  if (destino === null) return <ProjetosListPage />;
  if (destino === undefined) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>
    );
  }
  return <Redirect to={destino} />;
}
