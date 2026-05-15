import { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  createCliente, getCliente, updateCliente,
} from '@/clientes/clientesService';
import { CATEGORIAS, STATUS } from '@/clientes/types';
import type { ClienteInput } from '@/clientes/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

const vazio: ClienteInput = {
  nome_fantasia: '', categoria: 'Cliente', telefone: '', status: 'Ativo',
};

const selectClass =
  'h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

export function ClienteFormPage({ id: idProp }: { id?: string } = {}) {
  const history = useHistory();
  const params = useParams<{ id?: string }>();
  const id = idProp ?? params.id;
  const [form, setForm] = useState<ClienteInput>(vazio);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (id) {
      getCliente(id).then((c) => {
        const { id: _omit, ...rest } = c;
        void _omit;
        setForm(rest as ClienteInput);
      });
    }
  }, [id]);

  function set<K extends keyof ClienteInput>(k: K, v: ClienteInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
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
      if (id) await updateCliente(id, form);
      else await createCliente(form);
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
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => history.push('/clientes')}
          aria-label="Voltar"
        >
          <ArrowLeft />
        </Button>
        <h2 className="text-lg font-semibold">
          {id ? 'Editar' : 'Novo'} cliente
        </h2>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={salvar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nf" className="text-sm font-medium text-muted-foreground">
                Nome fantasia
              </label>
              <Input
                id="nf"
                value={form.nome_fantasia}
                onChange={(e) => set('nome_fantasia', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tel" className="text-sm font-medium text-muted-foreground">
                Telefone
              </label>
              <Input
                id="tel"
                value={form.telefone}
                onChange={(e) => set('telefone', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cat" className="text-sm font-medium text-muted-foreground">
                Categoria
              </label>
              <select
                id="cat"
                value={form.categoria}
                onChange={(e) => set('categoria', e.target.value as ClienteInput['categoria'])}
                className={selectClass}
              >
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="st" className="text-sm font-medium text-muted-foreground">
                Status
              </label>
              <select
                id="st"
                value={form.status}
                onChange={(e) => set('status', e.target.value as ClienteInput['status'])}
                className={selectClass}
              >
                {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {erro && (
              <p className="text-sm font-medium text-destructive">{erro}</p>
            )}
            <Button type="submit" size="lg" disabled={salvando} className="mt-2">
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
