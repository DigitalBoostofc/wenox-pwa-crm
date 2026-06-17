import { useCallback, useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Phone, Pencil, Activity,
  Users, KeyRound, FileText, LayoutDashboard, FolderKanban,
  CheckSquare, Wallet, Trash2,
} from 'lucide-react';
import { getCliente, updateCliente, deleteCliente, logoUrl } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';
import { nomeExibicao, telefonePrincipal } from '@/clientes/types';
import { ContatosTab } from '@/contatos/ContatosTab';
import { AcessosTab } from '@/acessos/AcessosTab';
import { DocumentosTab } from '@/documentos/DocumentosTab';
import { ProjetosTabCliente } from '@/projetos/ProjetosTabCliente';
import { TarefasTabCliente } from '@/tarefas/TarefasTabCliente';
import { listProjetos } from '@/projetos/projetosService';
import { listTarefas } from '@/tarefas/tarefasService';
import type { Projeto } from '@/projetos/types';
import type { Tarefa } from '@/tarefas/types';
import { tarefaConcluida, prazoVencido, prazoBR } from '@/tarefas/format';
import { CriarAcessoCliente } from '@/clientes/CriarAcessoCliente';
import { useAuth } from '@/auth/useAuth';
import { ehCliente, canCriarAcessoCliente } from '@/auth/perms';
import { AtividadeFeed } from '@/atividade/AtividadeFeed';
import { cn } from '@/lib/utils';
import { statusVariant, haDias, dataBR, corAvatar, inicial } from '@/clientes/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Linha({
  rotulo, valor, children,
}: { rotulo: string; valor?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <span className="shrink-0 pt-0.5 text-sm text-muted-foreground">{rotulo}</span>
      <div className="text-right text-sm font-medium">
        {children ?? valor}
      </div>
    </div>
  );
}

type Aba =
  | 'visao' | 'acessos' | 'projetos' | 'tarefas'
  | 'financeiro' | 'documentos' | 'equipe';
const ABAS: { id: Aba; label: string; icon: typeof Users; emBreve?: boolean }[] = [
  { id: 'visao', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'acessos', label: 'Acessos', icon: KeyRound },
  { id: 'projetos', label: 'Projetos', icon: FolderKanban },
  { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet, emBreve: true },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'equipe', label: 'Equipe', icon: Users },
];

/** Mini-stat do resumo (número grande + rótulo). */
function Stat({ valor, rotulo, tom }: { valor: number; rotulo: string; tom?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <p className={cn('text-xl font-bold leading-none', tom)}>{valor}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{rotulo}</p>
    </div>
  );
}

