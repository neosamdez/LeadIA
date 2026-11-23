import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bot, ArrowRight, Sparkles, ShieldCheck, BarChart3, MessageSquare, LogIn } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isSupabaseConfigured, isRealMode } from '../lib/config';
import * as authService from '../services/auth';

const highlights = [
  { icon: MessageSquare, title: 'Atendimento simulado', text: 'Converse com leads e veja a IA responder em contexto.' },
  { icon: BarChart3, title: 'Métricas em tempo real', text: 'Dashboard, funil, metas e alertas prontos para apresentar.' },
  { icon: ShieldCheck, title: 'Demo segura', text: 'Dados salvos apenas no seu navegador, sem backend.' },
];

export default function Login() {
  const { login } = useApp();
  const navigate = useNavigate();
  const supabaseReady = isSupabaseConfigured();
  const realMode = isRealMode();
  const [mode, setMode] = useState(realMode ? 'real' : 'demo');

  // Demo
  const [name, setName] = useState('Maria Silva');
  const [company, setCompany] = useState('Agência Horizonte');
  const [demoEmail, setDemoEmail] = useState('maria@horizonte.com.br');

  // Real
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submitDemo(e) {
    e.preventDefault();
    login({ name, company, email: demoEmail, mode: 'demo' });
    navigate('/app');
  }

  async function submitReal(e) {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      const data = await authService.signInWithPassword({ email, password });
      const user = data?.user;
      login({
        id: user?.id,
        name: user?.user_metadata?.full_name || email.split('@')[0],
        company: user?.user_metadata?.company || 'Minha Empresa',
        email: user?.email || email,
        mode: 'real',
      });
      navigate('/app');
    } catch (err) {
      setError(err?.message || 'Não foi possível entrar. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!email || !password) { setError('Informe e-mail e senha para criar conta.'); return; }
    setError(''); setInfo(''); setLoading(true);
    try {
      await authService.signUp({ email, password, fullName: email.split('@')[0] });
      setInfo('Conta criada. Verifique seu e-mail se a confirmação estiver habilitada, ou faça login.');
    } catch (err) {
      setError(err?.message || 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '32px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(900px 500px at 15% 10%, rgba(255,90,82,.10), transparent 60%), radial-gradient(700px 420px at 85% 80%, rgba(96,165,250,.08), transparent 55%)', pointerEvents: 'none' }} />
      <div className="login-shell" style={{ width: 'min(1040px, 100%)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'stretch', position: 'relative' }}>
        <div style={{ padding: '20px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 800, fontSize: 30, marginBottom: 28, width: 'fit-content' }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(232,69,60,.14)', color: 'var(--acc)', display: 'grid', placeItems: 'center' }}><Bot size={23} /></span>
            <span>Lead<b style={{ color: 'var(--acc)' }}>IA</b></span>
          </Link>
          <div className="badge blue" style={{ width: 'fit-content', marginBottom: 16 }}><Sparkles size={13} /> {realMode ? 'Ambiente real' : 'Ambiente de demonstração'}</div>
          <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(32px, 4.4vw, 52px)', lineHeight: 1.05, letterSpacing: '-.04em', fontWeight: 800, maxWidth: 560 }}>
            {mode === 'real' ? 'Acesse sua operação comercial.' : 'Entre e apresente o LeadIA em minutos.'}
          </h1>
          <p style={{ color: 'var(--mute)', margin: '0 0 28px', fontSize: 16, lineHeight: 1.7, maxWidth: 540 }}>
            {mode === 'real'
              ? 'Entre com sua conta para acessar leads, conversas e configurações reais da sua organização.'
              : 'Acesse o painel demo com dados simulados, personas, conversas com IA e métricas comerciais prontas para sua apresentação.'}
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {highlights.map(({ icon: Icon, title, text }) => (
              <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(96,165,250,.12)', color: '#93C5FD', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 13, color: 'var(--mute)', lineHeight: 1.55 }}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '32px', minWidth: 0, alignSelf: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 28, lineHeight: 1.15, letterSpacing: '-.03em', fontWeight: 800 }}>Acessar painel</h2>
            <p style={{ color: 'var(--mute)', margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              {mode === 'real' ? 'Use seu e-mail e senha para entrar no ambiente real.' : 'Use os dados de demonstração abaixo ou personalize para a sua apresentação.'}
            </p>
          </div>

          {supabaseReady && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, padding: 4, background: 'rgba(255,255,255,.03)', borderRadius: 12, border: '1px solid var(--line)' }}>
              <button type="button" className={`btn btn-sm ${mode === 'demo' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setMode('demo')}>Demo</button>
              <button type="button" className={`btn btn-sm ${mode === 'real' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setMode('real')}>Conta real</button>
            </div>
          )}

          {error && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,90,82,.12)', color: '#FF8A84', fontSize: 13 }}>{error}</div>}
          {info && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(52,211,153,.12)', color: '#6EE7B7', fontSize: 13 }}>{info}</div>}

          {mode === 'real' ? (
            <form onSubmit={submitReal} style={{ display: 'grid', gap: 16 }}>
              <label style={{ display: 'grid', gap: 7, fontSize: 14, fontWeight: 600 }}>
                E-mail
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" required />
              </label>
              <label style={{ display: 'grid', gap: 7, fontSize: 14, fontWeight: 600 }}>
                Senha
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" required />
              </label>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}>
                <LogIn size={18} /> {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <button className="btn btn-outline" type="button" disabled={loading} onClick={handleSignUp} style={{ width: '100%', justifyContent: 'center' }}>
                Criar conta
              </button>
            </form>
          ) : (
            <form onSubmit={submitDemo} style={{ display: 'grid', gap: 16 }}>
              <label style={{ display: 'grid', gap: 7, fontSize: 14, fontWeight: 600 }}>
                Seu nome
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como você quer ser chamado" required />
              </label>
              <label style={{ display: 'grid', gap: 7, fontSize: 14, fontWeight: 600 }}>
                Empresa
                <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nome da empresa na demo" required />
              </label>
              <label style={{ display: 'grid', gap: 7, fontSize: 14, fontWeight: 600 }}>
                E-mail
                <input type="email" value={demoEmail} onChange={(e) => setDemoEmail(e.target.value)} placeholder="voce@empresa.com" required />
              </label>
              <button className="btn btn-primary" type="submit" style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}>
                Entrar na demonstração <ArrowRight size={18} />
              </button>
            </form>
          )}

          <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{mode === 'real' ? 'Modo real' : 'Modo demo'}</div>
            <p style={{ fontSize: 13, color: 'var(--mute)', margin: 0, lineHeight: 1.55 }}>
              {mode === 'real'
                ? 'A autenticação usa Supabase. Dados e permissões devem ser configurados no projeto Supabase.'
                : 'Sem backend: o acesso é simulado e os dados ficam salvos apenas neste navegador.'}
            </p>
          </div>
          <p style={{ fontSize: 13, color: 'var(--mute)', marginTop: 18, marginBottom: 0, textAlign: 'center' }}>
            <Link to="/" style={{ color: '#93C5FD', textDecoration: 'none', fontWeight: 600 }}>← Voltar para a página inicial</Link>
          </p>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) { .login-shell { grid-template-columns: 1fr !important; gap: 20px !important; max-width: 560px; } }
        @media (max-width: 520px) { .login-shell .card { padding: 22px !important; } }
      `}</style>
    </div>
  );
}
