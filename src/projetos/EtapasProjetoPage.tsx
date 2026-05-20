import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import {
  listEtapas, criarEtapa, atualizarEtapa, removerEtapa, reordenarEtapas,
} from './etapasService';
import type { EtapaProjeto } from './types';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function EtapasProjetoPage() {
  const history = useHistory();
  const [tipos, setTipos] = useState<Opcao[]>([]);
  const [tipoAtivo, setTipoAtivo] = useState<string>('');
  const [etapas, setEtapas] = useState<EtapaProjeto[]>([]);
  const [nova, setNova] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listOpcoes('tipo_projeto').then((ts) => {
      setTipos(ts);
      if (ts[0]) setTipoAtivo(ts[0].valor);
    });
  }, []);

  useEffect(() => {
    if (!tipoAtivo) { setEtapas([]); return; }
    listEtapas(tipoAtivo).then(setEtapas);
  }, [tipoAtivo]);

  const etapasOrdenadas = useMemo(
    () => [...etapas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [etapas],
  );

  async function recarregar() {
    if (!tipoAtivo) return;
    setEtapas(await listEtapas(tipoAtivo));
  }

  async function adicionar() {
    const v = nova.trim();
    if (!v || !tipoAtivo) return;
    setSalvando(true);
    try {
      const ordem = (etapasOrdenadas[etapasOrdenadas.length - 1]?.ordem ?? 0) + 1;
      await criarEtapa({ tipo: tipoAtivo, nome: v, ordem });
      setNova('');
      await recarregar();
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(id: string) {
    if (!confirm('Apagar esta etapa?')) return;
    await removerEtapa(id);
    await recarregar();
  }

  async function renomear(id: string, nome: string) {
    await atualizarEtapa(id, { nome });
    await recarregar();
  }

  async function mover(idx: number, delta: -1 | 1) {
    const next = [...etapasOrdenadas];
    const dest = idx + delta;
    if (dest < 0 || dest >= next.length) return;
    [next[idx], next[dest]] = [next[dest], next[idx]];
    setEtapas(next); // otimista
    await reordenarEtapas(next.map((e) => e.id));
    await recarregar();
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => history.push('/config')} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h2 className="text-lg font-semibold">Etapas de projeto</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tipos</CardTitle>
        </CardHeader>
        <CardContent>
          {tipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum tipo de projeto cadastrado em <strong>Parâmetros</strong>.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tipos.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTipoAtivo(t.valor)}
                  className={
                    'rounded-full border px-3 py-1 text-sm transition-colors ' +
                    (tipoAtivo === t.valor
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary')
                  }
                >
                  {t.valor}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {tipoAtivo && (
        <Card>
          <CardHeader>
            <CardTitle>Etapas de {tipoAtivo}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nova etapa (ex: Briefing, Layout, Implementação…)"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
              />
              <Button onClick={adicionar} disabled={salvando || !nova.trim()}>
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>

            {etapasOrdenadas.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                Nenhuma etapa cadastrada ainda. As etapas devem refletir o pipeline real
                deste tipo (ex: Briefing → Layout → Implementação → Ativo).
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {etapasOrdenadas.map((e, idx) => (
                  <li key={e.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                    <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                      {idx + 1}
                    </span>
                    <Input
                      defaultValue={e.nome}
                      onBlur={(ev) => {
                        const v = ev.target.value.trim();
                        if (v && v !== e.nome) renomear(e.id, v);
                      }}
                    />
                    <Button type="button" variant="ghost" size="icon" aria-label="Subir"
                      onClick={() => mover(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Descer"
                      onClick={() => mover(idx, 1)} disabled={idx === etapasOrdenadas.length - 1}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Apagar"
                      onClick={() => apagar(e.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
