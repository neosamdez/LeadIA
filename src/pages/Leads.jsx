import { useMemo, useState } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { channelOptions, statusOptions } from '../data/mockData';

const statusColor = { 'Novo': 'blue', 'Em atendimento': 'yellow', 'Qualificado': 'blue', 'Proposta': 'yellow', 'Convertido': 'green', 'Perdido': 'red' };

export default function Leads() {
  const { leads, addLead, updateLeadStatus } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Todos');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', channel: 'Instagram', interest: '', value: '' });

  const filtered = useMemo(() => leads.filter(l => {
    const matchQ = (l.name + l.interest + l.channel).toLowerCase().includes(q.toLowerCase());
    const matchS = status === 'Todos' || l.status === status;
    return matchQ && matchS;
  }), [leads, q, status]);

  function create(e) {
    e.preventDefault();
    const id = 'l' + Date.now();
    addLead({
      id, name: form.name, channel: form.channel, interest: form.interest,
      status: 'Novo', value: Number(form.value) || 0,
      lastMessage: 'Lead criado manualmente.', time: 'Agora', avatar: form.name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()
    });
    setForm({ name: '', channel: 'Instagram', interest: '', value: '' });
    setOpen(false);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Leads</h1>
          <p>Gerencie contatos, status e oportunidades comerciais.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Novo lead</button>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute)' }} />
          <input placeholder="Buscar por nome, interesse ou canal..." value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: 220, flex: '0 0 auto' }}>
          <option>Todos</option>
          {statusOptions.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ background: 'var(--surf-2)', textAlign: 'left', fontSize: 13, color: 'var(--mute)' }}>
              {['Lead', 'Canal', 'Interesse', 'Valor', 'Status', 'Última msg', 'Ações'].map(h => (
                <th key={h} style={{ padding: '14px 16px', fontWeight: 600, borderBottom: '1px solid var(--line)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-alt)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>{l.avatar}</div>
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{l.name}</div><div style={{ fontSize: 12, color: 'var(--mute)' }}>{l.time}</div></div>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', fontSize: 14 }}>{l.channel}</td>
                <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--mute)' }}>{l.interest}</td>
                <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 600 }}>R$ {l.value}</td>
                <td style={{ padding: '14px 16px' }}>
                  <select value={l.status} onChange={e => updateLeadStatus(l.id, e.target.value)} style={{ padding: '6px 8px', fontSize: 13, borderRadius: 8, width: 150 }}>
                    {statusOptions.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--mute)', maxWidth: 220 }}><div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.lastMessage}</div></td>
                <td style={{ padding: '14px 16px' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => navigate(`/app/conversas/${l.id}`)}>Abrir</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--mute)' }}>Nenhum lead encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(19,34,44,.35)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 50 }} onClick={() => setOpen(false)}>
          <form className="card" onClick={e => e.stopPropagation()} onSubmit={create} style={{ width: 'min(520px,100%)', padding: 24, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>Novo lead</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>Nome<input required value={form.name} onChange={e=>setForm({...form, name:e.target.value})} /></label>
            <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>Canal
              <select value={form.channel} onChange={e=>setForm({...form, channel:e.target.value})}>{channelOptions.map(c=><option key={c}>{c}</option>)}</select>
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>Interesse<input required value={form.interest} onChange={e=>setForm({...form, interest:e.target.value})} /></label>
            <label style={{ display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }}>Valor estimado (R$)<input type="number" min="0" value={form.value} onChange={e=>setForm({...form, value:e.target.value})} /></label>
            <button className="btn btn-primary" type="submit">Criar lead</button>
          </form>
        </div>
      )}
    </div>
  );
}