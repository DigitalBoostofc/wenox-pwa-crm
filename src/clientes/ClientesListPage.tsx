import { useEffect, useState, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonBadge, IonFab, IonFabButton, IonIcon,
  IonChip, IonRefresher, IonRefresherContent, useIonViewWillEnter,
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { listClientes } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';
import { useAuth } from '@/auth/useAuth';
import { canCriarCliente } from '@/auth/perms';

export function ClientesListPage() {
  const history = useHistory();
  const { user } = useAuth();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'Todos' | 'Ativo' | 'Inativo'>('Todos');
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const carregar = useCallback(async (q: string) => {
    setClientes(await listClientes(q));
  }, []);

  useEffect(() => {
    carregar(busca);
  }, [busca, carregar]);

  useIonViewWillEnter(() => {
    carregar(busca);
  });

  const visiveis = clientes.filter(
    (c) => filtro === 'Todos' || c.status === filtro
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Clientes</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await carregar(busca); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="ion-padding">
          <input
            placeholder="Buscar"
            aria-label="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: '100%', padding: 12, borderRadius: 8,
              border: '1px solid var(--ion-color-medium, #555)',
              background: 'var(--ion-item-background, #16181d)',
              color: 'var(--ion-text-color, #fff)',
            }}
          />
          <div style={{ marginTop: 8 }}>
            {(['Todos', 'Ativo', 'Inativo'] as const).map((f) => (
              <IonChip
                key={f}
                color={filtro === f ? 'primary' : 'medium'}
                onClick={() => setFiltro(f)}
              >
                {f}
              </IonChip>
            ))}
          </div>
        </div>
        <IonList>
          {visiveis.map((c) => (
            <IonItem
              key={c.id}
              button
              onClick={() => history.push(`/clientes/${c.id}`)}
            >
              <IonLabel>
                <h2>{c.nome_fantasia}</h2>
                <p>{c.telefone}</p>
              </IonLabel>
              <IonBadge
                slot="end"
                color={c.status === 'Ativo' ? 'success' : 'medium'}
              >
                {c.status}
              </IonBadge>
            </IonItem>
          ))}
        </IonList>
        {canCriarCliente(user?.role) && (
          <IonFab slot="fixed" vertical="bottom" horizontal="end">
            <IonFabButton onClick={() => history.push('/novo-cliente')}>
              <IonIcon icon={add} />
            </IonFabButton>
          </IonFab>
        )}
      </IonContent>
    </IonPage>
  );
}
