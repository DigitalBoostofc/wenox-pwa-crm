import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import {
  getQuadro, listListas, listCartoes,
  criarCartao, atualizarCartao,
} from './quadrosService';
import type { Quadro, Lista, Cartao } from './types';
import { corStatusPost, STATUS_POST, alertaAgendar, statusDaEsteira } from './types';
import { CartaoSheet } from './CartaoSheet';
import { parsePrazo } from '@/tarefas/format';
import { logoUrl } from '@/clientes/clientesService';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

let dragCalCardId: string | null = null;
let dragCalFromBandeja = false;

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const HORAS = Array.from({ length: 18 }, (_, i) => i + 6); // 06..23

const p2 = (n: number) => String(n).padStart(2, '0');

function fmtDia(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

function listaMaisProxima(listas: Lista[]): string {
  if (!listas.length) return '';
  const hojeN = new Date().getFullYear() * 12 + new Date().getMonth();
  let melhor = listas[0];
  let melhorDiff = Infinity;
  for (const l of listas) {
    if (l.mes != null && l.ano != null) {
      const diff = Math.abs(l.ano * 12 + (l.mes - 1) - hojeN);
      if (diff < melhorDiff) { melhorDiff = diff; melhor = l; }
    }
  }
  return melhor.id;
}

function gerarGrade(mes: number, ano: number): (Date | null)[] {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const dow = new Date(ano, mes - 1, 1).getDay(); // 0=Dom
  const offset = (dow + 6) % 7; // Mon=0..Sun=6
  const cells: (Date | null)[] = Array<null>(offset).fill(null);
  for (let d = 1; d <= diasNoMes; d++) cells.push(new Date(ano, mes - 1, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function diaDeCartao(c: Cartao): string | null {
  const d = parsePrazo(c.data_post);
  return d ? fmtDia(d) : null;
}

function horaDeCartao(c: Cartao): number {
  const d = parsePrazo(c.data_post);
  return d ? d.getHours() : 9;
}

function sortListas(ls: Lista[]): Lista[] {
  return ls.filter(l => l.tipo === 'mes').sort((a, b) => {
    if ((a.ano ?? 0) !== (b.ano ?? 0)) return (a.ano ?? 0) - (b.ano ?? 0);
    return (a.mes ?? 0) - (b.mes ?? 0);
  });
}

export function CalendarioPage({ id }: { id: string }) {
  const [quadro, setQuadro] = useState<Quadro | null>(null);
  const [listaMeses, setListaMeses] = useState<Lista[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [listaSel, setListaSel] = useState('');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [visaoDia, setVisaoDia] = useState<string | null>(null);
  const [addEmDia, setAddEmDia] = useState<string | null>(null);
  const [addTexto, setAddTexto] = useState('');
  const [hoverDia, setHoverDia] = useState<string | null>(null);
  const [hoverHora, setHoverHora] = useState<number | null>(null);

  useEffect(() => {
    setCarregando(true);
    Promise.all([getQuadro(id), listListas(id), listCartoes(id)])
      .then(([q, ls, cs]) => {
        setQuadro(q);
        const mes = sortListas(ls);
        setListaMeses(mes);
        setListaSel(listaMaisProxima(mes));
        setCartoes(cs);
      })
      .catch(() => setErro('Não foi possível carregar o calendário.'))
      .finally(() => setCarregando(false));
  }, [id]);

  async function recarregar() {
    try {
      const [ls, cs] = await Promise.all([listListas(id), listCartoes(id)]);
      setListaMeses(sortListas(ls));
      setCartoes(cs);
    } catch { /* */ }
  }

  const idxSel = listaMeses.findIndex(l => l.id === listaSel);
  const listaAtual = listaMeses[idxSel] ?? null;

  const cartoesDaLista = useMemo(
    () => cartoes.filter(c => c.lista === listaSel),
    [cartoes, listaSel],
  );
  const semData = useMemo(
    () => cartoesDaLista.filter(c => !c.data_post),
    [cartoesDaLista],
  );
  const porDia = useMemo(() => {
    const m = new Map<string, Cartao[]>();
    for (const c of cartoesDaLista) {
      const dia = diaDeCartao(c);
      if (dia) { if (!m.has(dia)) m.set(dia, []); m.get(dia)!.push(c); }
    }
    return m;
  }, [cartoesDaLista]);

  const grade = useMemo(
    () => (listaAtual?.mes && listaAtual?.ano ? gerarGrade(listaAtual.mes, listaAtual.ano) : []),
    [listaAtual],
  );

  function irMes(delta: number) {
    const idx = idxSel + delta;
    if (idx >= 0 && idx < listaMeses.length) {
      setListaSel(listaMeses[idx].id);
      setVisaoDia(null);
    }
  }

  async function soltarNoDia(diaStr: string) {
    if (!dragCalCardId) return;
    const cid = dragCalCardId; const fromB = dragCalFromBandeja;
    dragCalCardId = null; dragCalFromBandeja = false;
    setHoverDia(null);
    const card = cartoes.find(c => c.id === cid);
    if (!card) return;
    let hora = '09:00:00';
    if (!fromB && card.data_post) {
      const dp = parsePrazo(card.data_post);
      if (dp) hora = `${p2(dp.getHours())}:${p2(dp.getMinutes())}:00`;
    }
    const novaDP = `${diaStr} ${hora}`;
    setCartoes(cs => cs.map(c => c.id === cid ? { ...c, data_post: novaDP } : c));
    try { await atualizarCartao(cid, { data_post: novaDP }); }
    catch { setErro('Não foi possível mover o card.'); }
  }

  async function soltarNaHora(hora: number) {
    if (!dragCalCardId || !visaoDia) return;
    const cid = dragCalCardId; dragCalCardId = null; dragCalFromBandeja = false;
    setHoverHora(null);
    const card = cartoes.find(c => c.id === cid);
    if (!card) return;
    const dp = parsePrazo(card.data_post);
    const diaStr = dp ? fmtDia(dp) : visaoDia;
    const novaDP = `${diaStr} ${p2(hora)}:00:00`;
    setCartoes(cs => cs.map(c => c.id === cid ? { ...c, data_post: novaDP } : c));
    try { await atualizarCartao(cid, { data_post: novaDP }); }
    catch { setErro('Não foi possível mover o card.'); }
  }

  async function criarNoDia(diaStr: string) {
    const nome = addTexto.trim();
    setAddEmDia(null); setAddTexto('');
    if (!nome || !listaSel) return;
    const ordem = cartoesDaLista.length
      ? Math.max(...cartoesDaLista.map(c => c.ordem ?? 0)) + 1
      : 1;
    try {
      const novo = await criarCartao(id, listaSel, nome, ordem);
      const novaDP = `${diaStr} 09:00:00`;
      await atualizarCartao(novo.id, { data_post: novaDP });
      setCartoes(cs => [...cs, { ...novo, data_post: novaDP }]);
      setAbertoId(novo.id);
    } catch { setErro('Não foi possível criar o card.'); }
  }

  if (carregando) return <Skeleton className="h-[70vh] w-full rounded-xl" />;
  if (erro && !quadro) return <p className="text-sm text-destructive">{erro}</p>;
  if (!quadro) return null;

  const cli = quadro.expand?.cliente;
  const logo = cli?.logo ? logoUrl(cli as never, '100x100') : '';

  // ─── VISÃO DIA ─────────────────────────────────────────────────────────────
  if (visaoDia) {
    const [ano, mesN, dNum] = visaoDia.split('-').map(Number);
    const dataLabel = new Date(ano, mesN - 1, dNum).toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const cartoesNoDia = porDia.get(visaoDia) ?? [];

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setVisaoDia(null)}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Voltar ao mês"
          >
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-base font-semibold capitalize">{dataLabel}</span>
          <Link to={`/quadros/${id}`} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            ← Quadro
          </Link>
          {erro && <span className="ml-2 text-xs text-destructive">{erro}</span>}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl border border-border">
          {HORAS.map(h => {
            const cartsH = cartoesNoDia.filter(c => horaDeCartao(c) === h);
            return (
              <div
                key={h}
                onDragOver={(e) => { if (dragCalCardId) { e.preventDefault(); setHoverHora(h); } }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setHoverHora(prev => (prev === h ? null : prev));
                }}
                onDrop={(e) => { e.preventDefault(); soltarNaHora(h); }}
                className={cn(
                  'flex min-h-[3.25rem] items-start gap-3 border-b border-border/40 px-3 py-2 transition-colors last:border-b-0',
                  hoverHora === h && 'bg-primary/5',
                )}
              >
                <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
                  {p2(h)}:00
                </span>
                <div className="flex flex-1 flex-wrap gap-1.5">
                  {cartsH.map(c => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        dragCalCardId = c.id; dragCalFromBandeja = false;
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => setAbertoId(c.id)}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-sm transition-colors hover:border-primary/40"
                    >
                      <span className="max-w-[200px] truncate">{c.nome}</span>
                      {c.status_post && (() => {
                        const etapas = c.etapas_card;
                        const etapaAtualTexto = etapas?.length
                          ? (() => { const idx = etapas.findIndex(e => !e.feito); return idx >= 0 ? etapas[idx].texto : null; })()
                          : null;
                        const statusExibido = etapaAtualTexto ? statusDaEsteira(etapas) : c.status_post;
                        return (
                          <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold', corStatusPost(statusExibido))}
                            title={etapaAtualTexto ?? undefined}>
                            {etapaAtualTexto ?? (STATUS_POST.find(s => s.id === c.status_post)?.label ?? c.status_post)}
                          </span>
                        );
                      })()}
                      {alertaAgendar(c) && <span className="shrink-0 text-[10px] text-amber-400">⚠</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <CartaoSheet
          cartaoId={abertoId}
          aberto={abertoId !== null}
          clienteId={quadro.cliente}
          ehPost
          onClose={() => { setAbertoId(null); recarregar(); }}
          onMudou={recarregar}
        />
      </div>
    );
  }

  // ─── VISÃO MÊS ─────────────────────────────────────────────────────────────
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* cabeçalho */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/quadros/${id}`}
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Voltar ao quadro"
        >
          <ArrowLeft className="size-5" />
        </Link>
        {logo && <img src={logo} alt="" className="size-7 rounded-md object-cover" />}
        <h2 className="text-lg font-semibold">{quadro.nome}</h2>
        <CalendarDays className="size-4 text-primary/60" />

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => irMes(-1)}
            disabled={idxSel <= 0}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <select
            value={listaSel}
            onChange={e => { setListaSel(e.target.value); setVisaoDia(null); }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none"
          >
            {listaMeses.map(l => (
              <option key={l.id} value={l.id}>{l.nome}</option>
            ))}
          </select>
          <button
            onClick={() => irMes(1)}
            disabled={idxSel >= listaMeses.length - 1}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        {erro && <span className="text-xs text-destructive">{erro}</span>}
      </div>

      {listaMeses.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">
          Nenhum mês cadastrado neste quadro. Adicione um mês no Kanban para ver o calendário.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          {/* ── Grade principal ── */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border">
            {/* cabeçalho dias da semana */}
            <div className="grid shrink-0 grid-cols-7 border-b border-border bg-secondary/30">
              {DIAS_SEMANA.map(d => (
                <div
                  key={d}
                  className="border-r border-border/50 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0"
                >
                  {d}
                </div>
              ))}
            </div>
            {/* células do mês */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-7">
                {grade.map((dia, idx) => {
                  if (!dia) {
                    return (
                      <div
                        key={`vz-${idx}`}
                        className={cn(
                          'min-h-[7rem] border-b border-r border-border/20 bg-secondary/5',
                          (idx + 1) % 7 === 0 && 'border-r-0',
                        )}
                      />
                    );
                  }
                  const diaStr = fmtDia(dia);
                  const cardsNoDia = porDia.get(diaStr) ?? [];
                  const ehHoje = dia.getTime() === hoje.getTime();

                  return (
                    <div
                      key={diaStr}
                      onDragOver={(e) => { if (dragCalCardId) { e.preventDefault(); setHoverDia(diaStr); } }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node))
                          setHoverDia(prev => (prev === diaStr ? null : prev));
                      }}
                      onDrop={(e) => { e.preventDefault(); soltarNoDia(diaStr); }}
                      className={cn(
                        'group flex min-h-[7rem] flex-col border-b border-r border-border/30 p-1.5 transition-colors',
                        (idx + 1) % 7 === 0 && 'border-r-0',
                        hoverDia === diaStr && 'bg-primary/5',
                      )}
                    >
                      {/* número do dia */}
                      <div className="mb-1 flex items-center justify-between">
                        <button
                          onClick={() => { setVisaoDia(diaStr); setAddEmDia(null); }}
                          className={cn(
                            'grid size-6 place-items-center rounded-full text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground',
                            ehHoje ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {dia.getDate()}
                        </button>
                        {addEmDia !== diaStr && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setAddEmDia(diaStr); setAddTexto(''); }}
                            className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                            title="Adicionar card"
                          >
                            <Plus className="size-3" />
                          </button>
                        )}
                      </div>

                      {/* cards do dia */}
                      {cardsNoDia.map(c => (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={(e) => {
                            dragCalCardId = c.id; dragCalFromBandeja = false;
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onClick={() => setAbertoId(c.id)}
                          className="mb-0.5 cursor-pointer rounded border border-transparent px-1.5 py-0.5 text-xs transition-colors hover:border-border hover:bg-secondary/60"
                        >
                          <div className="flex min-w-0 items-center gap-1">
                            {c.status_post && (
                              <span className={cn('shrink-0 rounded px-1 text-[8px] font-bold', corStatusPost(c.status_post))}>
                                {STATUS_POST.find(s => s.id === c.status_post)?.label?.slice(0, 3)}
                              </span>
                            )}
                            <span className="min-w-0 truncate leading-snug">{c.nome}</span>
                            {alertaAgendar(c) && <span className="shrink-0 text-[9px] text-amber-400">⚠</span>}
                          </div>
                        </div>
                      ))}

                      {/* inline add */}
                      {addEmDia === diaStr && (
                        <div className="mt-1 flex flex-col gap-1">
                          <input
                            autoFocus
                            value={addTexto}
                            onChange={e => setAddTexto(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') criarNoDia(diaStr);
                              if (e.key === 'Escape') { setAddEmDia(null); setAddTexto(''); }
                            }}
                            placeholder="Nome do post…"
                            className="h-6 w-full rounded border border-input bg-background px-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
                          />
                          <div className="flex gap-1">
                            <button
                              onClick={() => criarNoDia(diaStr)}
                              className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => { setAddEmDia(null); setAddTexto(''); }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Bandeja "Sem data" ── */}
          <div className="flex w-52 shrink-0 flex-col gap-2 overflow-y-auto rounded-xl border border-dashed border-border p-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sem data
            </span>
            {semData.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Todos os posts têm data.</p>
            ) : semData.map(c => (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => {
                  dragCalCardId = c.id; dragCalFromBandeja = true;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => setAbertoId(c.id)}
                className="cursor-pointer rounded-md border border-border bg-card p-2 text-xs transition-colors hover:border-primary/40"
              >
                <span className="block truncate font-medium leading-snug">{c.nome}</span>
                {c.status_post && (
                  <span className={cn('mt-1 inline-block rounded px-1.5 py-0.5 text-[8px] font-semibold', corStatusPost(c.status_post))}>
                    {STATUS_POST.find(s => s.id === c.status_post)?.label ?? c.status_post}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <CartaoSheet
        cartaoId={abertoId}
        aberto={abertoId !== null}
        clienteId={quadro.cliente}
        ehPost
        onClose={() => { setAbertoId(null); recarregar(); }}
        onMudou={recarregar}
      />
    </div>
  );
}
