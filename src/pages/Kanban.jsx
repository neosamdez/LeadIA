import { useMemo, useState } from 'react';
import { GripVertical, ArrowRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { channelOptions } from '../data/mockData';

const columns = ['Novo', 'Em atendimento', 'Qualificado', 'Proposta', 'Convertido', 'Perdido'];
const colColor = {
  'Novo': '#60A5FA', 'Em atendimento': '#FBBF24', 'Qualificado': '#A78BFA',
  'Proposta': '#FF5A52', 'Convertido': '#34D399', 'Perdido': '#94A3B3'
};

export default function Kanban() {
  const { leads, updateLeadStatus } = useApp();
  const navigate = useNavigate();
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('Todos');

  const filtered = useMemo(() => leads.filter(l => {
    const matchQ = (l.name + l.interest + (l.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase());
    const matchC = channel === 'Todos' || l.channel === channel;
    return matchQ && matchC;
  }), [leads, q, channel]);

  const grouped = useMemo(() => {
    const g = Object.fromEntries(columns.map(c => [c, []]));
    filtered.forEach(l => { (g[l.status] || g['Novo']).push(l); });
    return g;
  }, [filtered]);

  function onDrop(col) {
    if (dragId) updateLeadStatus(dragId, col);
    setDragId(null); setOverCol(null);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Pipeline Kanban</h1>
          <p>Arraste os leads entre etapas para atualizar o funil comercial em tempo real.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute)' }} />
          <input placeholder="Buscar lead, interesse ou tag..." value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <select value={channel} onChange={e => setChannel(e.target.value)} style={{ width: 180 }}>
          <option value="Todos">Todos canais</option>
          {channelOptions.map(c => <option key={c}>{c}</option>)}
        </select>
        <div style={{ fontSize: 13, color: 'var(--mute)' }}>{filtered.length} lead(s)</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(220px, 1fr))', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
        {columns.map(col => (
          <div key={col}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col); }}
            onDragLeave={() => setOverCol(null)}
            onDrop={() => onDrop(col)}
            style={{ minHeight: 420, background: overCol === col ? 'rgba(255,90,82,.06)' : 'rgba(255,255,255,.02)', border: `1px solid ${overCol === col ? 'rgba(255,90,82,.35)' : 'var(--line)'}`, borderRadius: 14, padding: 12, transition: '.2s' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colColor[col] }} />
                {col}
              </div>
              <span className="badge">{grouped[col].length}</span>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {grouped[col].map(l => (
                <div key={l.id}
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  style={{ padding: 12, borderRadius: 12, background: 'var(--surf)', border: '1px solid var(--line)', cursor: 'grab', opacity: dragId === l.id ? 0.5 : 1, boxShadow: '0 4px 14px rgba(0,0,0,.12)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{l.name}</div>
                    <GripVertical size={14} color="var(--mute)" />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 8 }}>{l.interest}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span className="badge blue" style={{ fontSize: 11 }}>{l.channel}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#FCD34D' }}>R$ {l.value}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 6 }}>Score: <span style={{ color: (l.score ?? 60) >= 80 ? '#6EE7B7' : (l.score ?? 60) >= 60 ? '#FCD34D' : '#FF8A84', fontWeight: 700 }}>{l.score ?? 60}</span></div>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={() => navigate(`/app/conversas/${l.id}`)}>
                    Abrir chat <ArrowRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}