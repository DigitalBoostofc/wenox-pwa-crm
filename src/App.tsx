import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { canGerirUsuarios } from '@/auth/perms';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { AppShell } from '@/components/layout/AppShell';
import { PermissoesProvider, usePermissoes } from '@/config/PermissoesProvider';
import { NAV_ITEMS } from '@/components/layout/nav';
import type { Modulo } from '@/config/permissoesConfig';

/* Cada página vira um chunk separado: o navegador só baixa a tela
 * que o usuário abrir, deixando o carregamento inicial bem mais leve. */
const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ConfigPage = lazy(() =>
  import('@/pages/ConfigPage').then((m) => ({ default: m.ConfigPage })));
const AutomacoesPage = lazy(() =>
  import('@/automacoes/AutomacoesPage').then((m) => ({ default: m.AutomacoesPage })));
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
const StatusTarefaPage = lazy(() =>
  import('@/opcoes/StatusTarefaPage').then((m) => ({ default: m.StatusTarefaPage })));
const EtapasTarefaConfigPage = lazy(() =>
  import('@/tarefas/EtapasTarefaConfigPage').then((m) => ({ default: m.EtapasTarefaConfigPage })));
const ProjetosListPage = lazy(() =>
  import('@/projetos/ProjetosListPage').then((m) => ({ default: m.ProjetosListPage })));
const ProjetoFormPage = lazy(() =>
  import('@/projetos/ProjetoFormPage').then((m) => ({ default: m.ProjetoFormPage })));
const ProjetoDetailPage = lazy(() =>
  import('@/projetos/ProjetoDetailPage').then((m) => ({ default: m.ProjetoDetailPage })));
const EtapasProjetoPage = lazy(() =>
  import('@/projetos/EtapasProjetoPage').then((m) => ({ default: m.EtapasProjetoPage })));
