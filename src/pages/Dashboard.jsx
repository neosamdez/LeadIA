import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, MessageSquare, TrendingUp, DollarSign, ArrowRight, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';

function Stat({ icon: Icon, label, value, note, color }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ color: 'var(--mute)', fontSize: 14, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1 }}>{value}</div>
          <div style={{ color: 'var(--mute)', fontSize: 13, marginTop: 8 }}>{note}</div>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: color.bg, color: color.fg, display: 'grid', placeItems: 'center' }}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

const statusColor = {
  'Novo': 'blue', 'Em atendimento': 'yellow', 'Qualificado': 'blue', 'Proposta': 'yellow', 'Convertido': 'green', 'Perdido': 'red'
};

export default function Dashboard() {
  const { leads } = useApp();
  const stats = useMemo(() => {
    const total = leads.length;
    const convertidos = leads.filter(l => l.status === 'Convertido').length;
    const emAberto = leads.filter(l => !['Convertido', 'Perdido'].includes(l.status)).length;
    const receita = leads.filter(l => l.status === 'Convertido').reduce((a, b) => a + b.value, 0);
    const taxa = total ? Math.round((convertidos / total) * 100) : 0;
    return { total, convertidos, emAberto, receita, taxa };
  }, [leads]);

  const recent = leads.slice(0, 5);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral do seu atendimento comercial com IA.</p>
        </div>
        <Link to="/app/conversas" className="btn btn-primary">Ver conversas <ArrowRight size={16} /></Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        <Stat icon={Users} label="Leads recebidos" value={stats.total} note={`${stats.emAberto} em aberto`} color={{ bg: '#E8F0FE', fg: '#2563EB' }} />
        <Stat icon={MessageSquare} label="Atendimentos" value={stats.total} note="Resposta imediata da IA" color={{ bg: '#DDF3E5', fg: '#1C9E5A' }} />
        <Stat icon={TrendingUp} label="Taxa de conversão" value={`${stats.taxa}%`} note={`${stats.convertidos} convertidos`} color={{ bg: '#FFF3DB', fg: '#C47A12' }} />
        <Stat icon={DollarSign} label="Receita gerada" value={`R$ ${stats.receita}`} note="No período simulado" color={{ bg: '#FDE8E6', fg: '#E8453C' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Leads recentes</h2>
            <Link to="/app/leads" style={{ color: 'var(--acc)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Ver todos</Link>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {recent.map((l) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="avatar" style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--bg-alt)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{l.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{l.name}</div>
                  <div style={{ color: 'var(--mute)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.interest}</div>
                </div>
                <span className={`badge ${statusColor[l.status] || ''}`}>{l.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Atividade da IA</h2>
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              { text: 'Respondeu Mariana Costa no Instagram', time: '14:02', color: 'var(--wa)' },
              { text: 'Qualificou Rafael Lima no WhatsApp', time: '13:41', color: 'var(--blue)' },
              { text: 'Enviou proposta para Clínica Vida Plena', time: '12:16', color: 'var(--warn)' },
              { text: 'Registrou conversão de Beatriz Souza', time: '11:03', color: 'var(--wa)' },
            ].map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, marginTop: 7, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{a.text}</div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {a.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, padding: 14, background: 'var(--bg-alt)', borderRadius: 10, fontSize: 14, color: 'var(--mute)' }}>
            <strong style={{ color: 'var(--ink)' }}>Dica:</strong> configure o tom da IA e as regras de follow-up em Configurações.
          </div>
        </div>
      </div>

      <style>{`@media (max-width: 1000px){ .app-main [style*="grid-template-columns: repeat(4"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important} .app-main [style*="1.5fr 1fr"]{grid-template-columns:1fr !important} } @media (max-width: 560px){ .app-main [style*="grid-template-columns: repeat(4"]{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}