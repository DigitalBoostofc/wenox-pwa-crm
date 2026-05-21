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
const ProjetosListPage = lazy(() =>
  import('@/projetos/ProjetosListPage').then((m) => ({ default: m.ProjetosListPage })));
const ProjetoFormPage = lazy(() =>
  import('@/projetos/ProjetoFormPage').then((m) => ({ default: m.ProjetoFormPage })));
const ProjetoDetailPage = lazy(() =>
  import('@/projetos/ProjetoDetailPage').then((m) => ({ default: m.ProjetoDetailPage })));
const EtapasProjetoPage = lazy(() =>
  import('@/projetos/EtapasProjetoPage').then((m) => ({ default: m.EtapasProjetoPage })));
const TarefasListPage = lazy(() =>
  import('@/tarefas/TarefasListPage').then((m) => ({ default: m.TarefasListPage })));
const TarefaFormPage = lazy(() =>
  import('@/tarefas/TarefaFormPage').then((m) => ({ default: m.TarefaFormPage })));
const TarefaDetailPage = lazy(() =>
  import('@/tarefas/TarefaDetailPage').then((m) => ({ default: m.TarefaDetailPage })));
const PrivacidadePage = lazy(() =>
  import('@/config/PrivacidadePage').then((m) => ({ default: m.PrivacidadePage })));
const EquipePage = lazy(() =>
  import('@/equipe/EquipePage').then((m) => ({ default: m.EquipePage })));
const MembroDetailPage = lazy(() =>
  import('@/equipe/MembroDetailPage').then((m) => ({ default: m.MembroDetailPage })));

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
          <Route exact path="/projetos" component={ProjetosListPage} />
          <Route exact path="/projetos/novo" component={ProjetoFormPage} />
          <Route
            exact
            path="/projetos/:id/editar"
            render={(props) => (
              <ProjetoFormPage id={(props.match.params as { id: string }).id} />
            )}
          />
          <Route
            exact
            path="/projetos/:id"
            render={(props) => (
              <ProjetoDetailPage id={(props.match.params as { id: string }).id} />
            )}
          />
          <Route exact path="/tarefas" component={TarefasListPage} />
          <Route exact path="/tarefas/nova" component={TarefaFormPage} />
          <Route
            exact
            path="/tarefas/:id/editar"
            render={(props) => (
              <TarefaFormPage id={(props.match.params as { id: string }).id} />
            )}
          />
          <Route
            exact
            path="/tarefas/:id"
            render={(props) => (
              <TarefaDetailPage id={(props.match.params as { id: string }).id} />
            )}
          />
          <Route exact path="/equipe" component={EquipePage} />
          <Route
            exact
            path="/equipe/:id"
            render={(props) => (
              <MembroDetailPage id={(props.match.params as { id: string }).id} />
            )}
          />
          <Route exact path="/usuarios" component={UsuariosPage} />
          <Route exact path="/config/parametros" component={ParametrosPage} />
          <Route exact path="/config/etapas-projeto" component={EtapasProjetoPage} />
          <Route exact path="/config/privacidade" component={PrivacidadePage} />
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

/** Árvore de rotas restrita para contas Cliente (cliente externo). */
function ClienteApp({ clienteId }: { clienteId: string }) {
  return (
    <BrowserRouter>
      <AppShell>
        <Suspense fallback={<CarregandoTela />}>
          <Switch>
            <Route exact path="/projetos" component={ProjetosListPage} />
            <Route
              exact
              path="/projetos/:id"
              render={(props) => (
                <ProjetoDetailPage id={(props.match.params as { id: string }).id} />
              )}
            />
            <Route exact path="/tarefas" component={TarefasListPage} />
            <Route exact path="/tarefas/nova" component={TarefaFormPage} />
            <Route
              exact
              path="/tarefas/:id/editar"
              render={(props) => (
                <TarefaFormPage id={(props.match.params as { id: string }).id} />
              )}
            />
            <Route
              exact
              path="/tarefas/:id"
              render={(props) => (
                <TarefaDetailPage id={(props.match.params as { id: string }).id} />
              )}
            />
            <Route exact path="/minha-empresa">
              {clienteId
                ? <ClienteDetailPage id={clienteId} />
                : <CarregandoTela />}
            </Route>
            <Route>
              <Redirect to="/projetos" />
            </Route>
          </Switch>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  );
}

function Root() {
  const { user } = useAuth();
  if (!user) return <UnauthedApp />;
  if (user.role === 'Cliente') return <ClienteApp clienteId={user.cliente ?? ''} />;
  return <AuthedApp />;
}

export default function App() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}
