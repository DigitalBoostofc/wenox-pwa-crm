import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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

  // Guarda de "vivo" + token da última chamada: descarta respostas obsoletas
  // (componente desmontado) e resolve a race de refresh() concorrente fazendo
  // vencer o ÚLTIMO refresh solicitado (last-called), não o último a resolver.
  const vivo = useRef(true);
  const execAtual = useRef(0);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro('');

    const idExec = ++execAtual.current;

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
        if (!vivo.current || idExec !== execAtual.current) return;
        setTarefas(t);
        setProjetos(p);
        setClientes(c);
        setUsuarios(u);
      })
      .catch(() => {
        if (!vivo.current || idExec !== execAtual.current) return;
        setErro('Não foi possível carregar os dados.');
      })
      .finally(() => {
        if (!vivo.current || idExec !== execAtual.current) return;
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
