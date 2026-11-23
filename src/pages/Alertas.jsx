import { useMemo, useState } from 'react';
import { Bell, Flame, Clock, AlertTriangle, CheckCircle2, MessageSquare, X, CalendarPlus, ListChecks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

function AlertCard({ icon: Icon, color, title, desc, action, onAction, onDismiss, onFollowUp }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: color.bg, color: color.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={18} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--mute)', lineHeight: 1.45 }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {onFollowUp && <button className="btn btn-sm btn-ghost" onClick={onFollowUp} title="Criar follow-up"><CalendarPlus size={14} /> Follow-up</button>}
        {action && <button className="btn btn-sm btn-outline" onClick={onAction}>{action}</button>}
        {onDismiss && <button className="btn btn-sm btn-ghost" onClick={onDismiss} title="Dispensar alerta"><X size={14} /></button>}
      </div>
    </div>
  );
}

export default function Alertas() {
  const { leads, dismissedAlerts, dismissAlert, clearDismissedAlerts, addFollowUp, followUps, completeFollowUp } = useApp();
  const navigate = useNavigate();
  const [showDone, setShowDone] = useState(false);

  const alerts = useMemo(() => {
    const items = [];
    leads.forEach(l => {
      if ((l.score || 0) >= 85 && !['Convertido', 'Perdido'].includes(l.status)) {
        items.push({ id: l.id + '-hot', leadId: l.id, type: 'hot', icon: Flame, color: { bg: 'rgba(255,90,82,.14)', fg: '#FF8A84' }, title: `Lead quente: ${l.name}`, desc: `Score ${l.score} e status "${l.status}". Priorize resposta e proposta.`, action: 'Abrir', onAction: () => navigate(`/app/conversas/${l.id}`) });
      }
      if (l.status === 'Proposta') {
        items.push({ id: l.id + '-prop', leadId: l.id, type: 'proposal', icon: Clock, color: { bg: 'rgba(251,191,36,.14)', fg: '#FCD34D' }, title: `Proposta pendente: ${l.name}`, desc: `Proposta enviada para ${l.interest}. Faça follow-up para aumentar conversão.`, action: 'Conversar', onAction: () => navigate(`/app/conversas/${l.id}`) });
      }
      if (l.status === 'Novo') {
        items.push({ id: l.id + '-new', leadId: l.id, type: 'new', icon: Bell, color: { bg: 'rgba(96,165,250,.14)', fg: '#93C5FD' }, title: `Novo lead: ${l.name}`, desc: `Entrou via ${l.channel} interessado em ${l.interest}. Responda rapidamente.`, action: 'Atender', onAction: () => navigate(`/app/conversas/${l.id}`) });
      }
      if (l.status === 'Perdido' && !l.lossReason) {
        items.push({ id: l.id + '-loss', leadId: l.id, type: 'loss', icon: AlertTriangle, color: { bg: 'rgba(251,191,36,.14)', fg: '#FCD34D' }, title: `Perda sem motivo: ${l.name}`, desc: 'Registre o motivo da perda para melhorar o script comercial e analytics.', action: 'Ver lead', onAction: () => navigate('/app/leads') });
      }
      const last = (l.lastMessage || '').toLowerCase();
      if (/caro|preço|alto|desconto/.test(last) && !['Convertido', 'Perdido'].includes(l.status)) {
        items.push({ id: l.id + '-obj', leadId: l.id, type: 'objection', icon: MessageSquare, color: { bg: 'rgba(167,139,250,.14)', fg: '#C4B5FD' }, title: `Objeção detectada: ${l.name}`, desc: 'O cliente mencionou preço/valor. Use âncora de valor ou condição de parcelamento.', action: 'Responder', onAction: () => navigate(`/app/conversas/${l.id}`) });
      }
    });
    return items.filter(a => !dismissedAlerts.includes(a.id));
  }, [leads, navigate, dismissedAlerts]);

  const counts = {
    hot: alerts.filter(a => a.type === 'hot').length,
    proposal: alerts.filter(a => a.type === 'proposal').length,
    objection: alerts.filter(a => a.type === 'objection').length,
  };
  const visibleFollowUps = followUps.filter(f => showDone || !f.done);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Central de Alertas</h1>
          <p>Ações prioritárias geradas pela IA para não perder oportunidades comerciais.</p>
        </div>
        {dismissedAlerts.length > 0 && <button className="btn btn-outline btn-sm" onClick={clearDismissedAlerts}>Restaurar dispensados ({dismissedAlerts.length})</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}><div style={{ color: 'var(--mute)', fontSize: 13 }}>Leads quentes</div><div style={{ fontSize: 32, fontWeight: 800, color: '#FF8A84' }}>{counts.hot}</div></div>
        <div className="card" style={{ padding: 20 }}><div style={{ color: 'var(--mute)', fontSize: 13 }}>Propostas pendentes</div><div style={{ fontSize: 32, fontWeight: 800, color: '#FCD34D' }}>{counts.proposal}</div></div>
        <div className="card" style={{ padding: 20 }}><div style={{ color: 'var(--mute)', fontSize: 13 }}>Objeções detectadas</div><div style={{ fontSize: 32, fontWeight: 800, color: '#C4B5FD' }}>{counts.objection}</div></div>
      </div>

      <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
        {alerts.map(a => (
          <AlertCard
            key={a.id}
            {...a}
            onDismiss={() => dismissAlert(a.id)}
            onFollowUp={() => addFollowUp({ leadId: a.leadId, title: `Follow-up: ${leads.find(l => l.id === a.leadId)?.name || 'Lead'}`, note: a.title, when: 'Hoje' })}
          />
        ))}
        {alerts.length === 0 && (
          <div className="card" style={{ padding: 24, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--mute)' }}>
            <CheckCircle2 size={20} color="#34D399" /> Nenhum alerta no momento. Tudo sob controle.
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 20, display: 'flex', gap: 8, alignItems: 'center' }}><ListChecks size={18} color="var(--acc)" /> Follow-ups</h2>
          <label style={{ fontSize: 13, color: 'var(--mute)', display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> Mostrar concluídos</label>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {visibleFollowUps.map(f => {
            const lead = leads.find(l => l.id === f.leadId);
            return (
              <div key={f.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, border: '1px solid var(--line)', borderRadius: 10, opacity: f.done ? 0.6 : 1 }}>
                <input type="checkbox" checked={f.done} onChange={() => completeFollowUp(f.id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, textDecoration: f.done ? 'line-through' : 'none' }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--mute)' }}>{f.note} · {f.when}{lead ? ` · ${lead.channel}` : ''}</div>
                </div>
                {lead && <button className="btn btn-sm btn-outline" onClick={() => navigate(`/app/conversas/${lead.id}`)}>Abrir</button>}
              </div>
            );
          })}
          {visibleFollowUps.length === 0 && <div style={{ color: 'var(--mute)', fontSize: 14 }}>Nenhum follow-up pendente. Crie a partir de um alerta.</div>}
        </div>
      </div>

      <style>{`@media (max-width: 800px){ .app-main [style*="repeat(3, minmax(0,1fr))"]{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}