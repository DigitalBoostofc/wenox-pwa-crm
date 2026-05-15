import {
  IonContent, IonPage, IonHeader, IonToolbar, IonTitle, IonButton, IonButtons,
} from '@ionic/react';
import { useAuth } from '@/auth/useAuth';

export function HomePage() {
  const { user, logout } = useAuth();
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Clientes</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={logout}>Sair</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <p>Olá, {user?.nome ?? user?.email}.</p>
        <p>Em breve: lista de clientes (P2).</p>
      </IonContent>
    </IonPage>
  );
}
