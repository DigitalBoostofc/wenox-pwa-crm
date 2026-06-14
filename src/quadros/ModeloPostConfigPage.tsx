import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { type ModeloPostCard, carregarModeloRemoto, getModelo, salvarModeloRemoto } from './modeloPost';
import { FORMATOS_POST, REDES_POST } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function labelRede(r: string): string {
  const map: Record<string, string> = {
    instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
    linkedin: 'LinkedIn', youtube: 'YouTube', twitter: 'Twitter/X',
    pinterest: 'Pinterest', google: 'Google',
  };
  return map[r] ?? r.charAt(0).toUpperCase() + r.slice(1);
}

const selectCls =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

function RedesToggle({
  value,
  onChange,
}: {
  value: string[];
  onChange: (redes: string[]) => void;
}) {
  function toggle(rede: string) {
    if (value.includes(rede)) onChange(value.filter((r) => r !== rede));
    else onChange([...value, rede]);
  }
  return (
    <div className="flex flex-wrap gap-1">
      {REDES_POST.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => toggle(r)}
          className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors border ${
            value.includes(r)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:bg-secondary'
          }`}
        >
          {labelRede(r)}
        </button>
      ))}
    </div>
  );
}

export function ModeloPostConfigPage() {
  const [cards, setCards] = useState<ModeloPostCard[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    carregarModeloRemoto().then(() => {
      setCards(JSON.parse(JSON.stringify(getModelo().cards)) as ModeloPostCard[]);
      setCarregando(false);
    });
  }, []);

  function addCard() {
    setOk('');
    setCards((cs) => [...cs, { nome: '', descricao: '', formato: '', redes: [] }]);
  }

  function patchCard(idx: number, patch: Partial<ModeloPostCard>) {
    setOk('');
    setCards((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function removerCard(idx: number) {
    setOk('');
    setCards((cs) => cs.filter((_, i) => i !== idx));
  }

  async function salvar() {
    setErro('');
    setOk('');
    const limpos = cards
      .map((c) => ({ ...c, nome: c.nome.trim() }))
      .filter((c) => c.nome);
    setSalvando(true);
    try {
      await salvarModeloRemoto(limpos);
      setCards(JSON.parse(JSON.stringify(getModelo().cards)) as ModeloPostCard[]);
      setOk('Modelo salvo.');
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
        <h2 className="text-lg font-semibold">Modelo de post global</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Defina os cards que serão criados automaticamente ao adicionar um mês no Kanban.
        Cada linha vira um card com nome, descrição, formato e redes.
      </p>

      {carregando ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cards do modelo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {cards.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhum card no modelo. Adicione abaixo.
              </p>
            )}
            {cards.map((c, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_1fr_9rem_auto]"
              >
                <Input
                  value={c.nome}
                  onChange={(e) => patchCard(idx, { nome: e.target.value })}
                  placeholder="Nome do card (ex.: Feed semanal)"
                  className="h-9"
                />
                <Input
                  value={c.descricao ?? ''}
                  onChange={(e) => patchCard(idx, { descricao: e.target.value })}
                  placeholder="Descrição (opcional)"
                  className="h-9"
                />
                <select
                  value={c.formato ?? ''}
                  onChange={(e) => patchCard(idx, { formato: e.target.value })}
                  className={selectCls}
                  aria-label="Formato"
                >
                  <option value="">Formato</option>
                  {FORMATOS_POST.map((f) => (
                    <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                  ))}
                </select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive justify-self-end"
                  aria-label="Remover card"
                  onClick={() => removerCard(idx)}
                >
                  <Trash2 />
                </Button>
                <div className="md:col-span-4">
                  <p className="mb-1 text-xs text-muted-foreground">Redes</p>
                  <RedesToggle
                    value={c.redes ?? []}
                    onChange={(redes) => patchCard(idx, { redes })}
                  />
                </div>
              </div>
            ))}
            <div>
              <Button variant="outline" size="sm" onClick={addCard}>
                <Plus /> Adicionar card
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
      {ok && <p className="text-sm font-medium text-emerald-500">{ok}</p>}

      {!carregando && (
        <div className="flex justify-end border-t border-border pt-3">
          <Button onClick={salvar} disabled={salvando}>
            <Save /> {salvando ? 'Salvando…' : 'Salvar modelo'}
          </Button>
        </div>
      )}
    </div>
  );
}