/** Resumo funcional de projetos e tarefas do cliente (aba Visão Geral). */
function ResumoAtividades({
  clienteId, onVerProjetos, onVerTarefas,
}: {
  clienteId: string;
  onVerProjetos: () => void;
  onVerTarefas: () => void;
}) {
  const history = useHistory();
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!clienteId) return;
    let vivo = true;
    setCarregando(true);
    Promise.all([
      listProjetos({ clienteId }).catch(() => []),
      listTarefas({ clienteId }).catch(() => []),
    ]).then(([ps, ts]) => {
      if (!vivo) return;
      setProjetos(ps);
      setTarefas(ts);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [clienteId]);

  const projAtivos = projetos.filter((p) => p.status !== 'Inativo').length;
  const tarefasAbertas = tarefas.filter((t) => !tarefaConcluida(t.status));
  const concluidas = tarefas.length - tarefasAbertas.length;
  const atrasadas = tarefasAbertas.filter((t) => prazoVencido(t.prazo, t.status)).length;

  // Tarefas abertas mais urgentes (por prazo) para um preview curto.
  const urgentes = [...tarefasAbertas]
    .sort((a, b) => {
      const pa = a.prazo ? new Date(a.prazo).getTime() : Infinity;
      const pb = b.prazo ? new Date(b.prazo).getTime() : Infinity;
      return pa - pb;
    })
    .slice(0, 4);

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando atividades…</p>;
  }

  if (projetos.length === 0 && tarefas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum projeto ou tarefa cadastrado para este cliente ainda.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat valor={projetos.length} rotulo={projetos.length === 1 ? 'Projeto' : 'Projetos'} />
        <Stat valor={projAtivos} rotulo="Ativos" tom="text-emerald-400" />
        <Stat valor={tarefasAbertas.length} rotulo="Tarefas abertas" />
        <Stat valor={atrasadas} rotulo="Atrasadas" tom={atrasadas > 0 ? 'text-destructive' : undefined} />
      </div>

      {/* Projetos (preview) */}
      {projetos.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Projetos</span>
            <button type="button" onClick={onVerProjetos} className="text-xs text-primary hover:underline">Ver todos</button>
          </div>
          <div className="flex flex-col divide-y divide-border/40 overflow-hidden rounded-lg border border-border">
            {projetos.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => history.push(`/projetos/${p.id}`)}
                className="flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary/50"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{p.nome}</span>
                {p.status && (
                  <Badge variant={statusVariant(p.status)} className="shrink-0 text-[10px]">{p.status}</Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tarefas abertas (preview) */}
      {tarefasAbertas.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Tarefas abertas{concluidas > 0 ? ` · ${concluidas} concluída${concluidas === 1 ? '' : 's'}` : ''}
            </span>
            <button type="button" onClick={onVerTarefas} className="text-xs text-primary hover:underline">Ver todas</button>
          </div>
          <div className="flex flex-col divide-y divide-border/40 overflow-hidden rounded-lg border border-border">
            {urgentes.map((t) => {
              const vencida = prazoVencido(t.prazo, t.status);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={onVerTarefas}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-secondary/50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{t.nome}</span>
                  {t.prazo && (
                    <span className={cn('shrink-0 text-[11px]', vencida ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      {prazoBR(t.prazo)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClienteDetailPage({ id: idProp }: { id?: string } = {}) {
  const params = useParams<{ id?: string }>();
  const id = idProp ?? params.id ?? '';
  const history = useHistory();
  const { user } = useAuth();
  const souCliente = ehCliente(user?.role);
  const [c, setC] = useState<Cliente | null>(null);
  const [aba, setAba] = useState<Aba>('visao');
  const [trocandoFoto, setTrocandoFoto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    if (!id) { setCarregando(false); return; }
    setCarregando(true);
    setErro('');
    try {
      setC(await getCliente(id));
    } catch {
      setErro('Não foi possível carregar o cliente. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function apagar() {
    if (!c) return;
    if (!confirm(`Apagar o cliente "${nomeExibicao(c)}" definitivamente? Esta ação não pode ser desfeita.`)) return;
    await deleteCliente(c.id);
    history.push('/clientes');
  }

  async function trocarFoto(file: File | null) {
    if (!file || !c) return;
    setTrocandoFoto(true);
    try {
      await updateCliente(c.id, {}, file);
      setC(await getCliente(c.id));
    } finally {
      setTrocandoFoto(false);
    }
  }

  if (carregando) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Carregando…
      </p>
    );
  }

  if (erro || !c) {
    return (
      <div className="flex flex-col gap-4">
        {!souCliente && (
          <Button variant="ghost" size="sm" onClick={() => history.push('/clientes')}>
            <ArrowLeft /> Clientes
          </Button>
        )}
        <Card className="px-5 py-8 text-center">
          <p className="text-sm text-destructive">{erro || 'Cliente não encontrado.'}</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={carregar}>
            Tentar novamente
          </Button>
        </Card>
      </div>
    );
  }

  const nome = nomeExibicao(c);
  const telPrincipal = telefonePrincipal(c);
  const wpp = `https://wa.me/${telPrincipal.replace(/\D/g, '')}`;
  const clienteDesde = dataBR(c.data_inicio) || dataBR(c.created);
  const telefones = (c.telefones ?? []).filter((t) => t.valor?.trim());
  const emails = (c.emails ?? []).filter((e) => e.valor?.trim());

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-4">
        {!souCliente && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => history.push('/clientes')}
            aria-label="Voltar"
          >
            <ArrowLeft />
          </Button>
        )}
        <div className="relative size-14 shrink-0">
          <div
            className={cn(
              'grid size-14 place-items-center overflow-hidden rounded-2xl text-lg font-bold text-white',
              !c.logo && corAvatar(nome),
            )}
          >
            {c.logo ? (
              <img src={logoUrl(c, '200x200')} alt={nome}
                loading="lazy" decoding="async"
                className="size-full object-cover" />
            ) : (
              inicial(nome)
            )}
          </div>
          {!souCliente && (
            <label
              title="Trocar foto"
              className="absolute -bottom-1 -right-1 grid size-6 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground shadow hover:text-foreground"
            >
              <Pencil className="size-3" />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={trocandoFoto}
                onChange={(e) => trocarFoto(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{nome}</h2>
          {c.nome && c.nome_fantasia && c.nome_fantasia !== c.nome && (
            <p className="text-sm text-muted-foreground">{c.nome_fantasia}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            {c.status && (
              <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
            )}
            {clienteDesde && <span>Cliente desde {clienteDesde}</span>}
          </div>
        </div>
        {telPrincipal && (
          <Button asChild size="sm" variant="outline">
            <a href={wpp} target="_blank" rel="noopener" aria-label="WhatsApp">
              <MessageCircle /> WhatsApp
            </a>
          </Button>
        )}
        {telPrincipal && (
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${telPrincipal}`} aria-label="Ligar">
              <Phone /> Ligar
            </a>
          </Button>
        )}
        {!souCliente && canCriarAcessoCliente(user?.role) && (
          <CriarAcessoCliente
            clienteId={c.id}
            clienteNome={nome}
            emailSugerido={emails[0]?.valor}
          />
        )}
        {!souCliente && (
          <Button
            size="sm"
            variant="ghost"
            onClick={apagar}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 /> Apagar
          </Button>
        )}
        {!souCliente && (
          <Button
            size="sm"
            onClick={() => history.push(`/clientes/${c.id}/editar`)}
          >
            <Pencil /> Editar
          </Button>
        )}
      </div>

      {/* Guias */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {ABAS.filter((t) => !souCliente || (t.id !== 'acessos' && t.id !== 'equipe')).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                aba === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {t.label}
              {t.emBreve && (
                <span className="ml-1 rounded-full border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                  em breve
                </span>
              )}
            </button>
          );
        })}
      </div>

      {aba === 'visao' && (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Principais informações</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                <Linha rotulo="Categoria" valor={c.categoria} />
                {c.nome && c.nome_fantasia && c.nome_fantasia !== c.nome && (
                  <Linha rotulo="Nome fantasia" valor={c.nome_fantasia} />
                )}
                {c.razao_social && (
                  <Linha rotulo="Razão social" valor={c.razao_social} />
                )}
                {c.cnpj && <Linha rotulo="CPF / CNPJ" valor={c.cnpj} />}
                {telefones.length > 0 ? (
                  <Linha rotulo={telefones.length > 1 ? 'Telefones' : 'Telefone'}>
                    <div className="flex flex-col gap-1">
                      {telefones.map((t, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {t.tipo && (
                            <Badge variant="muted" className="text-[10px]">{t.tipo}</Badge>
                          )}
                          <a className="text-primary hover:underline" href={`tel:${t.valor}`}>
                            {t.valor}
                          </a>
                        </div>
                      ))}
                    </div>
                  </Linha>
                ) : c.telefone ? (
                  <Linha rotulo="Telefone" valor={c.telefone} />
                ) : null}
                {emails.length > 0 ? (
                  <Linha rotulo={emails.length > 1 ? 'E-mails' : 'E-mail'}>
                    <div className="flex flex-col gap-1">
                      {emails.map((e, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {e.tipo && (
                            <Badge variant="muted" className="text-[10px]">{e.tipo}</Badge>
                          )}
                          <a className="text-primary hover:underline" href={`mailto:${e.valor}`}>
                            {e.valor}
                          </a>
                        </div>
                      ))}
                    </div>
                  </Linha>
                ) : c.email ? (
                  <Linha rotulo="E-mail" valor={c.email} />
                ) : null}
                {c.site && <Linha rotulo="Website" valor={c.site} />}
                {c.endereco && <Linha rotulo="Endereço" valor={c.endereco} />}
                {c.origem && <Linha rotulo="Origem" valor={c.origem} />}
                {(c.data_inicio || c.data_encerramento) && (
                  <Linha
                    rotulo="Período"
                    valor={`${dataBR(c.data_inicio) || '—'} → ${dataBR(c.data_encerramento) || 'ativo'}`}
                  />
                )}
                <Linha rotulo="Cadastrado" valor={haDias(c.created) || '—'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-4" /> Resumo de atividades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResumoAtividades
                  clienteId={c.id}
                  onVerProjetos={() => setAba('projetos')}
                  onVerTarefas={() => setAba('tarefas')}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Serviços contratados</CardTitle>
            </CardHeader>
            <CardContent>
              {c.servicos && c.servicos.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {c.servicos.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum serviço contratado registrado.
                </p>
              )}
            </CardContent>
          </Card>

          {(c.url_dashboard || c.url_drive || c.url_trello) && (
            <Card>
              <CardHeader>
                <CardTitle>Links</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {c.url_dashboard && (
                  <a className="block px-5 py-3.5 text-sm text-primary hover:underline"
                    href={c.url_dashboard} target="_blank" rel="noopener">Dashboard</a>
                )}
                {c.url_drive && (
                  <a className="block px-5 py-3.5 text-sm text-primary hover:underline"
                    href={c.url_drive} target="_blank" rel="noopener">Drive</a>
                )}
                {c.url_trello && (
                  <a className="block px-5 py-3.5 text-sm text-primary hover:underline"
                    href={c.url_trello} target="_blank" rel="noopener">Trello</a>
                )}
              </CardContent>
            </Card>
          )}

          {c.observacoes && (
            <Card>
              <CardHeader>
                <CardTitle>Observação</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
                {c.observacoes}
              </CardContent>
            </Card>
          )}

          <AtividadeFeed entidade="cliente" refId={c.id} />
        </div>
      )}

      {aba === 'acessos' && <AcessosTab clienteId={c.id} />}
      {aba === 'documentos' && <DocumentosTab clienteId={c.id} />}
      {aba === 'equipe' && <ContatosTab clienteId={c.id} />}
      {aba === 'projetos' && <ProjetosTabCliente clienteId={c.id} />}
      {aba === 'tarefas' && <TarefasTabCliente clienteId={c.id} />}
      {aba === 'financeiro' && <EmBreveAba aba={aba} />}
    </div>
  );
}

function EmBreveAba({ aba }: { aba: 'financeiro' }) {
  const textos = {
    financeiro: {
      titulo: 'Financeiro deste cliente',
      desc: 'Contratos, faturas e histórico de pagamentos. Disponível quando o módulo Financeiro for entregue.',
    },
  } as const;
  const t = textos[aba];
  return (
    <Card>
      <CardHeader><CardTitle>{t.titulo}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t.desc}</p>
      </CardContent>
    </Card>
  );
}
