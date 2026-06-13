import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save,
} from 'lucide-react';
import { listOpcoes } from '@/opcoes/opcoesService';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import type { TipoEtapa } from './types';
import {
  type PresetEtapa, type PresetsPorTipo,
  novoPresetId, carregarPresetsRemoto, getPresets, salvarPresetsRemoto,
} from './etapasPreset';
import { iconeTipo } from '@/components/BarraTipos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const selectCls =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

export function EtapasTarefaConfigPage() {
  const [tipos, setTipos] = useState<string[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [mapa, setMapa] = useState<PresetsPorTipo>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    let vivo = true;
    Promise.all([
      listOpcoes('tipo_projeto'),
      listUsuarios().catch(() => [] as Usuario[]),
      carregarPresetsRemoto(),
    ]).then(([ops, us]) => {
      if (!vivo) return;
      setTipos(ops.map((o) => o.valor));
      setUsuarios((us as Usuario[]).filter((u) => u.role !== 'Cliente'));
      setMapa(JSON.parse(JSON.stringify(getPresets())));
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, []);

  function lista(tipo: string): PresetEtapa[] { return mapa[tipo] ?? []; }
  function setLista(tipo: string, ls: PresetEtapa[]) {
    setOk('');
    setMapa((m) => ({ ...m, [tipo]: ls }));
  }
  function add(tipo: string) {
    setLista(tipo, [...lista(tipo), { id: novoPresetId(), texto: '', tipo: 'interna', responsavel: '' }]);
  }
  function patch(tipo: string, id: string, campo: Partial<PresetEtapa>) {
    setLista(tipo, lista(tipo).map((p) => (p.id === id ? { ...p, ...campo } : p)));
  }
  function remover(tipo: string, id: string) {
    setLista(tipo, lista(tipo).filter((p) => p.id !== id));
  }
  function mover(tipo: string, idx: number, dir: -1 | 1) {
    const ls = lista(tipo); const alvo = idx + dir;
    if (alvo < 0 || alvo >= ls.length) return;
    const n = [...ls]; [n[idx], n[alvo]] = [n[alvo], n[idx]];
    setLista(tipo, n);
  }

  async function salvar() {
    setErro(''); setOk('');
    // Limpa etapas sem texto e normaliza responsável por tipo de etapa.
    const limpo: PresetsPorTipo = {};
    for (const [tipo, ls] of Object.entries(mapa)) {
      const filtradas = (ls ?? [])
        .map((p) => ({ ...p, texto: p.texto.trim() }))
        .filter((p) => p.texto)
        .map((p) => ({ ...p, responsavel: p.tipo === 'interna' ? (p.responsavel || '') : '' }));
      if (filtradas.length) limpo[tipo] = filtradas;
    }
    setSalvando(true);
    try {
      await salvarPresetsRemoto(limpo);
      setMapa(JSON.parse(JSON.stringify(getPresets())));
      setOk('Modelos salvos.');
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
        <h2 className="text-lg font-semibold">Modelos de etapas por tipo</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Defina as etapas que se repetem em cada tipo de tarefa (nome, se é interna
        ou aprovação do cliente, e o responsável). Ao criar a tarefa, é só escolher
        a etapa pronta — ou aplicar o modelo inteiro — sem digitar tudo de novo.
      </p>

      {carregando ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : tipos.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum tipo de projeto cadastrado. Crie em Parâmetros (listas) → Tipo de projeto.
        </CardContent></Card>
      ) : (
        <>
          {tipos.map((tipo) => {
            const Icon = iconeTipo(tipo);
            const ls = lista(tipo);
            return (
              <Card key={tipo}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="size-4 text-primary" /> {tipo}
                    <span className="font-normal text-muted-foreground/70">({ls.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {ls.map((p, idx) => (
                    <div key={p.id} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border p-2 md:grid-cols-[auto_1fr_10rem_12rem_auto]">
                      <div className="flex flex-col">
                        <button aria-label="Subir" disabled={idx === 0} onClick={() => mover(tipo, idx, -1)}
                          className="text-muted-foreground disabled:opacity-30 hover:text-foreground"><ChevronUp className="size-4" /></button>
                        <button aria-label="Descer" disabled={idx === ls.length - 1} onClick={() => mover(tipo, idx, 1)}
                          className="text-muted-foreground disabled:opacity-30 hover:text-foreground"><ChevronDown className="size-4" /></button>
                      </div>

                      <Input
                        value={p.texto}
                        onChange={(e) => patch(tipo, p.id, { texto: e.target.value })}
                        placeholder="Nome da etapa (ex.: Criar arte)"
                        className="h-9"
                      />

                      <select
                        value={p.tipo}
                        onChange={(e) => patch(tipo, p.id, { tipo: e.target.value as TipoEtapa })}
                        className={selectCls}
                        aria-label="Tipo da etapa"
                      >
                        <option value="interna">Interna</option>
                        <option value="aprovacao_cliente">Aprovação do cliente</option>
                      </select>

                      {p.tipo === 'interna' ? (
                        <select
                          value={p.responsavel || ''}
                          onChange={(e) => patch(tipo, p.id, { responsavel: e.target.value })}
                          className={selectCls}
                          aria-label="Responsável"
                        >
                          <option value="">Sem responsável</option>
                          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                      ) : (
                        <span className="grid h-9 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                          Cliente aprova
                        </span>
                      )}

                      <Button size="icon" variant="ghost" className="justify-self-end text-destructive"
                        aria-label="Remover etapa" onClick={() => remover(tipo, p.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                  <div>
                    <Button variant="outline" size="sm" onClick={() => add(tipo)}>
                      <Plus /> Adicionar etapa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
          {ok && <p className="text-sm font-medium text-emerald-500">{ok}</p>}

          <div className="flex justify-end border-t border-border pt-3">
            <Button onClick={salvar} disabled={salvando}>
              <Save /> {salvando ? 'Salvando…' : 'Salvar modelos'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
