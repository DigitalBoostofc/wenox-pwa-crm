import { useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonList, IonItem, IonLabel, IonBadge, useIonViewWillEnter,
} from '@ionic/react';
import { listUsuarios, criarUsuario } from '@/usuarios/usuariosService';
import { ROLES } from '@/usuarios/types';
import type { Usuario } from '@/usuarios/types';

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [novo, setNovo] = useState({ nome: '', email: '', role: 'Membro' });
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const carregar = async () => setUsuarios(await listUsuarios());
  useIonViewWillEnter(() => {
    carregar();
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      await criarUsuario(
        {
          nome: novo.nome,
          email: novo.email,
          role: novo.role as Usuario['role'],
          status: 'Ativo',
        },
        senha
      );
      setNovo({ nome: '', email: '', role: 'Membro' });
      setSenha('');
      await carregar();
    } catch (err) {
      setErro(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Erro ao criar usuário'
      );
    }
  }

  const st = { width: '100%', padding: 10, marginBottom: 8 };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/config" />
          </IonButtons>
          <IonTitle>Usuários</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <form onSubmit={add}>
          <label htmlFor="un">Nome</label>
          <input id="un" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} style={st} />
          <label htmlFor="ue">E-mail</label>
          <input id="ue" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} style={st} />
          <label htmlFor="ur">Papel</label>
          <select id="ur" value={novo.role} onChange={(e) => setNovo({ ...novo, role: e.target.value })} style={st}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <label htmlFor="up">Senha inicial</label>
          <input id="up" type="text" value={senha} onChange={(e) => setSenha(e.target.value)} style={st} />
          {erro && <p style={{ color: 'var(--ion-color-danger, #eb445a)' }}>{erro}</p>}
          <button type="submit" style={{ width: '100%', padding: 12, background: 'var(--ion-color-primary)', color: '#fff', border: 'none', borderRadius: 8 }}>
            Adicionar usuário
          </button>
        </form>
        <IonList>
          {usuarios.map((u) => (
            <IonItem key={u.id}>
              <IonLabel>
                <h2>{u.nome}</h2>
                <p>{u.email}</p>
              </IonLabel>
              <IonBadge slot="end" color={u.status === 'Ativo' ? 'success' : 'medium'}>
                {u.role}
              </IonBadge>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
}
