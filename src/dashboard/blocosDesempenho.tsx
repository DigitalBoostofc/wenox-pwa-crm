import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { useDadosAgencia } from './useDadosAgencia';
import { carregarDesempenho } from './relatoriosService';
import type { MesRef, DesempenhoAgencia, DesempenhoMembro } from './relatoriosService';
import { BarrasMensais, BarraProgresso, RoscaSegmentada } from './charts';
import { corAvatar } from '@/clientes/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function iniciais(n?: string): string {
  const t = (n ?? '?').trim();
  const p = t.split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return t.charAt(0).toUpperCase() || '?';
}

/* -------------------------------------------------------------------------- */
/*  Hook de dados (compute em memória — barato, sem fetch)                     */
/* -------------------------------------------------------------------------- */

function useDesempenho(meses: MesRef[]) {
  const { tarefas, usuarios, carregando: carregandoDados } = useDadosAgencia();
  const [dados, setDados] = useState<DesempenhoAgencia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const seqRef = useRef(0);

  useEffect(() => {
    if (carregandoDados) return;
    const seq = ++seqRef.current;
    setCarregando(true);
    setErro('');
    carregarDesempenho(meses, tarefas, usuarios)
      .then((r) => { if (seq === seqRef.current) setDados(r); })
      .catch(() => { if (seq === seqRef.current) setErro('Não foi possível carregar o desempenho.'); })
      .finally(() => { if (seq === seqRef.current) setCarregando(false); });
  }, [meses, tarefas, usuarios, carregandoDados]);

  return { dados, carregando: carregando || carregandoDados, erro };
}

/* -------------------------------------------------------------------------- */
/*  Painel de desempenho compartilhado (recebidas / concluídas / abertas)     */
/* -------------------------------------------------------------------------- */

export interface ResumoDesempenho {
  recebidas: number;
  concl: { total: number; noPrazo: number; atrasada: number; semPrazo: number };
  abertas: { total: number; atrasada: number; noPrazo: number };
}

export function resumoDeMembro(d: DesempenhoMembro): ResumoDesempenho {
  return {
    recebidas: d.concluidas + d.abertasAgora,
    concl: { total: d.concluidas, noPrazo: d.noPrazo, atrasada: d.atrasadas, semPrazo: d.semPrazo },
    abertas: { total: d.abertasAgora, atrasada: d.atrasadasAgora, noPrazo: d.abertasAgora - d.atrasadasAgora },
  };
}

export function resumoDeAgencia(a: DesempenhoAgencia): ResumoDesempenho {
  return {
    recebidas: a.totalConcluidas + a.abertasAgora,
    concl: { total: a.totalConcluidas, noPrazo: a.totalNoPrazo, atrasada: a.totalAtrasadas, semPrazo: a.totalSemPrazo },
    abertas: { total: a.abertasAgora, atrasada: a.atrasadasAgora, noPrazo: a.abertasAgora - a.atrasadasAgora },
  };
}

function ItemLegenda({ cor, rotulo, valor, total }: { cor: string; rotulo: string; valor: number; total: number }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('size-2.5 shrink-0 rounded-full', cor)} />
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="ml-auto text-xs font-semibold">{pct}%</span>
    </div>
  );
}

/** Painel: Total recebidas + 2 gráficos separados (Concluídas / Abertas). */
export function PainelDesempenho({ resumo }: { resumo: ResumoDesempenho }) {
  const { recebidas, concl, abertas } = resumo;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-secondary/40 px-4 py-3 text-center">
        <span className="text-2xl font-semibold">{recebidas}</span>
        <span className="ml-2 text-sm text-muted-foreground">tarefas recebidas</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Concluídas */}
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-4">
          <span className="text-sm font-medium">Concluídas</span>
          <RoscaSegmentada
            centro={concl.total}
            segmentos={[
              { valor: concl.noPrazo, classe: 'stroke-emerald-500' },
              { valor: concl.atrasada, classe: 'stroke-destructive' },
              { valor: concl.semPrazo, classe: 'stroke-muted-foreground' },
            ]}
            tamanho={110}
          />
          <div className="flex w-full flex-col gap-1">
            <ItemLegenda cor="bg-emerald-500" rotulo="No prazo" valor={concl.noPrazo} total={concl.total} />
            <ItemLegenda cor="bg-destructive" rotulo="Atrasada" valor={concl.atrasada} total={concl.total} />
            <ItemLegenda cor="bg-muted-foreground" rotulo="Sem prazo" valor={concl.semPrazo} total={concl.total} />
          </div>
        </div>

        {/* Abertas */}
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-4">
          <span className="text-sm font-medium">Abertas</span>
          <RoscaSegmentada
            centro={abertas.total}
            segmentos={[
              { valor: abertas.atrasada, classe: 'stroke-destructive' },
              { valor: abertas.noPrazo, classe: 'stroke-emerald-500' },
            ]}
            tamanho={110}
          />
          <div className="flex w-full flex-col gap-1">
            <ItemLegenda cor="bg-destructive" rotulo="Atrasada" valor={abertas.atrasada} total={abertas.total} />
            <ItemLegenda cor="bg-emerald-500" rotulo="No prazo" valor={abertas.noPrazo} total={abertas.total} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Drill-down de membro                                                      */
