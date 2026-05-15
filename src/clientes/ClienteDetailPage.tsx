import { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonButton, IonBadge, IonList, IonItem, IonLabel,
  IonSegment, IonSegmentButton,
} from '@ionic/react';
import { useParams, useHistory } from 'react-router-dom';
import { getCliente } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';
import { EquipeTab } from '@/equipe/EquipeTab';

export function ClienteDetailPage({ id: idProp }: { id?: string } = {}) {
  const params = useParams<{ id?: string }>();
  const id = idProp ?? params.id ?? '';
  const history = useHistory();
  const [c, setC] = useState<Cliente | null>(null);
  const [aba, setAba] = useState<'info' | 'equipe'>('info');

  useEffect(() => {
    if (id) getCliente(id).then(setC);
  }, [id]);

  if (!c) {
    return (
      <IonPage>
        <IonContent className="ion-padding">Carregando…</IonContent>
      </IonPage>
    );
  }

  const wpp = `https://wa.me/${c.telefone.replace(/\D/g, '')}`;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/clientes" />
          </IonButtons>
          <IonTitle>{c.nome_fantasia}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => history.push(`/clientes/${c.id}/editar`)}>
              Editar
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <h2>
          {c.nome_fantasia}{' '}
          <IonBadge color={c.status === 'Ativo' ? 'success' : 'medium'}>
            {c.status}
          </IonBadge>
        </h2>
        <IonSegment
          value={aba}
          onIonChange={(e) => setAba(e.detail.value as 'info' | 'equipe')}
        >
          <IonSegmentButton value="info">Info</IonSegmentButton>
          <IonSegmentButton value="equipe">Equipe</IonSegmentButton>
        </IonSegment>
        {aba === 'equipe' ? (
          <EquipeTab clienteId={c.id} />
        ) : (
        <><IonList>
          <IonItem>
            <IonLabel>
              <p>Categoria</p>
              <h3>{c.categoria}</h3>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>
              <p>Telefone</p>
              <h3>{c.telefone}</h3>
            </IonLabel>
          </IonItem>
          {c.email && (
            <IonItem>
              <IonLabel>
                <p>E-mail</p>
                <h3>{c.email}</h3>
              </IonLabel>
            </IonItem>
          )}
        </IonList>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <a
            href={wpp}
            target="_blank"
            rel="noopener"
            aria-label="WhatsApp"
            style={{
              flex: 1, textAlign: 'center', padding: 12,
              background: 'var(--ion-color-primary)',
              color: 'var(--ion-color-primary-contrast)',
              borderRadius: 8, textDecoration: 'none',
            }}
          >
            WhatsApp
          </a>
          <a
            href={`tel:${c.telefone}`}
            aria-label="Ligar"
            style={{
              flex: 1, textAlign: 'center', padding: 12,
              border: '1px solid var(--ion-color-primary)',
              color: 'var(--ion-color-primary)',
              borderRadius: 8, textDecoration: 'none',
            }}
          >
            Ligar
          </a>
        </div>
        </>
        )}
      </IonContent>
    </IonPage>
  );
}
