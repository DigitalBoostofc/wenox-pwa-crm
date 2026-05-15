import {
  IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel,
  IonRouterOutlet,
} from '@ionic/react';
import { people, settings } from 'ionicons/icons';
import { Redirect, Route } from 'react-router-dom';
import { ClientesListPage } from '@/clientes/ClientesListPage';
import { ClienteFormPage } from '@/clientes/ClienteFormPage';
import { ClienteDetailPage } from '@/clientes/ClienteDetailPage';
import { UsuariosPage } from '@/usuarios/UsuariosPage';
import { useAuth } from '@/auth/useAuth';
import { canGerirUsuarios } from '@/auth/perms';

function ConfigPage() {
  const { user, logout } = useAuth();
  return (
    <div className="ion-padding">
      <p>{user?.email}</p>
      {canGerirUsuarios(user?.role) && (
        <p>
          <a href="/usuarios">Gerenciar usuários</a>
        </p>
      )}
      <button onClick={logout}>Sair</button>
    </div>
  );
}

export function AppTabs() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/clientes" component={ClientesListPage} />
        <Route exact path="/novo-cliente" component={ClienteFormPage} />
        <Route
          exact
          path="/clientes/:id/editar"
          render={(props) => (
            <ClienteFormPage id={(props.match.params as { id: string }).id} />
          )}
        />
        <Route
          exact
          path="/clientes/:id"
          render={(props) => (
            <ClienteDetailPage id={(props.match.params as { id: string }).id} />
          )}
        />
        <Route exact path="/config" component={ConfigPage} />
        <Route exact path="/usuarios" component={UsuariosPage} />
        <Route exact path="/login">
          <Redirect to="/clientes" />
        </Route>
        <Route exact path="/">
          <Redirect to="/clientes" />
        </Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="clientes" href="/clientes">
          <IonIcon icon={people} />
          <IonLabel>Clientes</IonLabel>
        </IonTabButton>
        <IonTabButton tab="config" href="/config">
          <IonIcon icon={settings} />
          <IonLabel>Config</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}
