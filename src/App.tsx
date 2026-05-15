import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useAuth } from '@/auth/useAuth';
import { LoginPage } from '@/pages/LoginPage';
import { AppTabs } from '@/components/AppTabs';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import './theme/variables.css';

setupIonicReact();

function UnauthedApp() {
  return (
    <IonReactRouter>
      <IonRouterOutlet>
        <Route exact path="/login" component={LoginPage} />
        <Route render={() => <Redirect to="/login" />} />
      </IonRouterOutlet>
    </IonReactRouter>
  );
}

function AuthedApp() {
  return (
    <IonReactRouter>
      <AppTabs />
    </IonReactRouter>
  );
}

function Root() {
  const { user } = useAuth();
  return user ? <AuthedApp /> : <UnauthedApp />;
}

export default function App() {
  return (
    <IonApp>
      <Root />
    </IonApp>
  );
}
