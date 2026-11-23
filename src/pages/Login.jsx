import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Login() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('Maria Silva');
  const [company, setCompany] = useState('Agência Horizonte');
  const [email, setEmail] = useState('maria@horizonte.com.br');

  function submit(e) {
    e.preventDefault();
    login({ name, company, email });
    navigate('/app');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
      <div className="card" style={{ width: 'min(480px, 100%)', padding: 32 }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', fontWeight: 800, fontSize: 28, marginBottom: 24 }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(232,69,60,.12)', color: 'var(--acc)', display: 'grid', placeItems: 'center' }}><Bot size={22} /></span>
          <span>Lead<b style={{ color: 'var(--acc)' }}>IA</b></span>
        </Link>
        <h1 style={{ margin: '0 0 8px', fontSize: 32, lineHeight: 1.1, letterSpacing: '-.03em' }}>Entrar na demonstração</h1>
        <p style={{ color: 'var(--mute)', margin: '0 0 24px' }}>Acesse o painel demo com dados simulados para apresentar o produto.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>
            Seu nome
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>
            Empresa
            <input value={company} onChange={(e) => setCompany(e.target.value)} required />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button className="btn btn-primary" type="submit" style={{ marginTop: 6 }}>Acessar painel</button>
        </form>
        <p style={{ fontSize: 13, color: 'var(--mute)', marginTop: 16 }}>Sem backend: os dados ficam salvos no seu navegador para a demonstração.</p>
      </div>
    </div>
  );
}