import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, BarChart3, LayoutGrid, Bell, Shield, Settings, LogOut, Bot } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Tour from '../components/Tour';
import './AppLayout.css';

const nav = [
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
  const { user, logout } = useApp();
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand" onClick={() => navigate('/')}>
          <div className="brand-mark"><Bot size={20} /></div>
          <span>Lead<b>IA</b></span>
        </div>
        <nav className="sidebar-nav">
          {nav.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
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
        <Outlet />
      </main>
      <Tour />
    </div>
  );
}