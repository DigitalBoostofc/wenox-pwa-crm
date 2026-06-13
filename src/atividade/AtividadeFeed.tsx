import { useEffect, useState, useCallback, useRef } from 'react';
import { MessageSquare, History, Send, ImagePlus, X, CornerDownRight, AtSign, Trash2 } from 'lucide-react';
import {
  listAtividade, addComentario, removerComentario, anexoUrl, candidatosMencao,
  type Entidade, type ItemAtividade, type Comentario, type MencaoUsuario,
} from '@/atividade/atividadeService';
import { dataBR } from '@/clientes/format';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function quando(iso: string) {
  const d = new Date(iso.replace(' ', 'T'));
  const hora = Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dataBR(iso)}${hora ? ' às ' + hora : ''}`;
}

type Candidatos = { colaboradores: MencaoUsuario[]; clientes: MencaoUsuario[] };
type Sugestao = MencaoUsuario & { grupo: 'Equipe' | 'Cliente' };

/** Destaca os trechos "@Nome" das pessoas marcadas. */
function renderTexto(texto: string, nomes?: MencaoUsuario[]) {
  if (!nomes || nomes.length === 0) return texto;
  const ordenados = [...nomes].sort((a, b) => b.nome.length - a.nome.length);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('@(' + ordenados.map((n) => esc(n.nome)).join('|') + ')', 'g');
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > last) out.push(texto.slice(last, m.index));
    out.push(<span key={i++} className="font-medium text-primary">{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < texto.length) out.push(texto.slice(last));
  return out;
}

/** Campo de comentário com autocomplete de @ (e anexo opcional). */
function CampoComentario({
  candidatos, comAnexo, enviando, onEnviar, placeholder, autoFocus, labelBotao = 'Comentar',
}: {
  candidatos: Candidatos;
  comAnexo?: boolean;
  enviando: boolean;
  onEnviar: (d: { texto: string; mencionados: string[]; anexo: File | null }) => Promise<void> | void;
  placeholder: string;
  autoFocus?: boolean;
  labelBotao?: string;
}) {
  const [texto, setTexto] = useState('');
  const [mencionados, setMencionados] = useState<MencaoUsuario[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const todos: Sugestao[] = [
    ...candidatos.colaboradores.map((c) => ({ ...c, grupo: 'Equipe' as const })),
    ...candidatos.clientes.map((c) => ({ ...c, grupo: 'Cliente' as const })),
  ];
  const sugestoes = query != null
    ? todos.filter((c) => c.nome.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  function aoDigitar(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setTexto(v);
    const caret = e.target.selectionStart ?? v.length;
    const antes = v.slice(0, caret);
    const m = antes.match(/@([\p{L}\d._-]*)$/u);
    setQuery(m ? m[1] : null);
  }

  function escolher(c: Sugestao) {
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? texto.length;
    const antes = texto.slice(0, caret);
    const depois = texto.slice(caret);
    const novoAntes = antes.replace(/@([\p{L}\d._-]*)$/u, `@${c.nome} `);
    const novo = novoAntes + depois;
    setTexto(novo);
    setMencionados((prev) => (prev.some((p) => p.id === c.id) ? prev : [...prev, { id: c.id, nome: c.nome }]));
    setQuery(null);
    requestAnimationFrame(() => {
      ta?.focus();
      const pos = novoAntes.length;
      ta?.setSelectionRange(pos, pos);
    });
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const ids = mencionados.filter((m) => texto.includes('@' + m.nome)).map((m) => m.id);
    await onEnviar({ texto, mencionados: ids, anexo: arquivo });
    setTexto('');
    setMencionados([]);
    setArquivo(null);
    setQuery(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2">
      <div className="relative">
        <textarea
          ref={taRef}
          value={texto}
          onChange={aoDigitar}
          rows={2}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label="Comentário"
          className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        />
        {query != null && sugestoes.length > 0 && (
          <div className="absolute left-2 top-full z-20 mt-1 w-64 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            {sugestoes.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(ev) => { ev.preventDefault(); escolher(c); }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                <span className="truncate">{c.nome}</span>
                <span className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px]',
                  c.grupo === 'Cliente'
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-secondary text-muted-foreground',
                )}>
                  {c.grupo}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {arquivo && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImagePlus className="size-3.5" />
          <span className="min-w-0 flex-1 truncate">{arquivo.name}</span>
          <button type="button" onClick={() => { setArquivo(null); if (fileRef.current) fileRef.current.value = ''; }} aria-label="Remover imagem" className="hover:text-destructive">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <AtSign className="size-3.5" /> para marcar
          </span>
          {comAnexo && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ImagePlus className="size-4" /> Anexar imagem
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>
        <Button type="submit" size="sm" disabled={enviando || (!texto.trim() && !arquivo)}>
          <Send /> {enviando ? 'Enviando…' : labelBotao}
        </Button>
      </div>
    </form>
  );
}

/** Bloco visual de um comentário (texto + anexo + menções destacadas). */
function ComentarioBody({ c }: { c: Comentario }) {
  return (
    <>
      {c.texto && (
        <p className="whitespace-pre-wrap text-sm">{renderTexto(c.texto, c.mencionadosNomes)}</p>
      )}
      {c.anexo && (
        <a href={anexoUrl(c)} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
          <img src={anexoUrl(c, '300x0')} alt="anexo" loading="lazy" className="max-h-48 rounded-md border border-border object-cover" />
        </a>
      )}
    </>
  );
}

/** Timeline de comentários + histórico, com @menções e respostas (1 nível). */
export function AtividadeFeed({
  entidade,
  refId,
}: {
  entidade: Entidade;
  refId: string;
}) {
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const ehGestaoTotal = user?.role === 'Owner' || user?.role === 'Admin';
  const [itens, setItens] = useState<ItemAtividade[]>([]);
  const [candidatos, setCandidatos] = useState<Candidatos>({ colaboradores: [], clientes: [] });
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const podeExcluir = (c: Comentario) => c.autor === uid || ehGestaoTotal;
  async function excluir(id: string) {
    if (!window.confirm('Excluir este comentário? Esta ação não pode ser desfeita.')) return;
    setErro('');
    try {
      await removerComentario(id);
      await carregar();
    } catch {
      setErro('Não foi possível excluir o comentário.');
    }
  }

  const carregar = useCallback(async () => {
    try {
      setItens(await listAtividade(entidade, refId));
      setErro('');
    } catch {
      setErro('Não foi possível carregar a atividade.');
    } finally {
      setCarregando(false);
    }
  }, [entidade, refId]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    candidatosMencao(entidade, refId).then(setCandidatos).catch(() => { /* sem candidatos */ });
  }, [entidade, refId]);

  async function comentar(d: { texto: string; mencionados: string[]; anexo: File | null }, parent?: string) {
    setErro('');
    setEnviando(true);
    try {
      await addComentario(entidade, refId, d.texto, true, d.anexo, { mencionados: d.mencionados, parent });
      setRespondendo(null);
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao comentar');
    } finally {
      setEnviando(false);
    }
  }

  // Separa respostas (parent) dos itens de topo da timeline.
  const respostas = new Map<string, Comentario[]>();
  for (const it of itens) {
    if (it.tipo === 'comentario' && it.parent) {
      const arr = respostas.get(it.parent) ?? [];
      arr.push(it);
      respostas.set(it.parent, arr);
    }
  }
  for (const arr of respostas.values()) {
    arr.sort((a, b) => +new Date(a.created) - +new Date(b.created));
  }
  const timeline = itens.filter((it) => !(it.tipo === 'comentario' && it.parent));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-4" /> Comentários & Histórico
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CampoComentario
          candidatos={candidatos}
          comAnexo
          enviando={enviando}
          onEnviar={(d) => comentar(d)}
          placeholder="Escreva um comentário — digite @ para marcar alguém"
        />

        {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}

        {carregando ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : timeline.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma atividade ainda. Seja o primeiro a comentar.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {timeline.map((it) => {
              const reps = it.tipo === 'comentario' ? (respostas.get(it.id) ?? []) : [];
              return (
                <li key={it.id} className="flex gap-3 border-l-2 border-border pl-3">
                  <div className="mt-0.5 text-muted-foreground">
                    {it.tipo === 'comentario' ? <MessageSquare className="size-4" /> : <History className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {it.tipo === 'comentario' ? (
                      <ComentarioBody c={it} />
                    ) : (
                      <p className="text-sm text-muted-foreground">{it.acao}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {it.autorNome} · {quando(it.created)}
                    </p>

                    {it.tipo === 'comentario' && (
                      <>
                        <div className="mt-1 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setRespondendo(respondendo === it.id ? null : it.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                          >
                            <CornerDownRight className="size-3" /> Responder
                          </button>
                          {podeExcluir(it) && (
                            <button
                              type="button"
                              onClick={() => excluir(it.id)}
                              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3" /> Excluir
                            </button>
                          )}
                        </div>

                        {/* Respostas */}
                        {reps.length > 0 && (
                          <ul className="mt-2 flex flex-col gap-2 border-l border-border/60 pl-3">
                            {reps.map((r) => (
                              <li key={r.id}>
                                <ComentarioBody c={r} />
                                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <span>{r.autorNome} · {quando(r.created)}</span>
                                  {podeExcluir(r) && (
                                    <button
                                      type="button"
                                      onClick={() => excluir(r.id)}
                                      className="inline-flex items-center gap-1 hover:text-destructive"
                                    >
                                      <Trash2 className="size-3" /> Excluir
                                    </button>
                                  )}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Caixa de resposta */}
                        {respondendo === it.id && (
                          <div className="mt-2 border-l border-primary/40 pl-3">
                            <CampoComentario
                              candidatos={candidatos}
                              enviando={enviando}
                              autoFocus
                              labelBotao="Responder"
                              onEnviar={(d) => comentar(d, it.id)}
                              placeholder={`Responder ${it.autorNome}… (@ para marcar)`}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
