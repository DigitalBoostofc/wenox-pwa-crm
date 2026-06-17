import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Save, ChevronDown, Info } from 'lucide-react';
import {
  getWaConfig, salvarWaConfig, listAutomacoes, atualizarAutomacao,
  CATEGORIA_LABEL, PUBLICO_LABEL, PLACEHOLDERS,
  type WaConfig, type Automacao, type CategoriaAutomacao,
} from './whatsappService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const inputCls = 'h-9 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';
const DIAS = [['Dom', 0], ['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6]] as const;

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        on ? 'bg-primary' : 'bg-secondary border border-border')}
    >
      <span className={cn('inline-block size-4 transform rounded-full bg-white transition-transform', on ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-muted-foreground">{children}</span>;
}

/* --------------------------- Conexão WhatsApp ----------------------------- */

function ConexaoCard() {
  const [cfg, setCfg] = useState<WaConfig | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState(false);

  const carregar = useCallback(() => {
    setErro(false);
    getWaConfig().then(setCfg).catch(() => setErro(true));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro) {
    return (
      <Card className="px-5 py-8 text-center">
        <p className="text-sm text-destructive">Não foi possível carregar a conexão.</p>
        <Button variant="ghost" size="sm" className="mt-3" onClick={carregar}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  if (!cfg) return <Skeleton className="h-64 w-full rounded-xl" />;

  function set<K extends keyof WaConfig>(k: K, v: WaConfig[K]) { setCfg((c) => c ? { ...c, [k]: v } : c); }
  function toggleDia(d: number) {
    setCfg((c) => {
      if (!c) return c;
      const has = c.dias_uteis.includes(d);
      return { ...c, dias_uteis: has ? c.dias_uteis.filter((x) => x !== d) : [...c.dias_uteis, d].sort() };
    });
  }
  async function salvar() {
    if (!cfg) return;
    setSalvando(true); setMsg('');
    try { await salvarWaConfig(cfg); setMsg('Configuração salva.'); }
    catch { setMsg('Não foi possível salvar.'); }
    finally { setSalvando(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="size-4" /> Conexão WhatsApp (UAZAPI)
          <Badge className={cn('ml-1 border text-[10px]',
            cfg.ativo ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400' : 'border-border bg-secondary text-muted-foreground')}>
            {cfg.ativo ? 'Disparos ligados' : 'Disparos desligados'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>Conecte o número no painel da UAZAPI (leia o QR Code lá) e cole aqui o <strong>subdomínio</strong> e o <strong>token da instância</strong>. O motor de disparos (n8n) usa esses dados para enviar.</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Rotulo>Subdomínio UAZAPI</Rotulo>
            <Input value={cfg.subdomain} placeholder="ex.: free ou api" onChange={(e) => set('subdomain', e.target.value)} />
          </div>
          <div>
            <Rotulo>Token da instância</Rotulo>
            <Input type="password" value={cfg.token} placeholder="cole o token aqui" onChange={(e) => set('token', e.target.value)} />
          </div>
          <div>
            <Rotulo>Nome da instância</Rotulo>
            <Input value={cfg.instance_name} onChange={(e) => set('instance_name', e.target.value)} />
          </div>
          <div>
            <Rotulo>Número remetente</Rotulo>
            <Input value={cfg.numero} placeholder="55119..." onChange={(e) => set('numero', e.target.value)} />
          </div>
          <div>
            <Rotulo>Janela de envio — início</Rotulo>
            <input type="time" value={cfg.janela_inicio} onChange={(e) => set('janela_inicio', e.target.value)} className={cn(inputCls, '[color-scheme:dark]')} />
          </div>
          <div>
            <Rotulo>Janela de envio — fim</Rotulo>
            <input type="time" value={cfg.janela_fim} onChange={(e) => set('janela_fim', e.target.value)} className={cn(inputCls, '[color-scheme:dark]')} />
          </div>
        </div>

        <div>
          <Rotulo>Dias de envio</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {DIAS.map(([lbl, d]) => (
              <button key={d} type="button" onClick={() => toggleDia(d)}
                className={cn('rounded-full border px-3 py-1 text-xs transition-colors',
                  cfg.dias_uteis.includes(d) ? 'border-primary/50 bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Disparos automáticos</p>
            <p className="text-xs text-muted-foreground">Liga/desliga geral de todas as automações.</p>
          </div>
          <Toggle on={cfg.ativo} onChange={(v) => set('ativo', v)} />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={salvar} disabled={salvando}><Save /> {salvando ? 'Salvando…' : 'Salvar conexão'}</Button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Automações -------------------------------- */

function AutomacaoItem({ a, onChange }: { a: Automacao; onChange: (patch: Partial<Automacao>) => void }) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Automacao>(a);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setRascunho(a); }, [a]);

  const sujo = JSON.stringify(rascunho) !== JSON.stringify(a);

  async function salvar() {
    setSalvando(true);
    await onChange({
      antecedencia_horas: Number(rascunho.antecedencia_horas) || 0,
      hora_envio: rascunho.hora_envio,
      repetir_a_cada_horas: Number(rascunho.repetir_a_cada_horas) || 0,
      template: rascunho.template,
    });
    setSalvando(false);
    setAberto(false);
  }

  return (
    <div className="border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <Toggle on={a.ativo} onChange={(v) => onChange({ ativo: v })} />
        <button type="button" onClick={() => setAberto((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{a.nome}</p>
          <p className="truncate text-xs text-muted-foreground">
            {PUBLICO_LABEL[a.publico]}
            {a.antecedencia_horas ? ` · ${a.antecedencia_horas}h antes` : ''}
            {a.hora_envio ? ` · ${a.hora_envio}` : ''}
            {a.repetir_a_cada_horas ? ` · repete ${a.repetir_a_cada_horas}h` : ''}
          </p>
        </button>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-180')} onClick={() => setAberto((v) => !v)} />
      </div>

      {aberto && (
        <div className="flex flex-col gap-3 bg-background/30 px-4 pb-4 pt-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Rotulo>Antecedência (horas)</Rotulo>
              <Input type="number" value={rascunho.antecedencia_horas} onChange={(e) => setRascunho({ ...rascunho, antecedencia_horas: Number(e.target.value) })} />
            </div>
            <div>
              <Rotulo>Horário (HH:MM)</Rotulo>
              <Input value={rascunho.hora_envio} placeholder="vazio = na hora" onChange={(e) => setRascunho({ ...rascunho, hora_envio: e.target.value })} />
            </div>
            <div>
              <Rotulo>Repetir a cada (horas)</Rotulo>
              <Input type="number" value={rascunho.repetir_a_cada_horas} onChange={(e) => setRascunho({ ...rascunho, repetir_a_cada_horas: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Rotulo>Mensagem</Rotulo>
            <textarea
              value={rascunho.template}
              onChange={(e) => setRascunho({ ...rascunho, template: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Placeholders: {PLACEHOLDERS.join(' ')}</p>
          </div>
          <div>
            <Button size="sm" onClick={salvar} disabled={!sujo || salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AutomacoesLista() {
  const [itens, setItens] = useState<Automacao[] | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(() => {
    setErro(false);
    listAutomacoes().then(setItens).catch(() => setErro(true));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function mudar(id: string, patch: Partial<Automacao>) {
    setItens((arr) => arr?.map((a) => a.id === id ? { ...a, ...patch } : a) ?? arr);
    try { await atualizarAutomacao(id, patch); }
    catch { carregar(); }
  }

  if (erro) {
    return (
      <Card className="px-5 py-8 text-center">
        <p className="text-sm text-destructive">Não foi possível carregar as automações.</p>
        <Button variant="ghost" size="sm" className="mt-3" onClick={carregar}>
          Tentar novamente
        </Button>
      </Card>
    );
  }
  if (!itens) return <Skeleton className="h-64 w-full rounded-xl" />;

  const categorias: CategoriaAutomacao[] = ['interno', 'cliente', 'digest'];
  return (
    <div className="flex flex-col gap-4">
      {categorias.map((cat) => {
        const doGrupo = itens.filter((a) => a.categoria === cat);
        if (!doGrupo.length) return null;
        return (
          <Card key={cat}>
            <CardHeader><CardTitle className="text-base">{CATEGORIA_LABEL[cat]}</CardTitle></CardHeader>
            <CardContent className="p-0">
              {doGrupo.map((a) => (
                <AutomacaoItem key={a.id} a={a} onChange={(patch) => mudar(a.id, patch)} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function AutomacoesPage() {
  const history = useHistory();
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => history.push('/config')} aria-label="Voltar"><ArrowLeft /></Button>
        <h2 className="text-lg font-semibold">Automações &amp; WhatsApp</h2>
      </div>
      <ConexaoCard />
      <AutomacoesLista />
    </div>
  );
}
