import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save,
} from 'lucide-react';
import {
  type CorStatus, type StatusGrupo, type StatusOpcao, type StatusGlobalConfig,
  CORES_STATUS, ROTULO_COR, DEFAULT_STATUS_GLOBAL,
  novoStatusId, getStatusGlobal,
  carregarStatusRemoto, salvarStatusRemoto,
  contarTarefasComOpcao, contarCardsComOpcao,
} from '@/tarefas/status';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const selectCls =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

/** Membros internos ativos elegíveis como responsável de status. */
function membrosElegiveis(lista: Usuario[]): Usuario[] {
  return lista
    .filter((u) => u.role !== 'Cliente' && u.status !== 'Inativo')
    .sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, 'pt-BR'));
}

function rotuloUsuario(u: Usuario): string {
  return (u.nome || u.email || u.id).trim();
}

export function StatusTarefaPage() {
  const [grupos, setGrupos] = useState<StatusGrupo[]>([]);
  const [opcoes, setOpcoes] = useState<StatusOpcao[]>([]);
  const [originalIds, setOriginalIds] = useState<Set<string>>(new Set());
  const [membros, setMembros] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    let vivo = true;
    Promise.all([
      carregarStatusRemoto(),
      listUsuarios().catch(() => [] as Usuario[]),
    ]).then(([, users]) => {
      if (!vivo) return;
      const cfg = getStatusGlobal();
      setGrupos([...cfg.grupos].sort((a, b) => a.ordem - b.ordem));
      setOpcoes(cfg.opcoes.map((o) => ({ ...o })));
      setOriginalIds(new Set(cfg.opcoes.map((o) => o.id)));
      setMembros(membrosElegiveis(users));
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, []);

  function clearMsg() { setOk(''); setErro(''); }

  // ---- Grupos ----

  function patchGrupo(id: string, campo: Partial<StatusGrupo>) {
    clearMsg();
    setGrupos((lst) => lst.map((g) => (g.id === id ? { ...g, ...campo } : g)));
  }

  function moverGrupo(id: string, dir: -1 | 1) {
    clearMsg();
    setGrupos((lst) => {
      const idx = lst.findIndex((g) => g.id === id);
      const alvo = idx + dir;
      if (alvo < 0 || alvo >= lst.length) return lst;
      const novo = [...lst];
      [novo[idx], novo[alvo]] = [novo[alvo], novo[idx]];
      return novo.map((g, i) => ({ ...g, ordem: i }));
    });
  }

  function addGrupo() {
    clearMsg();
    const id = novoStatusId('g');
    setGrupos((lst) => [...lst, { id, nome: '', cor: 'cinza', ordem: lst.length }]);
  }

  function removerGrupo(id: string) {
    clearMsg();
    if (opcoes.some((o) => o.grupo === id)) {
      setErro('Remova todas as opções deste grupo antes de excluí-lo.');
      return;
    }
    setGrupos((lst) => lst.filter((g) => g.id !== id).map((g, i) => ({ ...g, ordem: i })));
  }

  // ---- Opções ----

  function patchOpcao(id: string, campo: Partial<StatusOpcao>) {
    clearMsg();
    setOpcoes((lst) => lst.map((o) => (o.id === id ? { ...o, ...campo } : o)));
  }

  function setResponsavelOpcao(id: string, userId: string) {
    clearMsg();
    setOpcoes((lst) => lst.map((o) => {
      if (o.id !== id) return o;
      if (!userId) {
        const { responsavel: _r, ...rest } = o;
        void _r;
        return rest;
      }
      return { ...o, responsavel: userId };
    }));
  }

  function opcoesDoGrupoLocal(grupoId: string): StatusOpcao[] {
    return opcoes.filter((o) => o.grupo === grupoId).sort((a, b) => a.ordem - b.ordem);
  }

  function moverOpcao(id: string, dir: -1 | 1) {
    clearMsg();
    setOpcoes((lst) => {
      const opcao = lst.find((o) => o.id === id);
      if (!opcao) return lst;
      const doGrupo = lst
        .filter((o) => o.grupo === opcao.grupo)
        .sort((a, b) => a.ordem - b.ordem);
      const idx = doGrupo.findIndex((o) => o.id === id);
      const alvo = idx + dir;
      if (alvo < 0 || alvo >= doGrupo.length) return lst;
      const reord = [...doGrupo];
      [reord[idx], reord[alvo]] = [reord[alvo], reord[idx]];
      const novasOrdens = new Map(reord.map((o, i) => [o.id, i]));
      return lst.map((o) => novasOrdens.has(o.id) ? { ...o, ordem: novasOrdens.get(o.id)! } : o);
    });
  }

  function addOpcao(grupoId: string) {
    clearMsg();
    const id = novoStatusId('op');
    const maiorOrdem = opcoes
      .filter((o) => o.grupo === grupoId)
      .reduce((acc, o) => Math.max(acc, o.ordem), -1);
    setOpcoes((lst) => [...lst, { id, grupo: grupoId, nome: '', cor: 'cinza', ordem: maiorOrdem + 1 }]);
  }

  async function removerOpcao(opcao: StatusOpcao) {
    setErro('');
    setOk('');
    if (originalIds.has(opcao.id)) {
      try {
        const [tarefas, cards] = await Promise.all([
          contarTarefasComOpcao(opcao.id),
          contarCardsComOpcao(opcao.id),
        ]);
        const total = tarefas + cards;
        if (total > 0) {
          setErro(
            `Não dá pra remover "${opcao.nome || 'esta opção'}": ${total} item(ns) ainda usam este status` +
            ` (${tarefas} tarefa(s), ${cards} card(s)). Atualize-os antes.`,
          );
          return;
        }
      } catch {
        setErro('Não foi possível verificar o uso desta opção. Tente de novo.');
        return;
      }
    }
    setOpcoes((lst) => lst.filter((o) => o.id !== opcao.id));
  }

  function restaurarPadrao() {
    clearMsg();
    setGrupos([...DEFAULT_STATUS_GLOBAL.grupos].sort((a, b) => a.ordem - b.ordem));
    setOpcoes(DEFAULT_STATUS_GLOBAL.opcoes.map((o) => ({ ...o })));
  }

  async function salvar() {
    setErro('');
    setOk('');

    if (grupos.length === 0) { setErro('Tenha pelo menos um grupo.'); return; }
    const nomesGrupos = grupos.map((g) => g.nome.trim());
    if (nomesGrupos.some((n) => !n)) { setErro('Todo grupo precisa de um nome.'); return; }
    if (new Set(nomesGrupos.map((n) => n.toLowerCase())).size !== nomesGrupos.length) {
      setErro('Há nomes de grupo repetidos.'); return;
    }
    if (opcoes.some((o) => !o.nome.trim())) { setErro('Toda opção precisa de um nome.'); return; }
    for (const g of grupos) {
      const doGrupo = opcoes
        .filter((o) => o.grupo === g.id)
        .map((o) => o.nome.trim().toLowerCase());
      if (new Set(doGrupo).size !== doGrupo.length) {
        setErro(`Há opções com nomes repetidos no grupo "${g.nome.trim()}".`); return;
      }
    }

    const gruposFinais: StatusGrupo[] = grupos.map((g, i) => ({
      ...g, nome: g.nome.trim(), ordem: i,
    }));
    const idsGrupo = new Set(gruposFinais.map((g) => g.id));
    const opcoesFinais: StatusOpcao[] = [];
    for (const g of gruposFinais) {
      const doGrupo = opcoes
        .filter((o) => o.grupo === g.id && idsGrupo.has(o.grupo))
        .sort((a, b) => a.ordem - b.ordem)
        .map((o, i) => {
          const resp = o.responsavel?.trim();
          const base: StatusOpcao = {
            id: o.id,
            grupo: o.grupo,
            nome: o.nome.trim(),
            cor: o.cor,
            ordem: i,
          };
          return resp ? { ...base, responsavel: resp } : base;
        });
      opcoesFinais.push(...doGrupo);
    }

    const cfg: StatusGlobalConfig = {
      versao: getStatusGlobal().versao,
      grupos: gruposFinais,
      opcoes: opcoesFinais,
    };

    setSalvando(true);
    try {
      await salvarStatusRemoto(cfg);
      setGrupos(gruposFinais);
      setOpcoes(opcoesFinais);
      setOriginalIds(new Set(opcoesFinais.map((o) => o.id)));
      setOk('Configuração salva.');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Voltar">
          <Link to="/config"><ArrowLeft /></Link>
        </Button>
        <h2 className="text-lg font-semibold">Status (grupos e opções)</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Organize os status em <strong>grupos</strong> (ex: "A fazer", "Em andamento") e crie
        {' '}<strong>opções</strong> dentro de cada grupo (ex: "Em produção", "Aguardando aprovação").
        A ordem dos grupos define as colunas do kanban. Em cada opção, defina um
        {' '}<strong>responsável</strong> para ser notificado e ver a tarefa em Minha área enquanto
        ela estiver nesse status.
      </p>

      {carregando ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map((grupo, gIdx) => {
            const opcoesGrupo = opcoesDoGrupoLocal(grupo.id);
            return (
              <Card key={grupo.id}>
                <CardHeader className="pb-2">
                  {/* Linha do grupo */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-block size-3 shrink-0 rounded-full border',
                        CORES_STATUS[grupo.cor],
                      )}
                    />
                    <Input
                      value={grupo.nome}
                      onChange={(e) => patchGrupo(grupo.id, { nome: e.target.value })}
                      placeholder="Nome do grupo"
                      className="h-8 min-w-[10rem] flex-1 font-semibold"
                      aria-label="Nome do grupo"
                    />
                    <select
                      value={grupo.cor}
                      onChange={(e) => patchGrupo(grupo.id, { cor: e.target.value as CorStatus })}
                      className={selectCls}
                      aria-label="Cor do grupo"
                    >
                      {(Object.keys(ROTULO_COR) as CorStatus[]).map((c) => (
                        <option key={c} value={c}>{ROTULO_COR[c]}</option>
                      ))}
                    </select>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label="Subir grupo"
                        disabled={gIdx === 0}
                        onClick={() => moverGrupo(grupo.id, -1)}
                        className="text-muted-foreground disabled:opacity-30 hover:text-foreground"
                      >
                        <ChevronUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Descer grupo"
                        disabled={gIdx === grupos.length - 1}
                        onClick={() => moverGrupo(grupo.id, 1)}
                        className="text-muted-foreground disabled:opacity-30 hover:text-foreground"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-destructive"
                      aria-label={`Remover grupo ${grupo.nome || ''}`}
                      onClick={() => removerGrupo(grupo.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-2 pt-0">
                  {opcoesGrupo.length > 0 && (
                    <div className="hidden grid-cols-[auto_1fr_8rem_12rem_auto] items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                      <span className="w-9" />
                      <span>Opção</span>
                      <span>Cor</span>
                      <span>Responsável</span>
                      <span className="w-9" />
                    </div>
                  )}

                  {opcoesGrupo.map((op, oIdx) => (
                    <div
                      key={op.id}
                      className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border p-2 md:grid-cols-[auto_1fr_8rem_12rem_auto]"
                    >
                      {/* Subir/descer opção */}
                      <div className="flex flex-col">
                        <button
                          type="button"
                          aria-label="Subir opção"
                          disabled={oIdx === 0}
                          onClick={() => moverOpcao(op.id, -1)}
                          className="text-muted-foreground disabled:opacity-30 hover:text-foreground"
                        >
                          <ChevronUp className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Descer opção"
                          disabled={oIdx === opcoesGrupo.length - 1}
                          onClick={() => moverOpcao(op.id, 1)}
                          className="text-muted-foreground disabled:opacity-30 hover:text-foreground"
                        >
                          <ChevronDown className="size-4" />
                        </button>
                      </div>

                      {/* Nome da opção */}
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-block size-3 shrink-0 rounded-full border',
                            CORES_STATUS[op.cor],
                          )}
                        />
                        <Input
                          value={op.nome}
                          onChange={(e) => patchOpcao(op.id, { nome: e.target.value })}
                          placeholder="Nome da opção"
                          className="h-9"
                          aria-label="Nome da opção"
                        />
                      </div>

                      {/* Cor da opção */}
                      <select
                        value={op.cor}
                        onChange={(e) => patchOpcao(op.id, { cor: e.target.value as CorStatus })}
                        className={selectCls}
                        aria-label="Cor da opção"
                      >
                        {(Object.keys(ROTULO_COR) as CorStatus[]).map((c) => (
                          <option key={c} value={c}>{ROTULO_COR[c]}</option>
                        ))}
                      </select>

                      {/* Responsável designado do status */}
                      <select
                        value={op.responsavel ?? ''}
                        onChange={(e) => setResponsavelOpcao(op.id, e.target.value)}
                        className={selectCls}
                        aria-label="Responsável do status"
                        title="Membro notificado e que vê a tarefa em Minha área neste status"
                      >
                        <option value="">Ninguém</option>
                        {membros.map((u) => (
                          <option key={u.id} value={u.id}>{rotuloUsuario(u)}</option>
                        ))}
                        {/* Mantém id órfão (usuário removido) selecionável até limpar */}
                        {op.responsavel && !membros.some((m) => m.id === op.responsavel) && (
                          <option value={op.responsavel}>Usuário removido</option>
                        )}
                      </select>

                      {/* Remover opção */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="justify-self-end text-destructive"
                        aria-label={`Remover ${op.nome || 'opção'}`}
                        onClick={() => removerOpcao(op)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="pt-1">
                    <Button variant="outline" size="sm" onClick={() => addOpcao(grupo.id)}>
                      <Plus className="size-3.5" /> Adicionar opção
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <div>
            <Button variant="outline" onClick={addGrupo}>
              <Plus /> Adicionar grupo
            </Button>
          </div>

          {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
          {ok && <p className="text-sm font-medium text-emerald-500">{ok}</p>}

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={restaurarPadrao}>Restaurar padrão</Button>
            <Button onClick={salvar} disabled={salvando}>
              <Save /> {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
