import { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  ArrowLeft, Image as ImageIcon, Camera, Plus, Trash2, X,
} from 'lucide-react';
import {
  createCliente, getCliente, updateCliente, deleteCliente, logoUrl, REMOVER_LOGO,
} from '@/clientes/clientesService';
import { CATEGORIAS } from '@/clientes/types';
import type { ClienteInput, Contato } from '@/clientes/types';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const vazio: ClienteInput = {
  nome_fantasia: '', categoria: 'Cliente', telefone: '', status: '',
  telefones: [], emails: [],
};

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

const inputBare =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

const ROTULO_CAMPO: Record<string, string> = {
  nome: 'Nome', nome_fantasia: 'Nome fantasia', razao_social: 'Razão social',
  cnpj: 'CPF/CNPJ', telefone: 'Telefone', email: 'E-mail', site: 'Website',
  endereco: 'Endereço', origem: 'Origem', status: 'Status', servicos: 'Serviços',
  data_inicio: 'Início', data_encerramento: 'Encerramento',
  url_dashboard: 'Dashboard', url_drive: 'Drive', url_trello: 'Trello',
  observacoes: 'Observação', categoria: 'Categoria',
  telefones: 'Telefones', emails: 'E-mails',
};

function mensagemErro(err: unknown): string {
  const e = err as { response?: { data?: Record<string, { message?: string }> }; message?: string };
  const campos = e?.response?.data;
  if (campos && typeof campos === 'object' && Object.keys(campos).length) {
    const partes = Object.entries(campos).map(
      ([campo, info]) =>
        `${ROTULO_CAMPO[campo] ?? campo}: ${info?.message ?? 'inválido'}`,
    );
    return `Não foi possível salvar — ${partes.join(' · ')}`;
  }
  return e?.message
    ? `Não foi possível salvar: ${e.message}`
    : 'Erro ao salvar. Verifique sua conexão e tente novamente.';
}