/* -------------------------------------------------------------------------- */

function MembroDesempenhoSheet({
  membro, aberto, onClose,
}: {
  membro: DesempenhoMembro | null;
  aberto: boolean;
  onClose: () => void;
}) {
  if (!membro) return null;
  return (
    <Sheet open={aberto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-80 overflow-y-auto sm:w-96">
        <SheetTitle className="text-base">{membro.nome}</SheetTitle>
        <div className="pt-4">
          <PainelDesempenho resumo={resumoDeMembro(membro)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/*  Visão geral da agência (donut + barras + resumo)                          */
/* -------------------------------------------------------------------------- */

export function VisaoGeralDesempenho({ meses }: { meses: MesRef[] }) {
  const { dados, carregando, erro } = useDesempenho(meses);

  if (carregando) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Desempenho da Equipe</h2>
        <div className="grid gap-4 lg:grid-cols-4">
          <Skeleton className="h-56 w-full rounded-xl lg:col-span-1" />
          <Skeleton className="h-56 w-full rounded-xl lg:col-span-2" />
          <Skeleton className="h-56 w-full rounded-xl lg:col-span-1" />
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Desempenho da Equipe</h2>
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      </div>
    );
  }
  if (!dados) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Desempenho da Equipe</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recebidas + Concluídas/Abertas (gráficos separados) */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <PainelDesempenho resumo={resumoDeAgencia(dados)} />
          </CardContent>
        </Card>

        {/* Entregas por mês */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Entregas por mês</CardTitle>
          </CardHeader>
          <CardContent>
            <BarrasMensais
              dados={dados.porMes.map((p) => ({
                rotulo: p.rotulo, noPrazo: p.noPrazo, atrasadas: p.atrasadas,
              }))}
              altura={200}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ranking por membro (com drill-down)                                       */
/* -------------------------------------------------------------------------- */

export function RankingMembros({ meses }: { meses: MesRef[] }) {
  const { dados, carregando, erro } = useDesempenho(meses);
  const [membroSel, setMembroSel] = useState<DesempenhoMembro | null>(null);

  return (
    <div className="flex h-full flex-col gap-3">
      <h2 className="text-lg font-semibold">Desempenho por membro</h2>
      <Card className="flex flex-1 flex-col">
        <CardContent className="flex flex-1 flex-col p-0">
          {carregando ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : erro ? (
            <p className="px-5 py-8 text-center text-sm text-destructive">{erro}</p>
          ) : !dados || dados.membros.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <Users className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sem dados de desempenho no período.</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col divide-y divide-border/40">
              {dados.membros.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMembroSel(m)}
                  className="flex w-full flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                >
                  <div
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white',
                      corAvatar(m.nome),
                    )}
                  >
                    {iniciais(m.nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.concluidas} concluídas
                      {m.atrasadasAgora > 0 && (
                        <span className="text-destructive"> · {m.atrasadasAgora} atrasada(s) agora</span>
                      )}
                    </p>
                  </div>
                  <div className="flex w-32 shrink-0 flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>No prazo</span>
                      <span className="font-semibold text-foreground">{m.taxaNoPrazo}%</span>
                    </div>
                    <BarraProgresso
                      valor={m.taxaNoPrazo}
                      max={100}
                      cor={m.taxaNoPrazo >= 70 ? 'bg-emerald-500' : m.taxaNoPrazo >= 40 ? 'bg-amber-500' : 'bg-destructive'}
                    />
                  </div>
                  {m.atrasadas > 0 && (
                    <Badge className="shrink-0 border border-destructive/50 bg-destructive/15 text-[10px] text-destructive">
                      {m.atrasadas}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MembroDesempenhoSheet
        membro={membroSel}
        aberto={membroSel !== null}
        onClose={() => setMembroSel(null)}
      />
    </div>
  );
}
