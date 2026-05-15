import { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton,
} from '@ionic/react';
import { useHistory, useParams } from 'react-router-dom';
import {
  createCliente, getCliente, updateCliente,
} from '@/clientes/clientesService';
import { CATEGORIAS, STATUS } from '@/clientes/types';
import type { ClienteInput } from '@/clientes/types';

const vazio: ClienteInput = {
  nome_fantasia: '', categoria: 'Cliente', telefone: '', status: 'Ativo',
};

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

  const inputStyle = { width: '100%', padding: 12, marginBottom: 12 };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/clientes" />
          </IonButtons>
          <IonTitle>{id ? 'Editar' : 'Novo'} Cliente</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <form onSubmit={salvar}>
          <label htmlFor="nf">Nome fantasia</label>
          <input
            id="nf"
            value={form.nome_fantasia}
            onChange={(e) => set('nome_fantasia', e.target.value)}
            style={inputStyle}
          />
          <label htmlFor="tel">Telefone</label>
          <input
            id="tel"
            value={form.telefone}
            onChange={(e) => set('telefone', e.target.value)}
            style={inputStyle}
          />
          <label htmlFor="cat">Categoria</label>
          <select
            id="cat"
            value={form.categoria}
            onChange={(e) => set('categoria', e.target.value as ClienteInput['categoria'])}
            style={inputStyle}
          >
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label htmlFor="st">Status</label>
          <select
            id="st"
            value={form.status}
            onChange={(e) => set('status', e.target.value as ClienteInput['status'])}
            style={inputStyle}
          >
            {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {erro && <p style={{ color: 'var(--ion-color-danger, #eb445a)' }}>{erro}</p>}
          <button
            type="submit"
            disabled={salvando}
            style={{
              width: '100%', padding: 14, marginTop: 12,
              background: 'var(--ion-color-primary)',
              color: 'var(--ion-color-primary-contrast)',
              border: 'none', borderRadius: 8, fontSize: 16,
            }}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </IonContent>
    </IonPage>
  );
}
