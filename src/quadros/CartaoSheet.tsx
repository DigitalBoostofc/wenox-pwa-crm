import { useEffect, useRef, useState } from 'react';
import {
  CheckSquare, Paperclip, Tag, Calendar, Users, X, Trash2, MessageSquare, ImageIcon,
  FileText, Bold, Italic, List, Link2, ChevronDown, ExternalLink, CalendarDays, History,
} from 'lucide-react';
import { Markdown } from './Markdown';
import {
  getCartao, atualizarCartao, removerCartao, arquivarCartao,
  subirAnexosMedia, urlUpload,
  listComentariosCartao, addComentarioCartao, removerComentarioCartao,
  confirmarEtapaCard, getOuCriarReviewToken,
  registrarAtividadeCartao, ehAtividade, textoAtividade, ATIV_MARK,
} from './quadrosService';
import { AvatarMembro } from '@/dashboard/AvatarMembro';
import { Archive } from 'lucide-react';
import type { Cartao, EtiquetaCartao, ComentarioCartao } from './types';
import { progressoChecklist, corEtiquetaSolida, corPrazoCard, capaCartao, capaEhCor, CORES_ETIQUETA, CORES_CAPA, FORMATOS_POST, alertaAgendar, TIPO_POST_LABEL, ORIENTACOES_DESIGN_TEMPLATE } from './types';
import { PreviewPost } from './PreviewPost';
import { prazoBR, parsePrazo } from '@/tarefas/format';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { pb } from '@/lib/pocketbase';

type Painel = 'membros' | 'etiquetas' | 'datas' | 'capa' | null;