function Campo({
  id, label, children, className = '',
}: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Repetidor genérico de contatos (tipo livre + valor). */
function ListaContatos({
  label, valor, onChange, placeholderTipo, placeholderValor, tipoValor = 'text',
}: {
  label: string;
  valor: Contato[];
  onChange: (v: Contato[]) => void;
  placeholderTipo: string;
  placeholderValor: string;
  tipoValor?: 'text' | 'email' | 'tel';
}) {
  function adicionar() {
    onChange([...valor, { tipo: '', valor: '' }]);
  }
  function atualizar(idx: number, campo: keyof Contato, v: string) {
    onChange(valor.map((c, i) => (i === idx ? { ...c, [campo]: v } : c)));
  }
  function remover(idx: number) {
    onChange(valor.filter((_, i) => i !== idx));
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={adicionar}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>
      {valor.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Nenhum {label.toLowerCase().replace(/s$/, '')} cadastrado.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {valor.map((c, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <input
                aria-label={`${label} ${idx + 1} — tipo`}
                placeholder={placeholderTipo}
                value={c.tipo}
                onChange={(e) => atualizar(idx, 'tipo', e.target.value)}
                className={inputBare}
              />
              <input
                aria-label={`${label} ${idx + 1} — valor`}
                type={tipoValor}
                placeholder={placeholderValor}
                value={c.valor}
                onChange={(e) => atualizar(idx, 'valor', e.target.value)}
                className={inputBare}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover ${label.toLowerCase()} ${idx + 1}`}
                onClick={() => remover(idx)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClienteFormPage({ id: idProp }: { id?: string } = {}) {
  const history = useHistory();
  const params = useParams<{ id?: string }>();
  const id = idProp ?? params.id;
  const [form, setForm] = useState<ClienteInput>(vazio);
  const [origens, setOrigens] = useState<Opcao[]>([]);
  const [statusOpts, setStatusOpts] = useState<Opcao[]>([]);
  const [servicosOpts, setServicosOpts] = useState<Opcao[]>([]);
  const [logoAtualUrl, setLogoAtualUrl] = useState<string>('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removerLogo, setRemoverLogo] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listOpcoes('origem').then(setOrigens);
    listOpcoes('status').then((s) => {
      setStatusOpts(s);
      setForm((f) => (f.status ? f : { ...f, status: s[0]?.valor ?? '' }));
    });
    listOpcoes('servico').then(setServicosOpts);
  }, []);

  useEffect(() => {
    if (id) {
      getCliente(id).then((c) => {
        const { id: _omit, created, updated, created_by, updated_by, ...rest } = c;
        void _omit; void created; void updated; void created_by; void updated_by;
        // Compatibilidade: se vier só `telefone`/`email` legados, semeia a lista.
        const telefones = (rest.telefones?.length ? rest.telefones
          : rest.telefone ? [{ tipo: 'Comercial', valor: rest.telefone }] : []);
        const emails = (rest.emails?.length ? rest.emails
          : rest.email ? [{ tipo: 'Comercial', valor: rest.email }] : []);
        setForm({ ...vazio, ...rest, telefones, emails } as ClienteInput);
        setLogoAtualUrl(c.logo ? logoUrl(c, '200x200') : '');
        setLogoFile(null);
        setRemoverLogo(false);
      });
    }
  }, [id]);

  function set<K extends keyof ClienteInput>(k: K, v: ClienteInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleServico(valor: string) {
    setForm((f) => {
      const atuais = f.servicos ?? [];
      return {
        ...f,
        servicos: atuais.includes(valor)
          ? atuais.filter((s) => s !== valor)
          : [...atuais, valor],
      };
    });
  }

  function escolherFoto(file: File | null) {
    setLogoFile(file);
    if (file) setRemoverLogo(false);
  }

  function removerFotoAtual() {
    setLogoFile(null);
    setRemoverLogo(true);
  }

  async function apagar() {
    if (!id) return;
    if (!confirm('Apagar este cliente definitivamente? Esta ação não pode ser desfeita.')) return;
    await deleteCliente(id);
    history.push('/clientes');
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!form.nome_fantasia.trim() && !form.nome?.trim()) {
      setErro('Informe ao menos um Nome ou Nome fantasia');
      return;
    }
    setSalvando(true);
    try {
      // Mantém compat: o primeiro telefone/email da lista também alimenta o campo
      // legado, pra busca/exibição em telas antigas continuar funcionando.
      const tels = (form.telefones ?? []).filter((t) => t.valor?.trim());
      const ems = (form.emails ?? []).filter((m) => m.valor?.trim());
      const payload: ClienteInput = {
        ...form,
        nome_fantasia: form.nome_fantasia?.trim() || form.nome?.trim() || '',
        telefones: tels,
        emails: ems,
        telefone: tels[0]?.valor ?? '',
        email: ems[0]?.valor ?? '',
      };
      if (id) {
        const logoArg = logoFile ?? (removerLogo ? REMOVER_LOGO : undefined);
        await updateCliente(id, payload, logoArg);
      } else {
        await createCliente(payload, logoFile);
      }
      history.push('/clientes');
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  const previewUrl = logoFile
    ? URL.createObjectURL(logoFile)
    : (!removerLogo && logoAtualUrl) || '';

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => history.push('/clientes')} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h2 className="text-lg font-semibold">{id ? 'Editar' : 'Novo'} cliente</h2>
      </div>

      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">
                Foto do perfil
              </span>
              <div className="flex items-center gap-4">
                <label
                  title="Selecionar foto"
                  className="group relative grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-secondary text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Foto do cliente"
                      className="size-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-center">
                      <Camera className="size-6" />
                      <span className="text-[10px] leading-tight">Adicionar<br />foto</span>
                    </div>
                  )}
                  <span className="absolute inset-0 hidden place-items-center bg-black/50 text-xs font-medium text-white group-hover:grid">
                    {previewUrl ? 'Trocar' : 'Selecionar'}
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => escolherFoto(e.target.files?.[0] ?? null)} />
                </label>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-secondary">
                      <ImageIcon className="size-4" />
                      {previewUrl ? 'Trocar foto' : 'Escolher foto'}
                    </span>
                    <input type="file" accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => escolherFoto(e.target.files?.[0] ?? null)} />
                  </label>
                  {previewUrl ? (
                    <button type="button"
                      onClick={removerFotoAtual}
                      className="inline-flex items-center gap-1 text-left text-xs text-muted-foreground hover:text-destructive">
                      <X className="size-3" /> Remover foto
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      PNG, JPG ou WEBP
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="nome" label="Nome">
                <Input id="nome" value={form.nome ?? ''}
                  onChange={(e) => set('nome', e.target.value)} />
              </Campo>
              <Campo id="nf" label="Nome fantasia">
                <Input id="nf" value={form.nome_fantasia}
                  onChange={(e) => set('nome_fantasia', e.target.value)} />
              </Campo>
              <Campo id="rs" label="Razão social">
                <Input id="rs" value={form.razao_social ?? ''}
                  onChange={(e) => set('razao_social', e.target.value)} />
              </Campo>
              <Campo id="cnpj" label="CPF / CNPJ">
                <Input id="cnpj" value={form.cnpj ?? ''}
                  onChange={(e) => set('cnpj', e.target.value)} />
              </Campo>
              <Campo id="cat" label="Categoria">
                <select id="cat" value={form.categoria} className={selectClass}
                  onChange={(e) => set('categoria', e.target.value as ClienteInput['categoria'])}>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Campo>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contato</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ListaContatos
              label="Telefones"
              valor={form.telefones ?? []}
              onChange={(v) => set('telefones', v)}
              placeholderTipo="Tipo (ex: Comercial)"
              placeholderValor="(85) 9 9999-9999"
              tipoValor="tel"
            />
            <ListaContatos
              label="E-mails"
              valor={form.emails ?? []}
              onChange={(v) => set('emails', v)}
              placeholderTipo="Tipo (ex: Financeiro)"
              placeholderValor="contato@empresa.com"
              tipoValor="email"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="site" label="Website">
                <Input id="site" value={form.site ?? ''}
                  onChange={(e) => set('site', e.target.value)} />
              </Campo>
              <Campo id="end" label="Endereço">
                <Input id="end" value={form.endereco ?? ''}
                  onChange={(e) => set('endereco', e.target.value)} />
              </Campo>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Comercial</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="origem" label="Origem">
                <select id="origem" value={form.origem ?? ''} className={selectClass}
                  onChange={(e) => set('origem', e.target.value)}>
                  <option value="">—</option>
                  {origens.map((o) => <option key={o.id} value={o.valor}>{o.valor}</option>)}
                </select>
              </Campo>
              <Campo id="status" label="Status">
                <select id="status" value={form.status} className={selectClass}
                  onChange={(e) => set('status', e.target.value)}>
                  {statusOpts.map((o) => <option key={o.id} value={o.valor}>{o.valor}</option>)}
                </select>
              </Campo>
              <Campo id="di" label="Início">
                <Input id="di" type="date" value={form.data_inicio ?? ''}
                  onChange={(e) => set('data_inicio', e.target.value)} />
              </Campo>
              <Campo id="de" label="Encerramento">
                <Input id="de" type="date" value={form.data_encerramento ?? ''}
                  onChange={(e) => set('data_encerramento', e.target.value)} />
              </Campo>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">Serviços</span>
              <div className="flex flex-wrap gap-2">
                {servicosOpts.map((o) => {
                  const ativo = (form.servicos ?? []).includes(o.valor);
                  return (
                    <button key={o.id} type="button" onClick={() => toggleServico(o.valor)}
                      className={
                        'rounded-full border px-3 py-1 text-sm transition-colors ' +
                        (ativo
                          ? 'border-primary/50 bg-primary/15 text-primary'
                          : 'border-border text-muted-foreground hover:bg-secondary')
                      }>
                      {o.valor}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Links e observação</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="ud" label="Dashboard">
                <Input id="ud" value={form.url_dashboard ?? ''}
                  onChange={(e) => set('url_dashboard', e.target.value)} />
              </Campo>
              <Campo id="udr" label="Drive">
                <Input id="udr" value={form.url_drive ?? ''}
                  onChange={(e) => set('url_drive', e.target.value)} />
              </Campo>
              <Campo id="ut" label="Trello" className="md:col-span-2">
                <Input id="ut" value={form.url_trello ?? ''}
                  onChange={(e) => set('url_trello', e.target.value)} />
              </Campo>
            </div>
            <Campo id="obs" label="Observação">
              <textarea id="obs" rows={3} value={form.observacoes ?? ''}
                onChange={(e) => set('observacoes', e.target.value)}
                className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
            </Campo>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Facebook / Instagram</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Campo id="fbid" label="ID da Página do Facebook">
                <Input id="fbid" value={form.facebook_page_id ?? ''}
                  onChange={(e) => set('facebook_page_id', e.target.value)}
                  placeholder="ex.: 102539062709078" />
              </Campo>
              <Campo id="fbnome" label="Nome da Página">
                <Input id="fbnome" value={form.facebook_page_nome ?? ''}
                  onChange={(e) => set('facebook_page_nome', e.target.value)}
                  placeholder="ex.: Via Luxo Transportes" />
              </Campo>
            </div>
            <p className="text-xs text-muted-foreground">
              Usado nas automações de Social Media (publicação/métricas). O ID vem da
              Página conectada à BM da Wenox.
            </p>
          </CardContent>
        </Card>

        {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
          {id && (
            <Button type="button" variant="ghost" onClick={apagar} className="text-destructive hover:bg-destructive/10">
              Apagar cliente
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
