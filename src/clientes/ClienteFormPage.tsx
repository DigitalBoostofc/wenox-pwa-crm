import { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import {
  createCliente, getCliente, updateCliente,
} from '@/clientes/clientesService';
import { CATEGORIAS } from '@/clientes/types';
import type { ClienteInput } from '@/clientes/types';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const vazio: ClienteInput = {
  nome_fantasia: '', categoria: 'Cliente', telefone: '', status: '',
};

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

function Campo({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {children}
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
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
        setForm({ ...vazio, ...rest } as ClienteInput);
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

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!form.nome_fantasia.trim()) {
      setErro('Nome fantasia é obrigatório');
      return;
    }
    setSalvando(true);
    try {
      if (id) await updateCliente(id, form, logoFile);
      else await createCliente(form, logoFile);
      history.push('/clientes');
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Erro ao salvar. Verifique sua conexão e tente novamente.';
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
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
            <div className="flex items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-secondary text-muted-foreground">
                {logoFile ? (
                  <img src={URL.createObjectURL(logoFile)} alt="Prévia"
                    className="size-full object-cover" />
                ) : (
                  <ImageIcon className="size-6" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="logo" className="text-sm font-medium text-muted-foreground">
                  Foto do perfil
                </label>
                <input id="logo" type="file" accept="image/png,image/jpeg,image/webp"
                  className="text-sm"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contato</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Campo id="tel" label="Telefone">
              <Input id="tel" value={form.telefone}
                onChange={(e) => set('telefone', e.target.value)} />
            </Campo>
            <Campo id="email" label="E-mail">
              <Input id="email" type="email" value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)} />
            </Campo>
            <Campo id="site" label="Website">
              <Input id="site" value={form.site ?? ''}
                onChange={(e) => set('site', e.target.value)} />
            </Campo>
            <Campo id="end" label="Endereço">
              <Input id="end" value={form.endereco ?? ''}
                onChange={(e) => set('endereco', e.target.value)} />
            </Campo>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Comercial</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
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
            <div className="grid grid-cols-2 gap-3">
              <Campo id="di" label="Início">
                <Input id="di" type="date" value={form.data_inicio ?? ''}
                  onChange={(e) => set('data_inicio', e.target.value)} />
              </Campo>
              <Campo id="de" label="Encerramento">
                <Input id="de" type="date" value={form.data_encerramento ?? ''}
                  onChange={(e) => set('data_encerramento', e.target.value)} />
              </Campo>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Links e observação</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Campo id="ud" label="Dashboard">
              <Input id="ud" value={form.url_dashboard ?? ''}
                onChange={(e) => set('url_dashboard', e.target.value)} />
            </Campo>
            <Campo id="udr" label="Drive">
              <Input id="udr" value={form.url_drive ?? ''}
                onChange={(e) => set('url_drive', e.target.value)} />
            </Campo>
            <Campo id="ut" label="Trello">
              <Input id="ut" value={form.url_trello ?? ''}
                onChange={(e) => set('url_trello', e.target.value)} />
            </Campo>
            <Campo id="obs" label="Observação">
              <textarea id="obs" rows={3} value={form.observacoes ?? ''}
                onChange={(e) => set('observacoes', e.target.value)}
                className="w-full rounded-md border border-input bg-background/40 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
            </Campo>
          </CardContent>
        </Card>

        {erro && <p className="text-sm font-medium text-destructive">{erro}</p>}
        <Button type="submit" size="lg" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </div>
  );
}
