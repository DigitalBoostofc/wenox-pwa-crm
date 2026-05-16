import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, History, Send } from 'lucide-react';
import {
  listAtividade, addComentario, type Entidade, type ItemAtividade,
} from '@/atividade/atividadeService';
import { dataBR } from '@/clientes/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function quando(iso: string) {
  const d = new Date(iso.replace(' ', 'T'));
  const hora = Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dataBR(iso)}${hora ? ' às ' + hora : ''}`;
}

/** Timeline de comentários + histórico (estilo card Trello/Notion). */
export function AtividadeFeed({
  entidade,
  refId,
}: {
  entidade: Entidade;
  refId: string;
}) {
  const [itens, setItens] = useState<ItemAtividade[]>([]);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setItens(await listAtividade(entidade, refId));
      setErro('');
    } catch {
      setErro('Não foi possível carregar a atividade.');
    } finally {
      setCarregando(false);
    }
  }, [entidade, refId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await addComentario(entidade, refId, texto);
      setTexto('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao comentar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-4" /> Comentários & Histórico
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={enviar} className="flex flex-col gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            placeholder="Escreva um comentário (ex: troquei a senha do Drive porque…)"
            aria-label="Novo comentário"
            className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
          <Button
            type="submit"
            size="sm"
            className="self-end"
            disabled={enviando || !texto.trim()}
          >
            <Send /> {enviando ? 'Enviando…' : 'Comentar'}
          </Button>
        </form>

        {erro && (
          <p className="text-sm font-medium text-destructive">{erro}</p>
        )}

        {carregando ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : itens.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma atividade ainda. Seja o primeiro a comentar.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {itens.map((it) => (
              <li
                key={it.id}
                className="flex gap-3 border-l-2 border-border pl-3"
              >
                <div className="mt-0.5 text-muted-foreground">
                  {it.tipo === 'comentario' ? (
                    <MessageSquare className="size-4" />
                  ) : (
                    <History className="size-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      it.tipo === 'comentario'
                        ? 'whitespace-pre-wrap text-sm'
                        : 'text-sm text-muted-foreground'
                    }
                  >
                    {it.tipo === 'comentario' ? it.texto : it.acao}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {it.autorNome} · {quando(it.created)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
