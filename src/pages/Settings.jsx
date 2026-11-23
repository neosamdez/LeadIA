import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Settings() {
  const { settings, updateSettings, resetDemo, user } = useApp();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  function save(e) {
    e.preventDefault();
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <p>Personalize o comportamento da IA para a demonstração.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 16 }}>
        <form className="card" onSubmit={save} style={{ padding: 24, display: 'grid', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Perfil da empresa</h2>
          <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>Nome da empresa
            <input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>Segmento
            <select value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
              {['Agências de viagens', 'Salões de beleza', 'Clínicas', 'Lojas de roupas', 'Imobiliárias', 'Cursos e escolas'].map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>Tom da IA
            <select value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value })}>
              {['Profissional e amigável', 'Formal', 'Descontraído', 'Consultivo e comercial'].map(s => <option key={s}>{s}</option>)}
            </select>
          </label>

          <div style={{ display: 'grid', gap: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={form.autoReply} onChange={e => setForm({ ...form, autoReply: e.target.checked })} style={{ width: 18, height: 18 }} />
              Resposta automática ativa
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={form.followUp} onChange={e => setForm({ ...form, followUp: e.target.checked })} style={{ width: 18, height: 18 }} />
              Follow-up inteligente ativo
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" type="submit"><Save size={16} /> Salvar configurações</button>
            {saved && <span style={{ color: 'var(--wa)', fontWeight: 600, fontSize: 14 }}>Salvo!</span>}
          </div>
        </form>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>Conta demo</h2>
            <div style={{ fontSize: 14, color: 'var(--mute)', display: 'grid', gap: 6 }}>
              <div><strong style={{ color: 'var(--ink)' }}>Usuário:</strong> {user?.name}</div>
              <div><strong style={{ color: 'var(--ink)' }}>E-mail:</strong> {user?.email}</div>
              <div><strong style={{ color: 'var(--ink)' }}>Empresa:</strong> {user?.company}</div>
            </div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Resetar demonstração</h2>
            <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--mute)' }}>Restaura leads, conversas e configurações para o estado inicial.</p>
            <button className="btn btn-outline" onClick={() => { if (confirm('Resetar dados da demonstração?')) resetDemo(); }}><RotateCcw size={16} /> Resetar dados</button>
          </div>
          <div className="card" style={{ padding: 24, background: 'linear-gradient(135deg, rgba(255,90,82,.18), rgba(96,165,250,.08))', borderColor: 'rgba(255,90,82,.25)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--ink)' }}>Modo apresentação</h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--mute)' }}>Este projeto usa dados simulados em localStorage. Ideal para apresentar o fluxo comercial da LeadIA sem depender de APIs externas.</p>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 900px){ .app-main [style*="1.2fr .8fr"]{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}