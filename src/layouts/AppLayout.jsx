import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, BarChart3, LayoutGrid, Bell, Settings, LogOut, Menu, X, Sun, Bot, Plug, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
  { to: '/app/agentes', icon: Bot, label: 'Agentes' },
  { to: '/app/integracoes', icon: Plug, label: 'Integrações' },
  { to: '/app/configuracoes', icon: Settings, label: 'Configurações' },
];

const COLLAPSE_KEY = 'leadia_sidebar_collapsed';

export default function AppLayout() {
  const { user, logout, pendingWrites, syncError, clearSyncError } = useApp();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* armazenamento indisponível */ }
  }, [collapsed]);

  const sidebarClass = ['sidebar', menuOpen && 'sidebar-open'].filter(Boolean).join(' ');
  return (
    <div className={collapsed ? 'app-shell is-collapsed' : 'app-shell'}>
      <aside className={sidebarClass}>
        <div className="sidebar-top">
          <Link className="sidebar-brand" to="/" title="LeadIA">
            <span className="brand-mark" aria-hidden="true">L</span>
            <span className="nav-label">LeadIA</span>
          </Link>
          <button type="button" className="btn btn-ghost sidebar-toggle" aria-expanded={menuOpen} aria-controls="sidebar-nav sidebar-account" onClick={() => setMenuOpen(open => !open)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />} Menu
          </button>
        </div>
        <nav id="sidebar-nav" className="sidebar-nav" aria-label="Navegação principal">
          {nav.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}
              onClick={() => setMenuOpen(false)} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <Icon size={18} /><span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div id="sidebar-account" className="sidebar-foot">
          <button type="button" className="nav-item collapse-toggle" aria-pressed={collapsed} title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} onClick={() => setCollapsed(c => !c)}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}<span className="nav-label">Recolher menu</span>
          </button>
          <div className="user-chip" title={collapsed ? `${user?.name || 'Usuário'} · ${user?.company || 'Demo'}` : undefined}>
            <div className="avatar">{(user?.name || 'U').slice(0, 2).toUpperCase()}</div>
            <div className="user-meta nav-label">
              <strong>{user?.name || 'Usuário'}</strong>
              <span>{user?.company || 'Demo'}</span>
            </div>
          </div>
          <button className="nav-item logout" title={collapsed ? 'Sair' : undefined} aria-label={collapsed ? 'Sair' : undefined} onClick={() => { logout(); navigate('/'); }}>
            <LogOut size={18} /><span className="nav-label">Sair</span>
          </button>
        </div>
      </aside>
      <main className="app-main">
        {pendingWrites > 0 && <p className="sync-status" role="status" aria-live="polite">Salvando no banco…</p>}
        {syncError && <div className="sync-alert" role="alert">
          <p>{syncError}</p><button type="button" className="btn btn-sm btn-outline" onClick={clearSyncError}>Fechar aviso</button>
        </div>}
        <Outlet />
      </main>
      <Tour />
    </div>
  );
}