const DashboardPage = lazy(() =>
  import('@/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const TarefasListPage = lazy(() =>
  import('@/tarefas/TarefasListPage').then((m) => ({ default: m.TarefasListPage })));
const TarefaDetailPage = lazy(() =>
  import('@/tarefas/TarefaDetailPage').then((m) => ({ default: m.TarefaDetailPage })));
const PrivacidadePage = lazy(() =>
  import('@/config/PrivacidadePage').then((m) => ({ default: m.PrivacidadePage })));
const EquipePage = lazy(() =>
  import('@/equipe/EquipePage').then((m) => ({ default: m.EquipePage })));
const MembroDetailPage = lazy(() =>
  import('@/equipe/MembroDetailPage').then((m) => ({ default: m.MembroDetailPage })));
const MinhaAreaPage = lazy(() =>
  import('@/minha-area/MinhaAreaPage').then((m) => ({ default: m.MinhaAreaPage })));
const QuadrosListPage = lazy(() =>
  import('@/quadros/QuadrosListPage').then((m) => ({ default: m.QuadrosListPage })));
const QuadroBoardPage = lazy(() =>
  import('@/quadros/QuadroBoardPage').then((m) => ({ default: m.QuadroBoardPage })));

function CarregandoTela() {
  return (
    <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>
  );
}

function SemAcesso() {
  return (
    <div className="flex flex-col items-center gap-2 py-20 text-center">
      <p className="text-base font-semibold">Sem acesso</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Seu perfil não tem permissão para nenhum módulo. Fale com um administrador.
      </p>
    </div>
  );
}

/**
 * Bloqueia rotas de módulos sem permissão (acesso direto pela URL).
 * Sem permissão → manda pro 1º módulo liberado; se nenhum, mostra "Sem acesso".
 */
function Protegido({ modulo, children }: { modulo: Modulo; children: ReactNode }) {
  const { user } = useAuth();
  const { pode, carregando } = usePermissoes();
  if (carregando) return <CarregandoTela />;
  if (pode(user?.role, modulo)) return <>{children}</>;
  const alvo = NAV_ITEMS.find((i) => i.enabled && pode(user?.role, i.modulo));
  return alvo ? <Redirect to={alvo.path} /> : <SemAcesso />;
}

/** Área de Administração: só Owner/Admin. Demais voltam pra Configurações. */
function SomenteAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!canGerirUsuarios(user?.role)) return <Redirect to="/config" />;
  return <>{children}</>;
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
          <Route exact path="/dashboard">
            <Protegido modulo="dashboard"><DashboardPage /></Protegido>
          </Route>
          <Route exact path="/minha-area">
            <Protegido modulo="minha-area"><MinhaAreaPage /></Protegido>
          </Route>
          <Route exact path="/clientes">
            <Protegido modulo="clientes"><ClientesListPage /></Protegido>
          </Route>
          <Route exact path="/novo-cliente">
            <Protegido modulo="clientes"><ClienteFormPage /></Protegido>
          </Route>
          <Route
            exact
            path="/clientes/:id/editar"
            render={(props) => (
              <Protegido modulo="clientes">
                <ClienteFormPage id={(props.match.params as { id: string }).id} />
              </Protegido>
            )}
          />
          <Route
            exact
            path="/clientes/:id"
            render={(props) => (
              <Protegido modulo="clientes">
                <ClienteDetailPage id={(props.match.params as { id: string }).id} />
              </Protegido>
            )}
          />
          <Route exact path="/projetos">
            <Protegido modulo="projetos"><ProjetosListPage /></Protegido>
          </Route>
          <Route exact path="/projetos/novo">
            <Protegido modulo="projetos"><ProjetoFormPage /></Protegido>
          </Route>
          <Route
            exact
            path="/projetos/:id/editar"
            render={(props) => (
              <Protegido modulo="projetos">
                <ProjetoFormPage id={(props.match.params as { id: string }).id} />
              </Protegido>
            )}
          />
          <Route
            exact
            path="/projetos/:id"
            render={(props) => (
              <Protegido modulo="projetos">
                <ProjetoDetailPage id={(props.match.params as { id: string }).id} />
              </Protegido>
            )}
          />
          <Route exact path="/tarefas">
            <Protegido modulo="tarefas"><TarefasListPage /></Protegido>
          </Route>
          <Route exact path="/tarefas/nova">
            <Redirect to="/tarefas" />
          </Route>
          <Route exact path="/tarefas/:id/editar" render={(props) => <Redirect to={`/tarefas/${(props.match.params as { id: string }).id}`} />} />
          <Route
            exact
            path="/tarefas/:id"
            render={(props) => (
              <Protegido modulo="tarefas">
                <TarefaDetailPage id={(props.match.params as { id: string }).id} />
              </Protegido>
            )}
          />
          <Route exact path="/quadros">
            <Protegido modulo="quadros"><QuadrosListPage /></Protegido>
          </Route>
          <Route
            exact
            path="/quadros/:id"
            render={(props) => (
              <Protegido modulo="quadros">
                <QuadroBoardPage id={(props.match.params as { id: string }).id} />
              </Protegido>
            )}
          />
          <Route exact path="/equipe">
            <Protegido modulo="equipe"><EquipePage /></Protegido>
          </Route>
          <Route
            exact
            path="/equipe/:id"
            render={(props) => (
              <Protegido modulo="equipe">
                <MembroDetailPage id={(props.match.params as { id: string }).id} />
              </Protegido>
            )}
          />
          <Route exact path="/usuarios">
            <SomenteAdmin><UsuariosPage /></SomenteAdmin>
          </Route>
          <Route exact path="/config/parametros">
            <SomenteAdmin><ParametrosPage /></SomenteAdmin>
          </Route>
          <Route exact path="/config/etapas-projeto">
            <SomenteAdmin><EtapasProjetoPage /></SomenteAdmin>
          </Route>
          <Route exact path="/config/status-tarefa">
            <SomenteAdmin><StatusTarefaPage /></SomenteAdmin>
          </Route>
          <Route exact path="/config/etapas-tarefa">
            <SomenteAdmin><EtapasTarefaConfigPage /></SomenteAdmin>
          </Route>
          <Route exact path="/config/privacidade">
            <SomenteAdmin><PrivacidadePage /></SomenteAdmin>
          </Route>
          <Route exact path="/config/automacoes">
            <SomenteAdmin><AutomacoesPage /></SomenteAdmin>
          </Route>
          <Route exact path="/config">
            <Protegido modulo="config"><ConfigPage /></Protegido>
          </Route>
          <Route exact path="/login">
            <Redirect to="/dashboard" />
          </Route>
          <Route>
            <Redirect to="/dashboard" />
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
            <Route exact path="/tarefas/nova">
              <Redirect to="/tarefas" />
            </Route>
            <Route exact path="/tarefas/:id/editar" render={(props) => <Redirect to={`/tarefas/${(props.match.params as { id: string }).id}`} />} />
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
  // Qualquer conta logada carrega a matriz de permissões do servidor.
  return (
    <PermissoesProvider>
      {user.role === 'Cliente'
        ? <ClienteApp clienteId={user.cliente ?? ''} />
        : <AuthedApp />}
    </PermissoesProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}
