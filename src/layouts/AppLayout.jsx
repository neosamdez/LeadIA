import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, BarChart3, LayoutGrid, Bell, Shield, Settings, LogOut, Bot, Menu, X, Sun } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Tour from '../components/Tour';
import './AppLayout.css';

const nav = [
  { to: '/app/hoje', icon: Sun, label: 'Hoje' },
  { to: '/app', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/leads', icon: Users, label: 'Leads' },
  { to: '/app/conversas', icon: MessageSquare, label: 'Conversas' },
  { to: '/app/pipeline', icon: LayoutGrid, label: 'Pipeline' },
  { to: '/app/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/app/alertas', icon: Bell, label: 'Alertas' },
  { to: '/app/arquitetura', icon: Shield, label: 'Arquitetura' },
  { to: '/app/configuracoes', icon: Settings, label: 'Configurações' },
];

export default function AppLayout() {
  const { user, logout, pendingWrites, syncError, clearSyncError } = useApp();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={menuOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="sidebar-top">
          <Link className="sidebar-brand" to="/">
            <div className="brand-mark"><Bot size={20} /></div>
            <span>Lead<b>IA</b></span>
          </Link>
          <button type="button" className="btn btn-ghost sidebar-toggle" aria-expanded={menuOpen} aria-controls="sidebar-nav sidebar-account" onClick={() => setMenuOpen(open => !open)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />} Menu
          </button>
        </div>
        <nav id="sidebar-nav" className="sidebar-nav" aria-label="Navegação principal">
          {nav.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div id="sidebar-account" className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{(user?.name || 'U').slice(0,2).toUpperCase()}</div>
            <div className="user-meta">
              <strong>{user?.name || 'Usuário'}</strong>
              <span>{user?.company || 'Demo'}</span>
            </div>
          </div>
          <button className="nav-item logout" onClick={() => { logout(); navigate('/'); }}>
            <LogOut size={18} /><span>Sair</span>
          </button>
        </div>
      </aside>
      <main className="app-main">
        {pendingWrites > 0 && <p role="status" aria-live="polite">Salvando no banco...</p>}
        {syncError && <div role="alert" style={{ padding: 16, marginBottom: 16, border: '1px solid #f87171', borderRadius: 8 }}>
          <p>{syncError}</p><button onClick={clearSyncError}>Fechar aviso</button>
        </div>}
        <Outlet />
      </main>
      <Tour />
    </div>
  );
}
