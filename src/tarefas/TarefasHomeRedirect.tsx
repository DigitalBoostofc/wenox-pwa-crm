import { useEffect, useState } from 'react';
import { Redirect } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ehCliente } from '@/auth/perms';
import { pathTarefasPadrao } from './rotaPadraoTarefas';
import { TarefasListPage } from './TarefasListPage';

/**
 * Entrada de /tarefas: redireciona para a área do usuário
 * (Design / Social / Gestão…) e só cai na lista geral se não houver área.
 */
export function TarefasHomeRedirect() {
  const { user } = useAuth();
  const [destino, setDestino] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    if (!user || ehCliente(user.role)) {
      setDestino(null);
      return;
    }
    pathTarefasPadrao(user).then((path) => {
      if (vivo) setDestino(path);
    });
    return () => { vivo = false; };
  }, [user]);

  // Cliente ou sem área: página geral.
  if (destino === null) return <TarefasListPage />;
  // Ainda resolvendo.
  if (destino === undefined) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>
    );
  }
  return <Redirect to={destino} />;
}