function AcaoBtn({ icon: Icon, label, onClick }: { icon: typeof Tag; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground/90 transition-colors hover:bg-secondary/70">
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

export function CartaoSheet({ cartaoId, aberto, labelsDisponiveis = [], clienteId, listaNome, ehPost, onClose, onMudou }: {
  cartaoId: string | null; aberto: boolean; labelsDisponiveis?: EtiquetaCartao[]; clienteId?: string; listaNome?: string;
  ehPost?: boolean; onClose: () => void; onMudou?: () => void;
}) {
  const [c, setC] = useState<Cartao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [equipe, setEquipe] = useState<Usuario[]>([]);
  const [descRasc, setDescRasc] = useState('');
  const [editandoDesc, setEditandoDesc] = useState(false);
  const [novoItem, setNovoItem] = useState<Record<number, string>>({});
  const [novaCl, setNovaCl] = useState('');
  const [novaEtNome, setNovaEtNome] = useState('');
  const [novaEtCor, setNovaEtCor] = useState<string>('green');
  const [comentarios, setComentarios] = useState<ComentarioCartao[]>([]);
  const [novoComent, setNovoComent] = useState('');
  const [painel, setPainel] = useState<Painel>(null);
  const [anexarAberto, setAnexarAberto] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTexto, setLinkTexto] = useState('');
  const [descExpandida, setDescExpandida] = useState(false);
  const [descTransborda, setDescTransborda] = useState(false);
  const [legendaLocal, setLegendaLocal] = useState('');
  const [hashtagsLocal, setHashtagsLocal] = useState('');
  const [previewAberto, setPreviewAberto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const descTextRef = useRef<HTMLTextAreaElement>(null);

  // detecta se a descrição transborda (pra mostrar "Mostrar mais")
  useEffect(() => {
    if (editandoDesc) return;
    const el = descRef.current;
    if (el) setDescTransborda(el.scrollHeight > 296);
  }, [c?.descricao, editandoDesc, c?.id]);

  function envolverSel(prefixo: string, sufixo = '') {
    const ta = descTextRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd, v = descRasc;
    const novo = v.slice(0, s) + prefixo + v.slice(s, e) + sufixo + v.slice(e);
    setDescRasc(novo);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = s + prefixo.length; ta.selectionEnd = e + prefixo.length; });
  }
  function prefixarLinhas(prefixo: string) {
    const ta = descTextRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd, v = descRasc;
    const ini = v.lastIndexOf('\n', s - 1) + 1;
    const bloco = v.slice(ini, e);
    const novo = v.slice(0, ini) + bloco.split('\n').map((l) => prefixo + l).join('\n') + v.slice(e);
    setDescRasc(novo);
    requestAnimationFrame(() => ta.focus());
  }
  function definirTitulo(n: number) {
    const ta = descTextRef.current; if (!ta) return;
    const s = ta.selectionStart, v = descRasc;
    const ini = v.lastIndexOf('\n', s - 1) + 1;
    let fim = v.indexOf('\n', ini); if (fim < 0) fim = v.length;
    let linha = v.slice(ini, fim).replace(/^#{1,6}\s*/, '');
    if (n > 0) linha = '#'.repeat(n) + ' ' + linha;
    setDescRasc(v.slice(0, ini) + linha + v.slice(fim));
    requestAnimationFrame(() => ta.focus());
  }
  function inserirLink() { const url = prompt('URL do link:'); if (url) envolverSel('[', '](' + url + ')'); }

  useEffect(() => {
    if (!cartaoId) { setC(null); setComentarios([]); return; }
    setPainel(null); setEditandoDesc(false); setDescExpandida(false);
    setCarregando(true);
    getCartao(cartaoId).then((r) => { setC(r); setDescRasc(r.descricao || (ehPost ? ORIENTACOES_DESIGN_TEMPLATE : '')); setLegendaLocal(r.legenda ?? ''); setHashtagsLocal(r.hashtags ?? ''); }).catch(() => setC(null)).finally(() => setCarregando(false));
    listComentariosCartao(cartaoId).then(setComentarios).catch(() => setComentarios([]));
  }, [cartaoId]);
  useEffect(() => { listUsuarios().then((us) => setEquipe(us.filter((u) => u.role !== 'Cliente'))).catch(() => { /* */ }); }, []);
  // auto-cresce a caixa de orientações (etapa Copy) conforme o conteúdo carrega/muda
  useEffect(() => { if (ehPost) autoGrow(descTextRef.current); }, [descRasc, ehPost, c?.id]);

  // Registra uma atividade no histórico (aparece junto dos comentários)
  function logAtividade(msg: string) {
    if (!c || !msg) return;
    const rec = pb.authStore.record as { id?: string; nome?: string } | null;
    const entry: ComentarioCartao = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      texto: ATIV_MARK + msg,
      autor: rec?.id,
      created: new Date().toISOString(),
      expand: { autor: { id: rec?.id ?? '', nome: rec?.nome } },
    };
    setComentarios((l) => [entry, ...l]);
    registrarAtividadeCartao(c.id, msg, clienteId).catch(() => { /* */ });
  }

  // Descreve, em PT, o que mudou num salvar() para o histórico de atividades
  function descreverMudanca(dados: Partial<Cartao>): string | null {
    const partes: string[] = [];
    const ignoraNome = 'data_post' in dados; // renomeação do título por data já é coberta pela data
    for (const k of Object.keys(dados) as (keyof Cartao)[]) {
      switch (k) {
        case 'nome': if (!ignoraNome) partes.push(`renomeou para "${dados.nome}"`); break;
        case 'descricao': partes.push('editou a descrição'); break;
        case 'formato': partes.push(dados.formato ? `definiu o tipo de post: ${TIPO_POST_LABEL[dados.formato] ?? dados.formato}` : 'limpou o tipo de post'); break;
        case 'data_post': {
          const p = parsePrazo(dados.data_post as string);
          partes.push(dados.data_post ? `definiu a data do post: ${p ? p.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : dados.data_post}` : 'removeu a data do post');
          break;
        }
        case 'prazo': partes.push(dados.prazo ? 'definiu a data de entrega' : 'removeu a data de entrega'); break;
        case 'concluido': partes.push(dados.concluido ? 'marcou como concluído' : 'reabriu o card'); break;
        case 'membros_ids': partes.push('atualizou os membros'); break;
        case 'etiquetas': partes.push('atualizou as etiquetas'); break;
        case 'checklists': partes.push('atualizou os checklists'); break;
        case 'capa': partes.push(dados.capa ? 'alterou a capa' : 'removeu a capa'); break;
        case 'anexos': partes.push('atualizou os anexos'); break;
        case 'legenda': partes.push('editou a legenda'); break;
        case 'hashtags': partes.push('editou as hashtags'); break;
        case 'referencia': partes.push('editou a referência'); break;
        case 'redes': partes.push('atualizou as redes'); break;
        case 'objetivo': partes.push('definiu o objetivo'); break;
        case 'tema': partes.push('definiu o tema'); break;
        case 'status_post': partes.push('mudou o status do post'); break;
        case 'briefing': partes.push('editou o briefing'); break;
        default: break;
      }
    }
    return partes.length ? partes.join('; ') : null;
  }

  async function salvar(dados: Partial<Cartao>) {
    if (!c) return;
    const desc = descreverMudanca(dados);
    setC({ ...c, ...dados });
    try { await atualizarCartao(c.id, dados); onMudou?.(); if (desc) logAtividade(desc); } catch { /* */ }
  }
  function toggleItem(ci: number, ii: number) { if (c) salvar({ checklists: (c.checklists ?? []).map((ch, i) => i !== ci ? ch : { ...ch, itens: ch.itens.map((it, j) => (j === ii ? { ...it, feito: !it.feito } : it)) }) }); }
  function removerItem(ci: number, ii: number) { if (c) salvar({ checklists: (c.checklists ?? []).map((ch, i) => i !== ci ? ch : { ...ch, itens: ch.itens.filter((_, j) => j !== ii) }) }); }
  function addItem(ci: number) {
    if (!c) return; const txt = (novoItem[ci] ?? '').trim(); if (!txt) return;
    salvar({ checklists: (c.checklists ?? []).map((ch, i) => i !== ci ? ch : { ...ch, itens: [...ch.itens, { texto: txt, feito: false }] }) });
    setNovoItem((m) => ({ ...m, [ci]: '' }));
  }
  function addChecklist(nome?: string) {
    if (!c) return; const n = (nome ?? novaCl).trim() || 'Checklist';
    salvar({ checklists: [...(c.checklists ?? []), { nome: n, itens: [] }] }); setNovaCl('');
  }
  function removerChecklist(ci: number) { if (c) salvar({ checklists: (c.checklists ?? []).filter((_, i) => i !== ci) }); }
  function removerEtiqueta(idx: number) { if (c) salvar({ etiquetas: (c.etiquetas ?? []).filter((_, i) => i !== idx) }); }
  function addEtiqueta(e: EtiquetaCartao) { if (c && !(c.etiquetas ?? []).some((x) => x.nome === e.nome && x.cor === e.cor)) salvar({ etiquetas: [...(c.etiquetas ?? []), e] }); }
  function criarEtiqueta() { const n = novaEtNome.trim(); addEtiqueta({ nome: n, cor: novaEtCor }); setNovaEtNome(''); }
  function toggleMembro(uid: string) { if (!c) return; const a = c.membros_ids ?? []; salvar({ membros_ids: a.includes(uid) ? a.filter((m) => m !== uid) : [...a, uid] }); }
  async function excluirCard() { if (!c || !confirm('Excluir este card? Esta ação não pode ser desfeita.')) return; try { await removerCartao(c.id); onMudou?.(); onClose(); } catch { /* */ } }
  async function arquivar() { if (!c) return; try { await arquivarCartao(c.id, true); onMudou?.(); onClose(); } catch { /* */ } }
  async function enviarComentario() { if (!c) return; const t = novoComent.trim(); if (!t) return; setNovoComent(''); try { await addComentarioCartao(c.id, t, clienteId); setComentarios(await listComentariosCartao(c.id)); } catch { /* */ } }
  async function apagarComentario(cid: string) { try { await removerComentarioCartao(cid); setComentarios((l) => l.filter((x) => x.id !== cid)); } catch { /* */ } }
  async function onUpload(files: FileList | null) {
    if (!c || !files || files.length === 0) return;
    const qtd = files.length;
    try { setC(await subirAnexosMedia(c, Array.from(files), clienteId)); onMudou?.(); logAtividade(`anexou ${qtd} arquivo${qtd > 1 ? 's' : ''}`); } catch { /* */ } finally { if (fileRef.current) fileRef.current.value = ''; }
    setAnexarAberto(false);
  }
  function inserirLinkAnexo() {
    if (!c) return; const u = linkUrl.trim(); if (!u) return;
    salvar({ anexos: [...(c.anexos ?? []), { nome: linkTexto.trim() || u, url: u }] });
    setLinkUrl(''); setLinkTexto(''); setAnexarAberto(false);
  }

  function autoGrow(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  // Prefixo de data no título do post: "02 Qui: <resto>" derivado da data do post
  const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  function tituloComData(nomeAtual: string, dataStr: string): string {
    const resto = (nomeAtual ?? '').replace(/^\s*\d{1,2}\s+\p{L}{3}:\s*/u, '');
    const [y, m, d] = dataStr.split('-').map(Number);
    if (!y || !m || !d) return resto;
    const prefixo = `${String(d).padStart(2, '0')} ${DIAS_SEMANA[new Date(y, m - 1, d).getDay()]}:`;
    return resto ? `${prefixo} ${resto}` : prefixo;
  }
  // Salva data do post e sincroniza o prefixo de data no título
  function salvarDataPost(dataStr: string) {
    if (!c) return;
    if (!dataStr) { salvar({ data_post: '' }); return; }
    salvar({ data_post: `${dataStr} ${dpTimeStr || '00:00'}:00`, nome: tituloComData(c.nome, dataStr) });
  }

  async function abrirRevisao() {
    if (!c?.lista) return;
    try {
      const token = await getOuCriarReviewToken(c.lista);
      onClose();
      // navegação COMPLETA: /revisao é app público (decidido no Root pelo pathname)
      window.location.href = `/revisao/${token}`;
    } catch { /* */ }
  }

  async function handleConfirmarEtapa(
    idx: number,
    opts?: { veredito?: 'aprovado' | 'reprovado'; motivo?: string },
  ) {
    if (!c) return;
    const uid = (pb.authStore.record as { id?: string } | null)?.id ?? '';
    const etapaNome = c.etapas_card?.[idx]?.texto ?? 'etapa';
    try {
      const atualizado = await confirmarEtapaCard(c, idx, uid, opts);
      setC(atualizado);
      setLegendaLocal(atualizado.legenda ?? '');
      setHashtagsLocal(atualizado.hashtags ?? '');
      onMudou?.();
      logAtividade(opts?.veredito === 'reprovado'
        ? `reprovou a etapa "${etapaNome}"${opts?.motivo ? `: ${opts.motivo}` : ''}`
        : `confirmou a etapa "${etapaNome}"`);
    } catch { /* */ }
  }

  // derivados de data_post para os inputs date+time (wall-clock, ignora Z)
  const _dpParsed = parsePrazo(c?.data_post);
  const _padN = (n: number) => String(n).padStart(2, '0');
  const dpDateStr = _dpParsed ? `${_dpParsed.getFullYear()}-${_padN(_dpParsed.getMonth() + 1)}-${_padN(_dpParsed.getDate())}` : '';
  const dpTimeStr = _dpParsed ? `${_padN(_dpParsed.getHours())}:${_padN(_dpParsed.getMinutes())}` : '';

  const ehImg = (n: string) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(n);
  const imgs: { url: string; nome?: string }[] = [
    ...(c?.anexos ?? []).filter((a) => (a.mime ?? '').startsWith('image') && a.url).map((a) => ({ url: a.url!, nome: a.nome })),
    ...(c?.uploads ?? []).filter(ehImg).map((fn) => ({ url: urlUpload(c!, fn), nome: fn })),
  ];
  // lista unificada de anexos pra exibição estilo Trello (miniatura + nome + data)
  const extDe = (nome?: string, url?: string) => {
    const s = (nome || url || '').split('?')[0];
    const m = s.match(/\.([a-z0-9]{1,5})$/i);
    return m ? m[1].toUpperCase() : 'LINK';
  };
  const fmtData = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  type AnexoView = { url: string; nome?: string; img: boolean; created?: string };
  const anexosView: AnexoView[] = c ? [
    ...(c.anexos ?? []).filter((a) => a.url).map((a) => ({ url: a.url!, nome: a.nome, img: (a.mime ?? '').startsWith('image') || ehImg(a.nome ?? a.url!), created: a.data ?? c.created })),
    ...(c.uploads ?? []).map((fn) => ({ url: urlUpload(c, fn), nome: fn, img: ehImg(fn), created: c.created })),
  ] : [];
  const prog = c ? progressoChecklist(c) : { feitos: 0, total: 0 };
  const labelsRestantes = labelsDisponiveis.filter((d) => !(c?.etiquetas ?? []).some((x) => x.nome === d.nome && x.cor === d.cor));
  const capa = c ? capaCartao(c) : null;
  const temEt = (c?.etiquetas ?? []).filter((e) => e.nome || e.cor).length > 0;
  const memUsuarios = (c?.membros_ids ?? []).map((id) => equipe.find((u) => u.id === id)).filter(Boolean) as Usuario[];
  const temMem = memUsuarios.length > 0;

  const inputCls = 'w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

  return (
    <>
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        {carregando || !c ? (
          <div className="flex flex-col gap-3 p-6">
            <DialogTitle className="sr-only">Carregando card</DialogTitle>
            <Skeleton className="h-6 w-2/3" /><Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {/* capa em banner (cor ou imagem) com etiqueta da lista + botão de capa */}
            <div className="relative w-full shrink-0">
              {capa
                ? (capaEhCor(capa)
                    ? <div style={{ background: capa }} className="h-32 w-full" />
                    : <img src={capa} alt="" className="h-44 w-full object-cover" />)
                : <div className="h-12 w-full bg-secondary/40" />}
              {listaNome && (
                <span className="absolute left-4 top-3 inline-flex items-center rounded-md bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">{listaNome}</span>
              )}
              <button onClick={() => setPainel(painel === 'capa' ? null : 'capa')} title="Capa"
                className="absolute right-12 top-3 grid size-7 place-items-center rounded-md bg-black/55 text-white backdrop-blur-sm hover:bg-black/75"><ImageIcon className="size-4" /></button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* principal (scroll próprio) */}
              <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
                <DialogTitle className="pr-8">
                  <input key={c.nome} defaultValue={c.nome} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.nome) salvar({ nome: v }); }}
                    className="w-full rounded-md bg-transparent text-xl font-semibold leading-snug outline-none focus:bg-secondary/40 focus:px-2 focus:py-1" />
                </DialogTitle>

                {/* chips de props (quando preenchidos) */}
                {(temMem || temEt || c.prazo) && (
                  <div className="flex flex-wrap gap-4">
                    {temMem && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase text-muted-foreground">Membros</span>
                        <div className="flex flex-wrap gap-1">
                          {memUsuarios.map((u) => <AvatarMembro key={u.id} membro={u} className="size-7 text-[11px]" />)}
                        </div>
                      </div>
                    )}
                    {temEt && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase text-muted-foreground">Etiquetas</span>
                        <div className="flex flex-wrap gap-1">
                          {(c.etiquetas ?? []).filter((e) => e.nome || e.cor).map((e, i) => (
                            <span key={i} className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold', corEtiquetaSolida(e.cor))}>
                              {e.nome || '—'}<button onClick={() => removerEtiqueta(i)} className="opacity-70 hover:opacity-100"><X className="size-3" /></button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {c.prazo && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase text-muted-foreground">Data</span>
                        <span className={cn('inline-flex w-fit items-center gap-1 rounded px-2 py-0.5 text-xs font-medium', corPrazoCard(c.prazo, c.concluido))}>{prazoBR(c.prazo)}{c.concluido ? ' ✓' : ''}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* barra de ações */}
                <div className="flex flex-wrap gap-2">
                  <AcaoBtn icon={Users} label="Membros" onClick={() => setPainel(painel === 'membros' ? null : 'membros')} />
                  <AcaoBtn icon={Tag} label="Etiquetas" onClick={() => setPainel(painel === 'etiquetas' ? null : 'etiquetas')} />
                  {!ehPost && (
                    <>
                      <AcaoBtn icon={Calendar} label="Datas" onClick={() => setPainel(painel === 'datas' ? null : 'datas')} />
                      <AcaoBtn icon={CheckSquare} label="Checklist" onClick={() => addChecklist('Checklist')} />
                      <AcaoBtn icon={Paperclip} label="Anexo" onClick={() => fileRef.current?.click()} />
                      <AcaoBtn icon={ImageIcon} label="Capa" onClick={() => setPainel(painel === 'capa' ? null : 'capa')} />
                    </>
                  )}
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} />
                </div>

                {/* painel ativo (popover inline estilo Trello) */}
                {painel && (
                  <div className="rounded-md border border-border bg-background/60 p-3">
                    {painel === 'membros' && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold">Membros</span>
                        <div className="flex flex-wrap gap-1.5">
                          {equipe.map((u) => {
                            const ativo = (c.membros_ids ?? []).includes(u.id);
                            return (
                              <button key={u.id} onClick={() => toggleMembro(u.id)} className={cn('inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition-colors', ativo ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}>
                                <AvatarMembro membro={u} className="size-5 text-[9px]" />{u.nome}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {painel === 'etiquetas' && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold">Etiquetas</span>
                        {labelsRestantes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {labelsRestantes.map((e, i) => (
                              <button key={i} onClick={() => addEtiqueta(e)} className={cn('rounded px-2 py-0.5 text-xs font-semibold', corEtiquetaSolida(e.cor))}>{e.nome || '+'}</button>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                          <span className="text-[10px] uppercase text-muted-foreground">Nova etiqueta</span>
                          <input value={novaEtNome} onChange={(e) => setNovaEtNome(e.target.value)} placeholder="nome (opcional)" className={inputCls} />
                          <div className="flex flex-wrap gap-1">
                            {CORES_ETIQUETA.map((cor) => (
                              <button key={cor} onClick={() => setNovaEtCor(cor)} title={cor} className={cn('h-6 w-8 rounded', corEtiquetaSolida(cor), novaEtCor === cor && 'ring-2 ring-primary ring-offset-1 ring-offset-card')} />
                            ))}
                          </div>
                          <Button size="sm" variant="outline" className="h-7 w-fit text-xs" onClick={criarEtiqueta}>Criar e aplicar</Button>
                        </div>
                      </div>
                    )}
                    {painel === 'datas' && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold">Data de entrega</span>
                        <input type="date" value={(c.prazo ?? '').slice(0, 10)} onChange={(e) => salvar({ prazo: e.target.value })} className="h-8 w-fit rounded-md border border-input bg-background px-2 text-sm" />
                        <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={!!c.concluido} onChange={(e) => salvar({ concluido: e.target.checked })} /> concluído</label>
                        {c.prazo && <button onClick={() => salvar({ prazo: '' })} className="w-fit text-xs text-destructive hover:underline">Remover data</button>}
                      </div>
                    )}
                    {painel === 'capa' && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold">Capa</span>
                        <div className="flex flex-wrap gap-1.5">
                          {CORES_CAPA.map((hex) => (
                            <button key={hex} onClick={() => salvar({ capa: hex })} style={{ background: hex }} className={cn('h-9 w-14 rounded', c.capa === hex && 'ring-2 ring-primary ring-offset-1 ring-offset-card')} />
                          ))}
                        </div>
                        {imgs.length > 0 && <span className="text-[11px] text-muted-foreground">Pra usar uma imagem como capa, passe o mouse numa imagem em Anexos e clique no ícone.</span>}
                        {c.capa && <button onClick={() => salvar({ capa: '' })} className="w-fit text-xs text-destructive hover:underline">Remover capa</button>}
                      </div>
                    )}
                  </div>
                )}

                {/* Seção Post (apenas em cards de lista-mês) */}
                {ehPost && (
                  <div className="flex flex-col gap-4 rounded-md border border-border bg-background/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <CalendarDays className="size-3.5" /> Post
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewAberto(true)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        👁 Pré-visualizar
                      </button>
                    </div>

                    {/* Cabeçalho do post: Tipo + Data e hora */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Tipo de post</span>
                        <select
                          value={c.formato ?? ''}
                          onChange={(e) => salvar({ formato: e.target.value as Cartao['formato'] })}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                          <option value="">— selecione —</option>
                          {FORMATOS_POST.map((f) => (
                            <option key={f} value={f}>{TIPO_POST_LABEL[f] ?? f}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Data e hora do post</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            value={dpDateStr}
                            onChange={(e) => salvarDataPost(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                          />
                          <input
                            type="time"
                            value={dpTimeStr}
                            disabled={!dpDateStr}
                            onChange={(e) => {
                              if (!dpDateStr) return;
                              salvar({ data_post: `${dpDateStr} ${e.target.value || '00:00'}:00` });
                            }}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40"
                          />
                          {dpDateStr && (
                            <button onClick={() => salvar({ data_post: '' })} className="text-xs text-destructive hover:underline">Remover</button>
                          )}
                        </div>
                      </div>
                    </div>

                    {alertaAgendar(c) && (
                      <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400">
                        ⚠ Falta agendar — publica em breve
                      </div>
                    )}

                    {/* ── Esteira de produção ── */}
                    {(c.etapas_card ?? []).length > 0 && (() => {
                      const etapas = c.etapas_card!;
                      const idxAtual = etapas.findIndex((e) => !e.feito);
                      return (
                        <div className="flex flex-col gap-1">
                          <span className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Esteira de produção</span>
                          {etapas.map((etapa, idx) => {
                            const isAtual = idx === idxAtual;
                            const isFutura = idx > idxAtual && idxAtual !== -1;
                            return (
                              <div
                                key={etapa.id}
                                className={cn(
                                  'flex gap-3 rounded-md transition-colors',
                                  isAtual ? 'border border-primary/40 bg-primary/5 p-3' : 'px-1 py-1.5',
                                  isFutura && 'opacity-50',
                                )}
                              >
                                {/* Bolinha */}
                                <div className={cn(
                                  'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                                  etapa.feito
                                    ? 'bg-emerald-500 text-white'
                                    : isAtual
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-secondary text-muted-foreground',
                                )}>
                                  {etapa.feito ? '✓' : idx + 1}
                                </div>

                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className={cn(
                                      'text-sm font-medium',
                                      isFutura && 'text-muted-foreground',
                                    )}>{etapa.texto}</span>
                                    {etapa.feito && (
                                      <span className="text-[10px] text-muted-foreground">
                                        ✓ por {etapa.feito_por
                                          ? (equipe.find((u) => u.id === etapa.feito_por)?.nome ?? (etapa.feito_por === 'cliente' ? 'cliente' : etapa.feito_por))
                                          : '?'}
                                        {etapa.veredito === 'reprovado' && (
                                          <span className="ml-1 text-red-400">· reprovado{etapa.motivo ? `: ${etapa.motivo}` : ''}</span>
                                        )}
                                      </span>
                                    )}
                                  </div>

                                  {/* Ação inline da etapa atual */}
                                  {isAtual && (
                                    <div className="flex flex-col gap-2">
                                      {/* COPY → Orientações para o design + Legenda + Hashtags */}
                                      {etapa.texto === 'Copy' && (
                                        <>
                                          {/* Referência/Modelo (opcional, 1º item) */}
                                          <div className="flex flex-col gap-1">
                                            <span className="text-xs text-muted-foreground">Referência/Modelo <span className="text-[10px] text-muted-foreground/60">(opcional)</span></span>
                                            <input
                                              defaultValue={c.referencia ?? ''}
                                              onBlur={(e) => { const v = e.target.value; if (v !== (c.referencia ?? '')) salvar({ referencia: v }); }}
                                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                                              placeholder="https://… (link ou modelo de referência)"
                                            />
                                          </div>
                                          {/* Descrição / orientações com formatação + auto-crescer */}
                                          <div className="flex flex-col gap-1">
                                            <span className="text-xs text-muted-foreground">Orientações para o design</span>
                                            <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/60 p-1">
                                              <select defaultValue="" onChange={(e) => { if (e.target.value !== '') definirTitulo(Number(e.target.value)); e.target.value = ''; }}
                                                className="h-7 rounded border border-input bg-background px-1 text-xs" title="Título">
                                                <option value="" disabled>Aa</option>
                                                <option value="0">Texto normal</option>
                                                <option value="1">Título 1</option>
                                                <option value="2">Título 2</option>
                                                <option value="3">Título 3</option>
                                              </select>
                                              <button type="button" onClick={() => envolverSel('**', '**')} title="Negrito" className="grid size-7 place-items-center rounded hover:bg-secondary"><Bold className="size-3.5" /></button>
                                              <button type="button" onClick={() => envolverSel('*', '*')} title="Itálico" className="grid size-7 place-items-center rounded hover:bg-secondary"><Italic className="size-3.5" /></button>
                                              <button type="button" onClick={() => prefixarLinhas('- ')} title="Lista" className="grid size-7 place-items-center rounded hover:bg-secondary"><List className="size-3.5" /></button>
                                              <button type="button" onClick={inserirLink} title="Link" className="grid size-7 place-items-center rounded hover:bg-secondary"><Link2 className="size-3.5" /></button>
                                            </div>
                                            <textarea
                                              ref={descTextRef}
                                              rows={4}
                                              value={descRasc}
                                              onChange={(e) => { setDescRasc(e.target.value); autoGrow(e.target); }}
                                              onBlur={(e) => { const v = e.target.value; if (v !== (c.descricao ?? '')) salvar({ descricao: v }); }}
                                              className="w-full resize-none overflow-hidden rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                                              placeholder={ORIENTACOES_DESIGN_TEMPLATE}
                                            />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs text-muted-foreground">Legenda</span>
                                              <span className={cn('text-[10px] tabular-nums', legendaLocal.length > 2200 ? 'text-red-400' : legendaLocal.length > 1800 ? 'text-amber-400' : 'text-muted-foreground')}>
                                                {legendaLocal.length} / 2.200
                                              </span>
                                            </div>
                                            <textarea
                                              rows={5}
                                              value={legendaLocal}
                                              onChange={(e) => setLegendaLocal(e.target.value)}
                                              onBlur={(e) => { const v = e.target.value; if (v !== (c.legenda ?? '')) salvar({ legenda: v }); }}
                                              className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                                              placeholder="Escreva a legenda do post…"
                                            />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <span className="text-xs text-muted-foreground">Hashtags <span className="text-[10px] text-muted-foreground/60">(último parágrafo)</span></span>
                                            <textarea
                                              rows={2}
                                              value={hashtagsLocal}
                                              onChange={(e) => setHashtagsLocal(e.target.value)}
                                              onBlur={(e) => { const v = e.target.value; if (v !== (c.hashtags ?? '')) salvar({ hashtags: v }); }}
                                              className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                                              placeholder="#hashtag1 #hashtag2 …"
                                            />
                                          </div>
                                          <Button
                                            size="sm"
                                            className="h-7 w-fit text-xs"
                                            disabled={!descRasc.trim() || !legendaLocal.trim() || !hashtagsLocal.trim()}
                                            onClick={() => handleConfirmarEtapa(idx)}
                                          >
                                            ✓ Confirmar Copy
                                          </Button>
                                          {(!descRasc.trim() || !legendaLocal.trim() || !hashtagsLocal.trim()) && (
                                            <span className="text-[10px] text-amber-400">
                                              Preencha {[!descRasc.trim() && 'orientações', !legendaLocal.trim() && 'legenda', !hashtagsLocal.trim() && 'hashtags'].filter(Boolean).join(', ')} para confirmar.
                                            </span>
                                          )}
                                        </>
                                      )}

                                      {/* LAYOUT → conteúdo da Copy (read-only) + atalho de anexo */}
                                      {etapa.texto === 'Layout' && (
                                        <>
                                          {((c.referencia ?? '').trim() || (c.descricao ?? '').trim() || (c.legenda ?? '').trim() || (c.hashtags ?? '').trim()) && (
                                            <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 p-2.5">
                                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Conteúdo da Copy (social media)</span>
                                              {(c.referencia ?? '').trim() && (
                                                <div className="flex flex-col gap-0.5">
                                                  <span className="text-[11px] text-muted-foreground">Referência/Modelo</span>
                                                  {/^https?:\/\//.test(c.referencia!.trim())
                                                    ? <a href={c.referencia!.trim()} target="_blank" rel="noreferrer" className="break-all text-xs text-primary hover:underline">{c.referencia}</a>
                                                    : <p className="whitespace-pre-wrap text-sm">{c.referencia}</p>}
                                                </div>
                                              )}
                                              {(c.descricao ?? '').trim() && (
                                                <div className="flex flex-col gap-0.5">
                                                  <span className="text-[11px] text-muted-foreground">Orientações para o design</span>
                                                  <div className="rounded-md bg-background/60 p-2 text-sm"><Markdown>{c.descricao!}</Markdown></div>
                                                </div>
                                              )}
                                              {(c.legenda ?? '').trim() && (
                                                <div className="flex flex-col gap-0.5">
                                                  <span className="text-[11px] text-muted-foreground">Legenda</span>
                                                  <p className="whitespace-pre-wrap text-sm">{c.legenda}</p>
                                                </div>
                                              )}
                                              {(c.hashtags ?? '').trim() && (
                                                <div className="flex flex-col gap-0.5">
                                                  <span className="text-[11px] text-muted-foreground">Hashtags</span>
                                                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{c.hashtags}</p>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          <p className="text-xs text-muted-foreground">Anexe a arte final do layout e confirme.</p>
                                          <button
                                            onClick={() => fileRef.current?.click()}
                                            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"
                                          >
                                            <Paperclip className="size-3.5" /> Anexar arte
                                          </button>
                                          <Button
                                            size="sm"
                                            className="h-7 w-fit text-xs"
                                            onClick={() => handleConfirmarEtapa(idx)}
                                          >
                                            ✓ Confirmar Layout
                                          </Button>
                                        </>
                                      )}

                                      {/* REVISÃO INTERNA / APROVAÇÃO DO CLIENTE → abrir tela de revisão */}
                                      {(etapa.texto === 'Revisão interna' || etapa.texto === 'Aprovação do cliente') && (
                                        <div className="flex flex-col gap-1.5">
                                          <p className="text-xs text-muted-foreground">
                                            Use a tela de revisão para aprovar ou reprovar todos os posts do mês de uma vez.
                                          </p>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 w-fit text-xs gap-1.5"
                                            onClick={abrirRevisao}
                                          >
                                            🔗 Abrir tela de revisão
                                          </Button>
                                        </div>
                                      )}

                                      {/* CONFIRMAÇÃO DE AGENDAMENTO → data/hora */}
                                      {etapa.texto === 'Confirmação de agendamento' && (
                                        <>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <input
                                              type="date"
                                              value={dpDateStr}
                                              onChange={(e) => {
                                                const d = e.target.value;
                                                if (!d) { salvar({ data_post: '' }); return; }
                                                salvar({ data_post: `${d} ${dpTimeStr || '00:00'}:00` });
                                              }}
                                              className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                                            />
                                            <input
                                              type="time"
                                              value={dpTimeStr}
                                              disabled={!dpDateStr}
                                              onChange={(e) => {
                                                if (!dpDateStr) return;
                                                salvar({ data_post: `${dpDateStr} ${e.target.value || '00:00'}:00` });
                                              }}
                                              className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40"
                                            />
                                          </div>
                                          <Button
                                            size="sm"
                                            className="h-7 w-fit text-xs"
                                            disabled={!dpDateStr}
                                            onClick={() => handleConfirmarEtapa(idx)}
                                          >
                                            ✓ Confirmar agendamento
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Descrição (cards normais; em post as orientações ficam na etapa Copy) */}
                {!ehPost && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><FileText className="size-3.5" /> Descrição</span>
                    {!editandoDesc && (c.descricao ?? '').trim() && (
                      <button onClick={() => { setDescRasc(c.descricao ?? ''); setEditandoDesc(true); }} className="rounded-md bg-secondary px-3 py-1 text-xs font-medium hover:bg-secondary/70">Editar</button>
                    )}
                  </div>
                  {editandoDesc ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/60 p-1">
                        <select defaultValue="" onChange={(e) => { if (e.target.value !== '') definirTitulo(Number(e.target.value)); e.target.value = ''; }}
                          className="h-7 rounded border border-input bg-background px-1 text-xs" title="Título">
                          <option value="" disabled>Aa</option>
                          <option value="0">Texto normal</option>
                          <option value="1">Título 1</option>
                          <option value="2">Título 2</option>
                          <option value="3">Título 3</option>
                        </select>
                        <button onClick={() => envolverSel('**', '**')} title="Negrito" className="grid size-7 place-items-center rounded hover:bg-secondary"><Bold className="size-3.5" /></button>
                        <button onClick={() => envolverSel('*', '*')} title="Itálico" className="grid size-7 place-items-center rounded hover:bg-secondary"><Italic className="size-3.5" /></button>
                        <button onClick={() => prefixarLinhas('- ')} title="Lista" className="grid size-7 place-items-center rounded hover:bg-secondary"><List className="size-3.5" /></button>
                        <button onClick={inserirLink} title="Link" className="grid size-7 place-items-center rounded hover:bg-secondary"><Link2 className="size-3.5" /></button>
                      </div>
                      <textarea ref={descTextRef} autoFocus value={descRasc} rows={10} onChange={(e) => setDescRasc(e.target.value)} className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={() => { salvar({ descricao: descRasc }); setEditandoDesc(false); }}>Salvar</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDescRasc(c.descricao ?? ''); setEditandoDesc(false); }}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (c.descricao ?? '').trim() ? (
                    <div className="relative">
                      <div ref={descRef} className={cn('rounded-md', !descExpandida && 'max-h-[296px] overflow-hidden')}>
                        <Markdown>{c.descricao!}</Markdown>
                      </div>
                      {!descExpandida && descTransborda && <div className="pointer-events-none absolute inset-x-0 bottom-9 h-12 bg-gradient-to-t from-card to-transparent" />}
                      {descTransborda && (
                        <button onClick={() => setDescExpandida((v) => !v)} className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-border bg-background/40 py-1.5 text-xs text-muted-foreground hover:bg-secondary">
                          <ChevronDown className={cn('size-4 transition-transform', descExpandida && 'rotate-180')} /> {descExpandida ? 'Mostrar menos' : 'Mostrar mais'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => { setDescRasc(''); setEditandoDesc(true); }} className="rounded-md border border-border bg-background/40 p-3 text-left text-sm text-muted-foreground hover:border-primary/40">Adicionar uma descrição…</button>
                  )}
                </div>
                )}

                {/* Checklists */}
                {(c.checklists ?? []).length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><CheckSquare className="size-3.5" /> Checklists ({prog.feitos}/{prog.total})</div>
                    <div className="flex flex-col gap-4">
                      {(c.checklists ?? []).map((ch, ci) => (
                        <div key={ci} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            {ch.nome && <p className="text-sm font-medium">{ch.nome}</p>}
                            <button onClick={() => removerChecklist(ci)} className="text-muted-foreground hover:text-destructive" title="Remover checklist"><Trash2 className="size-3.5" /></button>
                          </div>
                          <ul className="flex flex-col gap-1">
                            {ch.itens.map((it, ii) => (
                              <li key={ii} className="group flex items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-secondary/40">
                                <button onClick={() => toggleItem(ci, ii)} className="flex flex-1 items-start gap-2 text-left">
                                  <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px]', it.feito ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-border')}>{it.feito ? '✓' : ''}</span>
                                  <span className={cn(it.feito && 'text-muted-foreground line-through')}>{it.texto}</span>
                                </button>
                                <button onClick={() => removerItem(ci, ii)} className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
                              </li>
                            ))}
                          </ul>
                          <input value={novoItem[ci] ?? ''} onChange={(e) => setNovoItem((m) => ({ ...m, [ci]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addItem(ci); }} placeholder="+ adicionar item" className="h-7 rounded border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Anexos — estilo Trello: miniatura + nome + data, com botão Adicionar */}
                {anexosView.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Paperclip className="size-3.5" /> Anexos</div>
                      <div className="relative">
                        <button onClick={() => setAnexarAberto((v) => !v)} className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary/70">Adicionar</button>
                        {anexarAberto && (
                          <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-border bg-popover p-3 shadow-xl">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-semibold">Anexar</span>
                              <button onClick={() => setAnexarAberto(false)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
                            </div>
                            <p className="mb-1 text-xs font-medium">Anexe um arquivo do seu computador</p>
                            <button onClick={() => fileRef.current?.click()} className="mb-3 w-full rounded-md border border-border py-1.5 text-sm transition-colors hover:bg-secondary">Escolher um arquivo</button>
                            <div className="mb-1 text-xs font-medium">Cole um link</div>
                            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Cole um link aqui…" className={inputCls} />
                            <div className="mb-1 mt-2 text-xs font-medium">Texto para exibição (opcional)</div>
                            <input value={linkTexto} onChange={(e) => setLinkTexto(e.target.value)} placeholder="Texto a ser exibido" className={inputCls} />
                            <div className="mt-3 flex justify-end gap-2">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setAnexarAberto(false); setLinkUrl(''); setLinkTexto(''); }}>Cancelar</Button>
                              <Button size="sm" className="h-7 text-xs" disabled={!linkUrl.trim()} onClick={inserirLinkAnexo}>Inserir</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Arquivos</div>
                    <div className="flex flex-col gap-0.5">
                      {anexosView.map((a, i) => (
                        <div key={i} className="group flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-secondary/40">
                          {a.img ? (
                            <a href={a.url} target="_blank" rel="noreferrer" className="shrink-0"><img src={a.url} alt={a.nome ?? ''} loading="lazy" className={cn('size-12 rounded-md border border-border object-cover', c.capa === a.url && 'ring-2 ring-primary')} /></a>
                          ) : (
                            <a href={a.url} target="_blank" rel="noreferrer" className="grid size-12 shrink-0 place-items-center rounded-md border border-border bg-secondary text-[10px] font-bold text-muted-foreground">{extDe(a.nome, a.url)}</a>
                          )}
                          <div className="min-w-0 flex-1">
                            <a href={a.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline">{a.nome || a.url}</a>
                            {a.created && <div className="text-xs text-muted-foreground">Adicionado em {fmtData(a.created)}</div>}
                          </div>
                          <a href={a.url} target="_blank" rel="noreferrer" title="Abrir" className="shrink-0 rounded p-1.5 text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-foreground group-hover:opacity-100"><ExternalLink className="size-4" /></a>
                          {a.img && (
                            <button
                              onClick={() => salvar({ capa: c.capa === a.url ? '' : a.url })}
                              title={c.capa === a.url ? 'Remover como capa' : 'Definir como capa'}
                              className={cn('inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition', c.capa === a.url ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-secondary hover:text-foreground')}
                            >
                              <ImageIcon className="size-3.5" />{c.capa === a.url ? 'Capa ✓' : 'Definir capa'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button onClick={arquivar} className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"><Archive className="size-3.5" /> Arquivar</button>
                  <button onClick={excluirCard} className="inline-flex w-fit items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"><Trash2 className="size-3.5" /> Excluir</button>
                </div>
              </div>

              {/* coluna direita: comentários/atividade (input fixo, lista rola — estilo Trello) */}
              <div className="flex max-h-full w-full shrink-0 flex-col gap-3 border-t border-border p-5 md:w-80 md:border-l md:border-t-0">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><MessageSquare className="size-3.5" /> Comentários e atividade ({comentarios.filter((cm) => !ehAtividade(cm.texto)).length})</div>
                <textarea value={novoComent} onChange={(e) => setNovoComent(e.target.value)} rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComentario(); } }} placeholder="Escrever um comentário…" className="w-full resize-none rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
                {novoComent.trim() && <Button size="sm" className="h-7 w-fit text-xs" onClick={enviarComentario}>Comentar</Button>}
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                  {comentarios.map((cm) => (
                    ehAtividade(cm.texto) ? (
                      <div key={cm.id} className="flex items-start gap-2 px-1 py-0.5 text-xs text-muted-foreground">
                        <History className="mt-0.5 size-3.5 shrink-0 opacity-60" />
                        <p className="leading-snug">
                          <span className="font-medium text-foreground/70">{cm.expand?.autor?.nome ?? 'Alguém'}</span> {textoAtividade(cm.texto)}
                          {cm.created && <span className="opacity-60"> · {fmtData(cm.created)}</span>}
                        </p>
                      </div>
                    ) : (
                      <div key={cm.id} className="rounded-md border border-border bg-background/40 p-2 text-sm">
                        <div className="mb-0.5 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">{cm.expand?.autor?.nome ?? 'Alguém'}</span>
                          <button onClick={() => apagarComentario(cm.id)} className="hover:text-destructive"><Trash2 className="size-3" /></button>
                        </div>
                        <p className="whitespace-pre-wrap">{cm.texto}</p>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

    {c && previewAberto && (
      <PreviewPost
        aberto={previewAberto}
        onClose={() => setPreviewAberto(false)}
        cartao={c}
        clienteId={clienteId}
      />
    )}
    </>
  );
}
