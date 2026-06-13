import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save, AlertTriangle, GripVertical,
} from 'lucide-react';
import {
  type StatusDef, type CorStatus, type PapelStatus,
  CORES_STATUS, ROTULO_COR, ROTULO_PAPEL, PAPEIS_STATUS,
  DEFAULT_STATUS, novoStatusId,
  getStatuses, carregarStatusRemoto, salvarStatusRemoto,
  contarTarefasComStatus, migrarStatusTarefas,
} from '@/tarefas/status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const selectCls =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

export function StatusTarefaPage() {
  const [defs, setDefs] = useState<StatusDef[]>([]);
  const [original, setOriginal] = useState<StatusDef[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    let vivo = true;
    carregarStatusRemoto().then(() => {
      if (!vivo) return;
      const atual = getStatuses().map((s) => ({ ...s }));
      setDefs(atual);
      setOriginal(atual.map((s) => ({ ...s })));
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, []);

  function patch(id: string, campo: Partial<StatusDef>) {
    setOk('');
    setDefs((lst) => lst.map((s) => (s.id === id ? { ...s, ...campo } : s)));
  }

  /** Cada papel automático fica em 1 status só: ao atribuir, limpa dos demais. */
  function setPapel(id: string, papel: PapelStatus) {
    setOk('');
    setDefs((lst) =>
      lst.map((s) => {
        if (s.id === id) return { ...s, papel };
        if (papel && s.papel === papel) return { ...s, papel: '' as PapelStatus };
        return s;
      }),
    );
  }

  function mover(idx: number, dir: -1 | 1) {
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= defs.length) return;
    setOk('');
    setDefs((lst) => {
      const novo = [...lst];
      [novo[idx], novo[alvo]] = [novo[alvo], novo[idx]];
      return novo;
    });
  }

  function adicionar() {
    setOk('');
    setDefs((lst) => [...lst, { id: novoStatusId(), nome: '', papel: '', cor: 'cinza' }]);
  }

  async function remover(s: StatusDef) {
    setErro('');
    setOk('');
    const eraOriginal = original.some((o) => o.id === s.id);
    if (eraOriginal) {
      try {
        const uso = await contarTarefasComStatus(s.nome);
        if (uso > 0) {
          setErro(`Não dá pra remover "${s.nome}": ${uso} tarefa(s) ainda usam esse status. Renomeie ou mova essas tarefas antes.`);
          return;
        }
      } catch {
        setErro('Não foi possível verificar o uso desse status. Tente de novo.');
        return;
      }
    }
    setDefs((lst) => lst.filter((x) => x.id !== s.id));
  }

  function restaurarPadrao() {
    setOk('');
    setErro('');
    setDefs(DEFAULT_STATUS.map((s) => ({ ...s })));
  }

  async function salvar() {
    setErro('');
    setOk('');
    const limpos = defs.map((s) => ({ ...s, nome: s.nome.trim() }));
    if (limpos.length === 0) { setErro('Tenha pelo menos um status.'); return; }
    if (limpos.some((s) => !s.nome)) { setErro('Todo status precisa de um nome.'); return; }
    const nomes = limpos.map((s) => s.nome.toLowerCase());
    if (new Set(nomes).size !== nomes.length) { setErro('Há nomes de status repetidos.'); return; }

    // Renomeações: ids presentes no original com nome diferente → migrar tarefas.
    const renomeados = limpos.filter((s) => {
      const o = original.find((x) => x.id === s.id);
      return o && o.nome !== s.nome;
    });

    setSalvando(true);
    try {
      let migradas = 0;
      for (const s of renomeados) {
        const o = original.find((x) => x.id === s.id)!;
        migradas += await migrarStatusTarefas(o.nome, s.nome);
      }
      await salvarStatusRemoto(limpos);
      setDefs(limpos);
      setOriginal(limpos.map((s) => ({ ...s })));
      setOk(
        migradas > 0
          ? `Status salvos. ${migradas} tarefa(s) atualizada(s) com os novos nomes.`
          : 'Status salvos.',
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const papeisAtribuidos = new Set(defs.map((s) => s.papel).filter(Boolean));
  const semInicial = !papeisAtribuidos.has('inicial');
  const semConcluido = !papeisAtribuidos.has('concluido');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar">
          <Link to="/config"><ArrowLeft /></Link>
        </Button>
        <h2 className="text-lg font-semibold">Status das tarefas</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Crie, renomeie, reordene e dê cor aos status. A <strong>ordem</strong> aqui é a
        ordem das colunas do quadro (kanban). O <strong>papel automático</strong> diz
        quando o sistema aplica o status sozinho (ao criar a tarefa, ao concluir etapas,
        quando o cliente aprova/revisa). Deixe em <em>“Manual”</em> para status que você
        controla na mão.
      </p>

      {carregando ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Lista de status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* Cabeçalho (desktop) */}
            <div className="hidden grid-cols-[auto_1fr_8rem_15rem_auto] items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
              <span className="w-9" />
              <span>Nome</span>
              <span>Cor</span>
              <span>Papel automático</span>
              <span className="w-9" />
            </div>

            <div className="flex flex-col gap-2">
              {defs.map((s, idx) => (
                <div
                  key={s.id}
                  className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border p-2 md:grid-cols-[auto_1fr_8rem_15rem_auto]"
                >
                  <div className="flex items-center gap-1">
                    <GripVertical className="hidden size-4 text-muted-foreground/40 md:block" />
                    <div className="flex flex-col">
                      <button
                        aria-label="Subir" disabled={idx === 0}
                        onClick={() => mover(idx, -1)}
                        className="text-muted-foreground disabled:opacity-30 hover:text-foreground"
                      >
                        <ChevronUp className="size-4" />
                      </button>
                      <button
                        aria-label="Descer" disabled={idx === defs.length - 1}
                        onClick={() => mover(idx, 1)}
                        className="text-muted-foreground disabled:opacity-30 hover:text-foreground"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn('inline-block size-3 shrink-0 rounded-full border', CORES_STATUS[s.cor])} />
                    <Input
                      value={s.nome}
                      onChange={(e) => patch(s.id, { nome: e.target.value })}
                      placeholder="Nome do status"
                      className="h-9"
                      aria-label="Nome do status"
                    />
                  </div>

                  <select
                    value={s.cor}
                    onChange={(e) => patch(s.id, { cor: e.target.value as CorStatus })}
                    className={selectCls}
                    aria-label="Cor"
                  >
                    {(Object.keys(ROTULO_COR) as CorStatus[]).map((c) => (
                      <option key={c} value={c}>{ROTULO_COR[c]}</option>
                    ))}
                  </select>

                  <select
                    value={s.papel}
                    onChange={(e) => setPapel(s.id, e.target.value as PapelStatus)}
                    className={selectCls}
                    aria-label="Papel automático"
                  >
                    {PAPEIS_STATUS.map((p) => (
                      <option key={p || 'manual'} value={p}>{ROTULO_PAPEL[p]}</option>
                    ))}
                  </select>

                  <Button
                    size="icon" variant="ghost" className="justify-self-end text-destructive"
                    aria-label={`Remover ${s.nome || 'status'}`}
                    onClick={() => remover(s)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>

            <div>
              <Button variant="outline" onClick={adicionar}>
                <Plus /> Adicionar status
              </Button>
            </div>

            {(semInicial || semConcluido) && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  {semInicial && 'Nenhum status com papel “Inicial” — tarefas novas usarão o 1º da lista. '}
                  {semConcluido && 'Nenhum status com papel “Concluído” — a conclusão de tarefas/etapas pode não ser reconhecida.'}
                </span>
              </div>
            )}

            {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
            {ok && <p className="text-sm font-medium text-emerald-500">{ok}</p>}

            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <Button variant="ghost" onClick={restaurarPadrao}>Restaurar padrão</Button>
              <Button onClick={salvar} disabled={salvando}>
                <Save /> {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
