import { useEffect, useMemo, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { Plus, Search, FolderKanban } from 'lucide-react';
import { listProjetos } from './projetosService';
import { listEtapas } from './etapasService';
import type { Projeto, EtapaProjeto } from './types';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';
import { logoUrl } from '@/clientes/clientesService';
import { corAvatar, inicial } from '@/clientes/format';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function nomeCliente(p: Projeto): string {
  const c = p.expand?.cliente;
  if (!c) return '—';
  return (c.nome?.trim() || c.nome_fantasia || '—').trim();
}

function logoCliente(p: Projeto): string {
  const c = p.expand?.cliente;
  if (!c?.logo) return '';
  // c não é um Cliente completo; logoUrl pega o id + collectionId + logo
  return logoUrl(c as never, '100x100');
}

function iniciaisResponsavel(r?: { nome?: string; email?: string }): string {
  const n = (r?.nome ?? r?.email ?? '?').trim();
  const partes = n.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return n.charAt(0).toUpperCase() || '?';
}

function CardProjeto({
  p, etapasPorTipo, onClick,
}: {
  p: Projeto;
  etapasPorTipo: Record<string, EtapaProjeto[]>;
  onClick: () => void;
}) {
  const cliNome = nomeCliente(p);
  const logo = logoCliente(p);
  const etapas = etapasPorTipo[p.tipo ?? ''] ?? [];
  const idx = p.etapa ? etapas.findIndex((e) => e.nome === p.etapa) : -1;
  const total = etapas.length;
  const posTxt = total > 0 && idx >= 0
    ? `Etapa ${idx + 1} de ${total}`
    : (p.etapa ? 'Etapa fora do pipeline' : 'Sem etapa');
  const responsaveis = p.expand?.responsaveis ?? [];

  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
    >
      {/* topo: etiquetas + etapa */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(p.etiquetas ?? []).slice(0, 3).map((t) => (
            <Badge key={t} variant="muted" className="text-[10px]">{t}</Badge>
          ))}
          {p.etiquetas && p.etiquetas.length > 3 && (
            <Badge variant="muted" className="text-[10px]">+{p.etiquetas.length - 3}</Badge>
          )}
        </div>
        {p.etapa && (
          <Badge variant="default" className="text-[10px]">{p.etapa}</Badge>
        )}
      </div>

      {/* nome do projeto */}
      <h3 className="text-base font-semibold leading-tight">{p.nome}</h3>

      {/* cliente + tipo */}
      <div className="flex items-center gap-3">
        {logo ? (
          <img src={logo} alt={cliNome} className="size-8 rounded-lg object-cover" />
        ) : (
          <div className={cn('grid size-8 place-items-center rounded-lg text-xs font-bold text-white', corAvatar(cliNome))}>
            {inicial(cliNome)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{cliNome}</p>
          <p className="truncate text-xs text-muted-foreground">{p.tipo || 'Sem tipo'}</p>
        </div>
      </div>

      {/* rodapé: progresso + responsáveis */}
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {posTxt}
        </span>
        <div className="flex -space-x-2">
          {responsaveis.slice(0, 3).map((r) => (
            <div
              key={r.id}
              title={r.nome ?? r.email}
              className={cn('grid size-7 place-items-center rounded-full border-2 border-card text-[10px] font-bold text-white', corAvatar(r.nome ?? r.email ?? r.id))}
            >
              {iniciaisResponsavel(r)}
            </div>
          ))}
          {responsaveis.length > 3 && (
            <div className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-[10px] font-bold text-muted-foreground">
              +{responsaveis.length - 3}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function ProjetosListPage() {
  const history = useHistory();
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('Todos');
  const [tipos, setTipos] = useState<Opcao[]>([]);
  const [todasEtapas, setTodasEtapas] = useState<EtapaProjeto[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const seqRef = useRef(0);

  useEffect(() => {
    listOpcoes('tipo_projeto').then(setTipos);
    listEtapas().then(setTodasEtapas);
  }, []);

  useEffect(() => {
    const seq = ++seqRef.current;
    const q = busca.trim();
    setCarregando(true);
    const timer = setTimeout(() => {
      const opts = {
        busca: q || undefined,
        tipo: tipoFiltro === 'Todos' ? undefined : tipoFiltro,
      };
      listProjetos(opts)
        .then((res) => {
          if (seq !== seqRef.current) return;
          setProjetos(res);
          setErro('');
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          setErro('Não foi possível carregar os projetos.');
        })
        .finally(() => {
          if (seq === seqRef.current) setCarregando(false);
        });
    }, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [busca, tipoFiltro]);

  const etapasPorTipo = useMemo(() => {
    const m: Record<string, EtapaProjeto[]> = {};
    for (const e of todasEtapas) (m[e.tipo] ??= []).push(e);
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return m;
  }, [todasEtapas]);

  const filtros = useMemo(() => ['Todos', ...tipos.map((t) => t.valor)], [tipos]);

  return (
    <div className="flex max-w-7xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Projetos</h1>
        <p className="text-sm text-muted-foreground">
          Visão operacional dos projetos da agência
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar projeto ou cliente"
            aria-label="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
        </div>
        <Button onClick={() => history.push('/projetos/novo')}>
          <Plus /> Novo projeto
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filtros.map((f) => (
          <button
            key={f}
            onClick={() => setTipoFiltro(f)}
            className={cn(
              'rounded-full border px-3.5 py-1 text-sm transition-colors',
              tipoFiltro === f
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-secondary',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {carregando && projetos.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="mb-3 h-4 w-16" />
              <Skeleton className="mb-3 h-5 w-3/4" />
              <Skeleton className="h-8 w-full" />
            </Card>
          ))}
        </div>
      ) : projetos.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <FolderKanban className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum projeto ainda. Clica em <strong>Novo projeto</strong> pra cadastrar.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projetos.map((p) => (
            <CardProjeto
              key={p.id}
              p={p}
              etapasPorTipo={etapasPorTipo}
              onClick={() => history.push(`/projetos/${p.id}`)}
            />
          ))}
        </div>
      )}

      {!carregando && projetos.length > 0 && (
        <p className="pt-1 text-right text-xs text-muted-foreground">
          {projetos.length} {projetos.length === 1 ? 'projeto' : 'projetos'}
        </p>
      )}
    </div>
  );
}
