import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { ConfigPage } from '@/pages/ConfigPage';
import { ClientesListPage } from '@/clientes/ClientesListPage';
import { ClienteFormPage } from '@/clientes/ClienteFormPage';
import { ClienteDetailPage } from '@/clientes/ClienteDetailPage';
import { UsuariosPage } from '@/usuarios/UsuariosPage';

function UnauthedApp() {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path="/login" component={LoginPage} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    </BrowserRouter>
  );
}

function AuthedApp() {
  return (
    <BrowserRouter>
      <AppShell>
        <Switch>
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
          <Route exact path="/usuarios" component={UsuariosPage} />
          <Route exact path="/config" component={ConfigPage} />
          <Route exact path="/login">
            <Redirect to="/clientes" />
          </Route>
          <Route>
            <Redirect to="/clientes" />
          </Route>
        </Switch>
      </AppShell>
    </BrowserRouter>
  );
}

function Root() {
  const { user } = useAuth();
  return user ? <AuthedApp /> : <UnauthedApp />;
}

export default function App() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}
