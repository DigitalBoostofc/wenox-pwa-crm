import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Tarefa } from '@/tarefas/types';
import type { Projeto } from '@/projetos/types';
import type { Cliente } from '@/clientes/types';
import type { Usuario } from '@/usuarios/types';
import { listTarefas } from '@/tarefas/tarefasService';
import { listProjetos } from '@/projetos/projetosService';
import { listClientes } from '@/clientes/clientesService';
import { listUsuarios } from '@/usuarios/usuariosService';

export interface DadosAgencia {
  tarefas: Tarefa[];
  projetos: Projeto[];
  clientes: Cliente[];
  usuarios: Usuario[];
  carregando: boolean;
  erro: string;
  refresh: () => void;
}

const Ctx = createContext<DadosAgencia | null>(null);

export function DadosAgenciaProvider(props: {
  children: ReactNode;
  comClientes?: boolean;
  comUsuarios?: boolean;
}) {
  const { children, comClientes = false, comUsuarios = false } = props;

  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro('');

    const promises: [
      Promise<Tarefa[]>,
      Promise<Projeto[]>,
      Promise<Cliente[]>,
      Promise<Usuario[]>,
    ] = [
      listTarefas({}),
      listProjetos({}),
      comClientes ? listClientes('') : Promise.resolve([]),
      comUsuarios ? listUsuarios() : Promise.resolve([]),
    ];

    Promise.all(promises)
      .then(([t, p, c, u]) => {
        setTarefas(t);
        setProjetos(p);
        setClientes(c);
        setUsuarios(u);
      })
      .catch(() => {
        setErro('Não foi possível carregar os dados.');
      })
      .finally(() => {
        setCarregando(false);
      });
  }, [comClientes, comUsuarios]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Ctx.Provider
      value={{ tarefas, projetos, clientes, usuarios, carregando, erro, refresh: carregar }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDadosAgencia(): DadosAgencia {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useDadosAgencia deve ser usado dentro de <DadosAgenciaProvider>');
  }
  return ctx;
}
