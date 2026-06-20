import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Link2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Cliente } from '@/clientes/types';
import {
  clonarQuadroTemplate,
  sugerirVinculos,
  vincularQuadro,
} from './quadrosService';
import type { AmbiguidadeVinculo, SugestaoVinculo } from './quadrosService';
import type { Quadro } from './types';

function nomeCliente(c: Pick<Cliente, 'id' | 'nome' | 'nome_fantasia'>): string {
  return c.nome_fantasia?.trim() || c.nome?.trim() || c.id;
}

const selectCls =
  'h-9 min-w-40 flex-1 rounded-md border border-input bg-background px-2 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50';

export function VinculosQuadrosPage() {
  const [carregando, setCarregando] = useState(true);
  const [carregou, setCarregou] = useState(false);
  const [erroGlobal, setErroGlobal] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const [sugestoes, setSugestoes] = useState<SugestaoVinculo[]>([]);
  const [ambiguidades, setAmbiguidades] = useState<AmbiguidadeVinculo[]>([]);
  const [quadrosSemCliente, setQuadrosSemCliente] = useState<Quadro[]>([]);
  const [clientesSemQuadro, setClientesSemQuadro] = useState<Cliente[]>([]);
  const [todosClientes, setTodosClientes] = useState<Cliente[]>([]);

  const [emProgresso, setEmProgresso] = useState<Set<string>>(new Set());
  const [vinculandoTodos, setVinculandoTodos] = useState(false);
  const [errosLinhas, setErrosLinhas] = useState<Record<string, string>>({});
  const [selecoes, setSelecoes] = useState<Record<string, string>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroGlobal('');
    setErrosLinhas({});
    try {
      const res = await sugerirVinculos();
      setSugestoes(res.sugestoes);
      setAmbiguidades(res.ambiguidades);
      setQuadrosSemCliente(res.quadrosSemCliente);
      setClientesSemQuadro(res.clientesSemQuadro);
      setTodosClientes(res.todosClientes);
      setSelecoes({});
      setCarregou(true);
    } catch (e) {
      setErroGlobal(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  function addProg(id: string) {
    setEmProgresso((p) => new Set([...p, id]));
  }
  function remProg(id: string) {
    setEmProgresso((p) => { const n = new Set(p); n.delete(id); return n; });
  }
  function setErroLinha(id: string, msg: string) {
    setErrosLinhas((p) => ({ ...p, [id]: msg }));
  }
  function clearErroLinha(id: string) {
    setErrosLinhas((p) => { const n = { ...p }; delete n[id]; return n; });
  }

  async function acaoVincular(quadroId: string, clienteId: string, label: string) {
    setOkMsg('');
    clearErroLinha(quadroId);
    addProg(quadroId);
    try {
      await vincularQuadro(quadroId, clienteId);
      await carregar();
      setOkMsg(`Vinculado: ${label}`);
    } catch (e) {
      setErroLinha(quadroId, e instanceof Error ? e.message : 'Falha ao vincular.');
    } finally {
      remProg(quadroId);
    }
  }

  async function acaoVincularTodos() {
    setOkMsg('');
    setVinculandoTodos(true);
    let n = 0;
    for (const s of sugestoes) {
      clearErroLinha(s.quadro.id);
      try {
        await vincularQuadro(s.quadro.id, s.cliente.id);
        n++;
      } catch (e) {
        setErroLinha(s.quadro.id, e instanceof Error ? e.message : 'Falha ao vincular.');
      }
    }
    await carregar();
    setVinculandoTodos(false);
    if (n > 0) setOkMsg(`${n} vínculo${n !== 1 ? 's' : ''} criado${n !== 1 ? 's' : ''}.`);
  }

  async function acaoGerarQuadro(c: Cliente) {
    setOkMsg('');
    clearErroLinha(c.id);
    addProg(c.id);
    try {
      await clonarQuadroTemplate(c.id, nomeCliente(c));
      await carregar();
      setOkMsg(`Quadro criado para ${nomeCliente(c)}.`);
    } catch (e) {
      setErroLinha(c.id, e instanceof Error ? e.message : 'Falha ao gerar quadro.');
    } finally {
      remProg(c.id);
    }
  }

  const sugeridosIds = new Set([
    ...sugestoes.map((s) => s.quadro.id),
    ...ambiguidades.map((a) => a.quadro.id),
  ]);
  const quadrosManuais = quadrosSemCliente.filter((q) => !sugeridosIds.has(q.id));

  const temAlgo =
    sugestoes.length > 0 ||
    ambiguidades.length > 0 ||
    clientesSemQuadro.length > 0 ||
    quadrosManuais.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar para Configurações">
          <Link to="/config"><ArrowLeft /></Link>
        </Button>
        <h2 className="text-lg font-semibold">Saúde dos vínculos</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Recarregar dados"
          onClick={() => { setOkMsg(''); void carregar(); }}
          disabled={carregando}
          className="ml-auto"
        >
          <RefreshCw className={carregando ? 'animate-spin' : ''} />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Reconcilie quadros e clientes: vincule quadros órfãos, gere quadros para clientes sem
        vínculo e resolva ambiguidades de nome.
      </p>

      {/* Sucesso */}
      {okMsg && (
        <p role="status" aria-live="polite" className="text-sm font-medium text-emerald-500">
          {okMsg}
        </p>
      )}

      {/* Carregando — só exibe na primeira carga; nos recarregamentos o ícone de refresh já gira */}
      {carregando && !carregou && (
        <p className="py-10 text-center text-sm text-muted-foreground" aria-busy="true">
          Carregando…
        </p>
      )}

      {/* Erro global */}
      {!carregando && erroGlobal && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p>{erroGlobal}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => { setOkMsg(''); void carregar(); }}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Tudo certo */}
      {carregou && !erroGlobal && !temAlgo && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700 dark:text-emerald-400"
        >
          <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
          Tudo certo! Nenhum problema de vínculo encontrado.
        </div>
      )}

      {carregou && !erroGlobal && temAlgo && (
        <>
          {/* Bloco 1 — Vínculos sugeridos */}
          {(sugestoes.length > 0 || ambiguidades.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link2 className="size-4" aria-hidden="true" />
                  Vínculos sugeridos ({sugestoes.length + ambiguidades.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {sugestoes.map((s) => {
                  const prog = emProgresso.has(s.quadro.id);
                  return (
                    <div
                      key={s.quadro.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {s.quadro.nome}
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground" aria-hidden="true">→</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{nomeCliente(s.cliente)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={prog || vinculandoTodos}
                        aria-label={`Vincular ${s.quadro.nome} a ${nomeCliente(s.cliente)}`}
                        onClick={() =>
                          void acaoVincular(
                            s.quadro.id,
                            s.cliente.id,
                            `${s.quadro.nome} → ${nomeCliente(s.cliente)}`,
                          )
                        }
                      >
                        {prog ? 'Vinculando…' : 'Vincular'}
                      </Button>
                      {errosLinhas[s.quadro.id] && (
                        <span role="alert" className="w-full text-xs text-destructive">
                          {errosLinhas[s.quadro.id]}
                        </span>
                      )}
                    </div>
                  );
                })}

                {ambiguidades.map((a) => (
                  <div
                    key={a.quadro.id}
                    className="rounded-md border border-amber-400/50 bg-amber-50/50 p-3 dark:bg-amber-950/20"
                  >
                    <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                      <AlertTriangle
                        className="size-4 shrink-0 text-amber-500"
                        aria-hidden="true"
                      />
                      <span>{a.quadro.nome}</span>
                      <span className="font-normal text-muted-foreground">
                        — múltiplos candidatos
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1 pl-6">
                      {a.candidatos.map((c) => {
                        const prog = emProgresso.has(a.quadro.id);
                        return (
                          <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="min-w-0 flex-1 truncate">{nomeCliente(c)}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={prog || vinculandoTodos}
                              aria-label={`Vincular ${a.quadro.nome} a ${nomeCliente(c)}`}
                              onClick={() =>
                                void acaoVincular(
                                  a.quadro.id,
                                  c.id,
                                  `${a.quadro.nome} → ${nomeCliente(c)}`,
                                )
                              }
                            >
                              {prog ? 'Vinculando…' : 'Vincular'}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                    {errosLinhas[a.quadro.id] && (
                      <span role="alert" className="mt-1 block pl-6 text-xs text-destructive">
                        {errosLinhas[a.quadro.id]}
                      </span>
                    )}
                  </div>
                ))}

                {sugestoes.length > 1 && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      disabled={
                        vinculandoTodos ||
                        sugestoes.some((s) => emProgresso.has(s.quadro.id))
                      }
                      onClick={() => void acaoVincularTodos()}
                    >
                      {vinculandoTodos
                        ? 'Vinculando…'
                        : `Vincular todos (${sugestoes.length})`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bloco 2 — Clientes sem quadro */}
          {clientesSemQuadro.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Clientes sem quadro ({clientesSemQuadro.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {clientesSemQuadro.map((c) => {
                  const prog = emProgresso.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {nomeCliente(c)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={prog}
                        aria-label={`Gerar quadro para ${nomeCliente(c)}`}
                        onClick={() => void acaoGerarQuadro(c)}
                      >
                        {prog ? 'Gerando…' : 'Gerar quadro'}
                      </Button>
                      {errosLinhas[c.id] && (
                        <span role="alert" className="w-full text-xs text-destructive">
                          {errosLinhas[c.id]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Bloco 3 — Quadros sem cliente (vinculação manual) */}
          {quadrosManuais.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Quadros sem cliente ({quadrosManuais.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {quadrosManuais.map((q) => {
                  const prog = emProgresso.has(q.id);
                  const sel = selecoes[q.id] ?? '';
                  const clienteSel = todosClientes.find((c) => c.id === sel);
                  return (
                    <div
                      key={q.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3"
                    >
                      <span className="w-full truncate text-sm font-medium sm:w-auto sm:flex-1">
                        {q.nome}
                      </span>
                      <label htmlFor={`sel-${q.id}`} className="sr-only">
                        Selecionar cliente para vincular ao quadro {q.nome}
                      </label>
                      <select
                        id={`sel-${q.id}`}
                        value={sel}
                        onChange={(e) =>
                          setSelecoes((p) => ({ ...p, [q.id]: e.target.value }))
                        }
                        disabled={prog}
                        className={selectCls}
                      >
                        <option value="">Selecionar cliente…</option>
                        {todosClientes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {nomeCliente(c)}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={!sel || prog}
                        aria-label={
                          clienteSel
                            ? `Vincular quadro ${q.nome} a ${nomeCliente(clienteSel)}`
                            : `Vincular quadro ${q.nome}`
                        }
                        onClick={() => {
                          if (!sel || !clienteSel) return;
                          void acaoVincular(
                            q.id,
                            sel,
                            `${q.nome} → ${nomeCliente(clienteSel)}`,
                          );
                        }}
                      >
                        {prog ? 'Vinculando…' : 'Vincular'}
                      </Button>
                      {errosLinhas[q.id] && (
                        <span role="alert" className="w-full text-xs text-destructive">
                          {errosLinhas[q.id]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
