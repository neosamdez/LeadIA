import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Conversations from './pages/Conversations';
import Analytics from './pages/Analytics';
import Kanban from './pages/Kanban';
import Alertas from './pages/Alertas';
import Arquitetura from './pages/Arquitetura';
import Settings from './pages/Settings';

function Protected({ children }) {
  const { user, authReady, databaseReady, loadError, retryLoad, logout } = useApp();
  if (authReady === false) return <p role="status">Restaurando sessão...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mode === 'real' && (!databaseReady || loadError)) return <main style={{ padding: 32 }}>
    <h1>{loadError ? 'Não foi possível carregar seus dados' : 'Carregando sua organização...'}</h1>
    {loadError && <><p role="alert">{loadError}</p><button onClick={retryLoad}>Tentar novamente</button></>}
    <button onClick={logout}>Sair</button>
  </main>;
  return children;
}

function PublicOnly({ children }) {
  const { user, authReady } = useApp();
  if (authReady === false) return <p role="status">Restaurando sessão...</p>;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/app" element={<Protected><AppLayout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="conversas" element={<Conversations />} />
            <Route path="conversas/:leadId" element={<Conversations />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="pipeline" element={<Kanban />} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="arquitetura" element={<Arquitetura />} />
            <Route path="configuracoes" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
