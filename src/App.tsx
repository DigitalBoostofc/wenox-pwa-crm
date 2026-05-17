import { lazy, Suspense } from 'react';
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { AppShell } from '@/components/layout/AppShell';

/* Cada página vira um chunk separado: o navegador só baixa a tela
 * que o usuário abrir, deixando o carregamento inicial bem mais leve. */
const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ConfigPage = lazy(() =>
  import('@/pages/ConfigPage').then((m) => ({ default: m.ConfigPage })));
const ClientesListPage = lazy(() =>
  import('@/clientes/ClientesListPage').then((m) => ({ default: m.ClientesListPage })));
const ClienteFormPage = lazy(() =>
  import('@/clientes/ClienteFormPage').then((m) => ({ default: m.ClienteFormPage })));
const ClienteDetailPage = lazy(() =>
  import('@/clientes/ClienteDetailPage').then((m) => ({ default: m.ClienteDetailPage })));
const UsuariosPage = lazy(() =>
  import('@/usuarios/UsuariosPage').then((m) => ({ default: m.UsuariosPage })));
const ParametrosPage = lazy(() =>
  import('@/opcoes/ParametrosPage').then((m) => ({ default: m.ParametrosPage })));

function CarregandoTela() {
  return (
    <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>
  );
}

function UnauthedApp() {
  return (
    <BrowserRouter>
      <Suspense fallback={<CarregandoTela />}>
        <Switch>
          <Route exact path="/login" component={LoginPage} />
          <Route>
            <Redirect to="/login" />
          </Route>
        </Switch>
      </Suspense>
    </BrowserRouter>
  );
}

function AuthedApp() {
  return (
    <BrowserRouter>
      <AppShell>
        <Suspense fallback={<CarregandoTela />}>
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
          <Route exact path="/config/parametros" component={ParametrosPage} />
          <Route exact path="/config" component={ConfigPage} />
          <Route exact path="/login">
            <Redirect to="/clientes" />
          </Route>
          <Route>
            <Redirect to="/clientes" />
          </Route>
        </Switch>
        </Suspense>
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
