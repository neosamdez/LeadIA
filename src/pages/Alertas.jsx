import { useMemo } from 'react';
import { Bell, Flame, Clock, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

function AlertCard({ icon: Icon, color, title, desc, action, onAction }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: color.bg, color: color.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={18} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.45 }}>{desc}</div>
      </div>
      {action && <button className="btn btn-sm btn-outline" onClick={onAction}>{action}</button>}
    </div>
  );
}

export default function Alertas() {
  const { leads } = useApp();
  const navigate = useNavigate();

  const alerts = useMemo(() => {
    const items = [];
    leads.forEach(l => {
      if ((l.score || 0) >= 85 && !['Convertido', 'Perdido'].includes(l.status)) {
        items.push({ id: l.id + '-hot', type: 'hot', icon: Flame, color: { bg: 'rgba(255,90,82,.14)', fg: '#FF8A84' }, title: `Lead quente: ${l.name}`, desc: `Score ${l.score} e status "${l.status}". Priorize resposta e proposta.`, action: 'Abrir', onAction: () => navigate(`/app/conversas/${l.id}`) });
      }
      if (l.status === 'Proposta') {
        items.push({ id: l.id + '-prop', type: 'proposal', icon: Clock, color: { bg: 'rgba(251,191,36,.14)', fg: '#FCD34D' }, title: `Proposta pendente: ${l.name}`, desc: `Proposta enviada para ${l.interest}. Faça follow-up para aumentar conversão.`, action: 'Follow-up', onAction: () => navigate(`/app/conversas/${l.id}`) });
      }
      if (l.status === 'Novo') {
        items.push({ id: l.id + '-new', type: 'new', icon: Bell, color: { bg: 'rgba(96,165,250,.14)', fg: '#93C5FD' }, title: `Novo lead: ${l.name}`, desc: `Entrou via ${l.channel} interessado em ${l.interest}. Responda rapidamente.`, action: 'Atender', onAction: () => navigate(`/app/conversas/${l.id}`) });
      }
      if (l.status === 'Perdido' && !l.lossReason) {
        items.push({ id: l.id + '-loss', type: 'loss', icon: AlertTriangle, color: { bg: 'rgba(251,191,36,.14)', fg: '#FCD34D' }, title: `Perda sem motivo: ${l.name}`, desc: 'Registre o motivo da perda para melhorar o script comercial e analytics.', action: 'Ver lead', onAction: () => navigate('/app/leads') });
      }
      const last = (l.lastMessage || '').toLowerCase();
      if (/caro|preço|alto|desconto/.test(last) && !['Convertido', 'Perdido'].includes(l.status)) {
        items.push({ id: l.id + '-obj', type: 'objection', icon: MessageSquare, color: { bg: 'rgba(167,139,250,.14)', fg: '#C4B5FD' }, title: `Objeção detectada: ${l.name}`, desc: 'O cliente mencionou preço/valor. Use âncora de valor ou condição de parcelamento.', action: 'Responder', onAction: () => navigate(`/app/conversas/${l.id}`) });
      }
    });
    return items;
  }, [leads, navigate]);

  const counts = {
    hot: alerts.filter(a => a.type === 'hot').length,
    proposal: alerts.filter(a => a.type === 'proposal').length,
    objection: alerts.filter(a => a.type === 'objection').length,
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Central de Alertas</h1>
          <p>Ações prioritárias geradas pela IA para não perder oportunidades comerciais.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}><div style={{ color: 'var(--mute)', fontSize: 13 }}>Leads quentes</div><div style={{ fontSize: 32, fontWeight: 800, color: '#FF8A84' }}>{counts.hot}</div></div>
        <div className="card" style={{ padding: 20 }}><div style={{ color: 'var(--mute)', fontSize: 13 }}>Propostas pendentes</div><div style={{ fontSize: 32, fontWeight: 800, color: '#FCD34D' }}>{counts.proposal}</div></div>
        <div className="card" style={{ padding: 20 }}><div style={{ color: 'var(--mute)', fontSize: 13 }}>Objeções detectadas</div><div style={{ fontSize: 32, fontWeight: 800, color: '#C4B5FD' }}>{counts.objection}</div></div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {alerts.map(a => <AlertCard key={a.id} {...a} />)}
        {alerts.length === 0 && (
          <div className="card" style={{ padding: 24, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--mute)' }}>
            <CheckCircle2 size={20} color="#34D399" /> Nenhum alerta no momento. Tudo sob controle.
          </div>
        )}
      </div>

      <style>{`@media (max-width: 800px){ .app-main [style*="repeat(3, minmax(0,1fr))"]{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}