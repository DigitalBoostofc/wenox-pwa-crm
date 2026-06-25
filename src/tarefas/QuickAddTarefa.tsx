import { useState, useRef } from 'react';
import { criarTarefa } from './tarefasService';
import { statusInicial } from './status';
import { useAuth } from '@/auth/useAuth';

export function QuickAddTarefa({
  onCriada,
  presetProjeto,
  presetCliente,
  area,
}: {
  /** Recebe o id da tarefa recém-criada (para abrir o painel dela). */
  onCriada: (id: string) => void;
  presetProjeto?: string;
  presetCliente?: string;
  /** Área da página (dimensão da tarefa). Quando definida, nasce gravada (F-006). */
  area?: string;
}) {
  const { user } = useAuth();
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const nome = valor.trim();
    if (!nome) return;

    setSalvando(true);
    setErro('');
    try {
      const d = new Date();
      const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const nova = await criarTarefa({
        nome,
        status: statusInicial(),
        tipo: area ?? '',
        prazo: hoje,
        lado: 'wenox',
        responsaveis: user?.id ? [user.id] : [],
        cliente: presetCliente ?? '',
        projeto: presetProjeto ?? '',
        contato: '',
        descricao: '',
        etiquetas: [],
        ordem: 0,
      });
      setValor('');
      onCriada(nova.id);
    } catch {
      setErro('Não foi possível criar a tarefa. Tente novamente.');
    } finally {
      setSalvando(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="text"
        placeholder="+ Adicionar tarefa (Enter para criar)"
        aria-label="Adicionar tarefa rápida"
        value={valor}
        onChange={(e) => { setValor(e.target.value); setErro(''); }}
        onKeyDown={handleKeyDown}
        disabled={salvando}
        className="h-9 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
      />
      {erro && (
        <p className="text-xs text-destructive">{erro}</p>
      )}
    </div>
  );
}
