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
        <form className="card" onSubmit={save} style={{ padding: 24, display: 'grid', gap: 18, alignContent: 'start', alignSelf: 'start' }}>
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
            <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>Integração NVIDIA API</h2>
            <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--mute)' }}>Use a API da NVIDIA NIM para gerar respostas reais da IA nas conversas. A chave fica salva apenas no seu navegador (localStorage).</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
                <input type="checkbox" checked={!!form.useNvidiaApi} onChange={e => setForm({ ...form, useNvidiaApi: e.target.checked })} style={{ width: 18, height: 18 }} />
                Usar NVIDIA API nas conversas
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>API Key
                <input type="password" value={form.nvidiaApiKey || ''} onChange={e => setForm({ ...form, nvidiaApiKey: e.target.value })} placeholder="nvapi-..." autoComplete="off" />
                {!form.nvidiaApiKey && import.meta.env.VITE_NVIDIA_API_KEY && <span style={{ fontSize: 12, color: '#6EE7B7', fontWeight: 400 }}>Chave detectada via .env.local (variável de ambiente).</span>}
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>Modelo
                <input value={form.nvidiaModel || ''} onChange={e => setForm({ ...form, nvidiaModel: e.target.value })} placeholder="nvidia/nemotron-3.5-lightning-30b-a3b" />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>Proxy URL (opcional)
                <input value={form.nvidiaProxyUrl || ''} onChange={e => setForm({ ...form, nvidiaProxyUrl: e.target.value })} placeholder="https://seu-proxy.com/v1/chat/completions" />
                <span style={{ fontSize: 12, color: 'var(--mute)', fontWeight: 400 }}>Use um proxy para evitar CORS no browser (recomendado para GitHub Pages).</span>
              </label>
              <div style={{ fontSize: 12, color: 'var(--mute)' }}>Endpoint direto: <code style={{ color: 'var(--ink)' }}>https://integrate.api.nvidia.com/v1/chat/completions</code></div>
            </div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Resetar demonstração</h2>
            <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--mute)' }}>Restaura leads, conversas e configurações para o estado inicial.</p>
            <button className="btn btn-outline" onClick={() => { if (confirm('Resetar dados da demonstração?')) resetDemo(); }}><RotateCcw size={16} /> Resetar dados</button>
          </div>
          <div className="card" style={{ padding: 24, background: 'linear-gradient(135deg, rgba(255,90,82,.18), rgba(96,165,250,.08))', borderColor: 'rgba(255,90,82,.25)' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--ink)' }}>Modo apresentação</h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--mute)' }}>Os dados de leads/conversas são simulados em localStorage. Com a NVIDIA API configurada, as respostas da IA nas conversas são geradas em tempo real.</p>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 900px){ .app-main [style*="1.2fr"]{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}