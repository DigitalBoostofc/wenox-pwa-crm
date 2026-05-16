import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Check, X } from 'lucide-react';
import {
  listOpcoes, criarOpcao, editarOpcao, reordenarOpcao, removerOpcao,
} from '@/opcoes/opcoesService';
import { TIPOS_OPCAO, ROTULO_TIPO } from '@/opcoes/types';
import type { Opcao, TipoOpcao } from '@/opcoes/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Secao({ tipo }: { tipo: TipoOpcao }) {
  const [itens, setItens] = useState<Opcao[]>([]);
  const [novo, setNovo] = useState('');
  const [erro, setErro] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  const carregar = useCallback(async () => {
    setItens(await listOpcoes(tipo));
  }, [tipo]);

  useEffect(() => { carregar(); }, [carregar]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      await criarOpcao(tipo, novo);
      setNovo('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao adicionar');
    }
  }

  async function salvarEdicao(id: string) {
    setErro('');
    try {
      await editarOpcao(id, editVal);
      setEditId(null);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  async function remover(op: Opcao) {
    setErro('');
    try {
      await removerOpcao(op);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao remover');
    }
  }

  async function mover(idx: number, dir: -1 | 1) {
    const alvo = itens[idx + dir];
    const atual = itens[idx];
    if (!alvo) return;
    await reordenarOpcao(atual.id, alvo.ordem);
    await reordenarOpcao(alvo.id, atual.ordem);
    await carregar();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ROTULO_TIPO[tipo]}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="divide-y divide-border rounded-lg border border-border">
          {itens.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma opção. Adicione abaixo.
            </p>
          )}
          {itens.map((op, idx) => (
            <div key={op.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="flex flex-col">
                <button
                  aria-label="Subir"
                  disabled={idx === 0}
                  onClick={() => mover(idx, -1)}
                  className="text-muted-foreground disabled:opacity-30 hover:text-foreground"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  aria-label="Descer"
                  disabled={idx === itens.length - 1}
                  onClick={() => mover(idx, 1)}
                  className="text-muted-foreground disabled:opacity-30 hover:text-foreground"
                >
                  <ChevronDown className="size-4" />
                </button>
              </div>
              {editId === op.id ? (
                <>
                  <Input
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    className="h-8 flex-1"
                    aria-label={`Editar ${op.valor}`}
                  />
                  <Button size="icon" variant="ghost" aria-label="Confirmar"
                    onClick={() => salvarEdicao(op.id)}>
                    <Check />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Cancelar"
                    onClick={() => setEditId(null)}>
                    <X />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    className="flex-1 text-left text-sm"
                    onClick={() => { setEditId(op.id); setEditVal(op.valor); }}
                  >
                    {op.valor}
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    aria-label={`Remover ${op.valor}`}
                    onClick={() => remover(op)}
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
        {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
        <form onSubmit={adicionar} className="flex gap-2">
          <Input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder={`Nova opção de ${ROTULO_TIPO[tipo].toLowerCase()}`}
            aria-label={`Nova opção de ${ROTULO_TIPO[tipo]}`}
          />
          <Button type="submit"><Plus /> Adicionar</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ParametrosPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar">
          <Link to="/config"><ArrowLeft /></Link>
        </Button>
        <h2 className="text-lg font-semibold">Parâmetros</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Listas usadas no cadastro de clientes. Opções em uso não podem ser
        removidas.
      </p>
      {TIPOS_OPCAO.map((t) => (
        <Secao key={t} tipo={t} />
      ))}
    </div>
  );
}
