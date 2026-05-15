import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useAuth } from '@/auth/useAuth';
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import './theme/variables.css';

setupIonicReact();

export default function App() {
  const { user } = useAuth();
  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/login">
            {user ? <Redirect to="/" /> : <LoginPage />}
          </Route>
          <Route exact path="/">
            {user ? <HomePage /> : <Redirect to="/login" />}
          </Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
}
