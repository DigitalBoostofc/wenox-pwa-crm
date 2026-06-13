import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { useDadosAgencia } from './useDadosAgencia';
import { carregarDesempenho } from './relatoriosService';
import type { MesRef, DesempenhoAgencia, DesempenhoMembro } from './relatoriosService';
import { Donut, BarrasMensais, BarraProgresso } from './charts';
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
/*  Mini KPI inline                                                           */
/* -------------------------------------------------------------------------- */

function MiniKpi({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn('text-xl font-semibold', cor)}>{valor}</span>
      <span className="text-[10px] text-muted-foreground">{rotulo}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Drill-down de membro                                                      */
/* -------------------------------------------------------------------------- */

function MembroDesempenhoSheet({
  membro,
  aberto,
  onClose,
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

        <div className="flex flex-col items-center gap-4 pt-4">
          <Donut
            porcentagem={membro.taxaNoPrazo}
            rotulo="No prazo"
            sublabel={`${membro.noPrazo}/${membro.noPrazo + membro.atrasadas} com prazo`}
            tamanho={110}
          />

          <div className="grid w-full grid-cols-2 gap-3">
            <MiniKpi rotulo="Concluídas" valor={membro.concluidas} />
            <MiniKpi rotulo="No prazo" valor={membro.noPrazo} cor="text-emerald-500" />
            <MiniKpi rotulo="Atrasadas" valor={membro.atrasadas} cor="text-destructive" />
            <MiniKpi rotulo="Sem prazo" valor={membro.semPrazo} cor="text-muted-foreground" />
            <MiniKpi rotulo="Abertas agora" valor={membro.abertasAgora} />
            <MiniKpi rotulo="Atrasadas agora" valor={membro.atrasadasAgora} cor="text-destructive" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/*  SecaoDesempenho                                                           */
/* -------------------------------------------------------------------------- */

export function SecaoDesempenho({ meses }: { meses: MesRef[] }) {
  const { tarefas, usuarios, carregando: carregandoDados } = useDadosAgencia();
  const [dados, setDados] = useState<DesempenhoAgencia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [membroSel, setMembroSel] = useState<DesempenhoMembro | null>(null);
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

  if (carregando || carregandoDados) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Desempenho da Equipe</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
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

  const comPrazo = dados.totalNoPrazo + dados.totalAtrasadas;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Desempenho da Equipe</h2>

      {/* ── Visão geral ─────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-center p-6">
            <Donut
              porcentagem={dados.taxaNoPrazo}
              rotulo="Entregas no prazo"
              sublabel={`${dados.totalNoPrazo}/${comPrazo} concluídas com prazo`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Entregas por mês</CardTitle>
          </CardHeader>
          <CardContent>
            <BarrasMensais
              dados={dados.porMes.map((p) => ({
                rotulo: p.rotulo,
                noPrazo: p.noPrazo,
                atrasadas: p.atrasadas,
              }))}
              altura={140}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumo do período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <MiniKpi rotulo="Concluídas" valor={dados.totalConcluidas} />
              <MiniKpi rotulo="No prazo" valor={dados.totalNoPrazo} cor="text-emerald-500" />
              <MiniKpi rotulo="Atrasadas" valor={dados.totalAtrasadas} cor="text-destructive" />
              <MiniKpi rotulo="Sem prazo" valor={dados.totalSemPrazo} cor="text-muted-foreground" />
              <MiniKpi rotulo="Abertas agora" valor={dados.abertasAgora} />
              <MiniKpi rotulo="Atrasadas agora" valor={dados.atrasadasAgora} cor="text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Ranking do time ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="size-4" />
            Desempenho por membro
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dados.membros.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <Users className="size-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Sem dados de desempenho no período.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {dados.membros.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMembroSel(m)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
                >
                  <div
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white',
                      corAvatar(m.nome),
                    )}
                  >
                    {iniciais(m.nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.nome}</p>
                    <p className="text-xs text-muted-foreground">{m.concluidas} concluídas</p>
                  </div>
                  <div className="flex w-28 shrink-0 flex-col gap-1">
                    <BarraProgresso valor={m.taxaNoPrazo} max={100} />
                    <span className="text-[10px] text-muted-foreground">{m.taxaNoPrazo}% no prazo</span>
                  </div>
                  {m.atrasadas > 0 && (
                    <Badge className="shrink-0 border border-destructive/50 bg-destructive/15 text-[10px] text-destructive">
                      {m.atrasadas} atrasada{m.atrasadas !== 1 ? 's' : ''}
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
