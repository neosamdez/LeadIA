import { useMemo } from 'react';
import { BarChart3, TrendingUp, Clock, DollarSign, MessageSquare, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

function Kpi({ icon: Icon, label, value, note, color }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: 'var(--mute)', fontSize: 13, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.03em' }}>{value}</div>
          <div style={{ color: 'var(--mute)', fontSize: 12, marginTop: 6 }}>{note}</div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: color.bg, color: color.fg, display: 'grid', placeItems: 'center' }}><Icon size={18} /></div>
      </div>
    </div>
  );
}

function Bars({ items, valueKey = 'value', labelKey = 'label', color = 'var(--acc)', suffix = '' }) {
  const max = Math.max(1, ...items.map(i => i[valueKey]));
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {items.map((it) => (
        <div key={it[labelKey]}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span>{it[labelKey]}</span>
            <span style={{ color: 'var(--mute)' }}>{it[valueKey]}{suffix}{it.extra ? ` · ${it.extra}` : ''}</span>
          </div>
          <div style={{ height: 10, background: 'var(--bg-alt)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(it[valueKey] / max) * 100}%`, height: '100%', background: it.color || color, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { leads } = useApp();

  const data = useMemo(() => {
    const total = leads.length || 1;
    const convertidos = leads.filter(l => l.status === 'Convertido');
    const perdidos = leads.filter(l => l.status === 'Perdido');
    const emAberto = leads.filter(l => !['Convertido', 'Perdido'].includes(l.status));
    const receita = convertidos.reduce((a, b) => a + (b.value || 0), 0);
    const potencial = emAberto.reduce((a, b) => a + (b.value || 0), 0);
    const taxa = Math.round((convertidos.length / total) * 100);
    const avgScore = Math.round(leads.reduce((a, b) => a + (b.score || 50), 0) / total);

    const funnelStages = ['Novo', 'Em atendimento', 'Qualificado', 'Proposta', 'Convertido'];
    const funnel = funnelStages.map(s => ({ label: s, value: leads.filter(l => l.status === s).length }));

    const channels = ['Instagram', 'WhatsApp'].map(c => {
      const ls = leads.filter(l => l.channel === c);
      const conv = ls.filter(l => l.status === 'Convertido').length;
      return { label: c, value: ls.length, extra: `${conv} convertido(s)`, color: c === 'Instagram' ? '#FF5A52' : '#34D399' };
    });

    const reasonsMap = {};
    perdidos.forEach(l => { const r = l.lossReason || 'Não informado'; reasonsMap[r] = (reasonsMap[r] || 0) + 1; });
    const reasons = Object.entries(reasonsMap).map(([label, value]) => ({ label, value }));
    if (reasons.length === 0) reasons.push({ label: 'Nenhuma perda registrada', value: 0 });

    return { total: leads.length, convertidos: convertidos.length, perdidos: perdidos.length, receita, potencial, taxa, avgScore, funnel, channels, reasons };
  }, [leads]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p>Inteligência comercial para entender desempenho, conversão e oportunidades.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        <Kpi icon={TrendingUp} label="Taxa de conversão" value={`${data.taxa}%`} note={`${data.convertidos} de ${data.total} leads`} color={{ bg: 'rgba(52,211,153,.14)', fg: '#6EE7B7' }} />
        <Kpi icon={DollarSign} label="Receita convertida" value={`R$ ${data.receita}`} note={`R$ ${data.potencial} em aberto`} color={{ bg: 'rgba(255,90,82,.14)', fg: '#FF8A84' }} />
        <Kpi icon={Clock} label="Tempo médio resposta" value="< 1 min" note="Simulação IA ativa" color={{ bg: 'rgba(96,165,250,.14)', fg: '#93C5FD' }} />
        <Kpi icon={BarChart3} label="Score médio" value={data.avgScore} note="Qualidade dos leads" color={{ bg: 'rgba(251,191,36,.14)', fg: '#FCD34D' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 20, display: 'flex', gap: 8, alignItems: 'center' }}><TrendingUp size={18} color="var(--acc)" /> Funil por etapa</h2>
          <Bars items={data.funnel} suffix=" lead(s)" />
        </div>
        <div className="card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 20, display: 'flex', gap: 8, alignItems: 'center' }}><MessageSquare size={18} color="var(--acc)" /> Desempenho por canal</h2>
          <Bars items={data.channels} suffix=" lead(s)" />
          <div style={{ marginTop: 18, padding: 14, background: 'var(--bg-alt)', borderRadius: 12, fontSize: 13, color: 'var(--mute)' }}>
            <strong style={{ color: 'var(--ink)' }}>Insight:</strong> priorize o canal com maior volume e teste scripts de follow-up no canal com menor conversão.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 20, display: 'flex', gap: 8, alignItems: 'center' }}><AlertCircle size={18} color="var(--acc)" /> Motivos de perda</h2>
          <Bars items={data.reasons} suffix=" caso(s)" color="#FBBF24" />
        </div>
        <div className="card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>Recomendações da IA</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              'Responder leads novos em até 1 minuto aumenta a chance de qualificação.',
              'Leads com objeção de preço devem receber opção de parcelamento ou âncora de valor.',
              'Leads em “Proposta” há mais de 24h devem entrar em sequência de follow-up.',
              'Registrar motivo de perda ajuda a treinar o script comercial e melhorar conversão.',
            ].map((t, i) => (
              <div key={i} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 10, fontSize: 14, color: 'var(--mute)', background: 'rgba(255,255,255,.02)' }}>{t}</div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@media (max-width: 1000px){ .app-main [style*="repeat(4, minmax(0,1fr))"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important} .app-main [style*="1.2fr .8fr"], .app-main [style*="1fr 1fr"]{grid-template-columns:1fr !important} } @media (max-width: 560px){ .app-main [style*="repeat(4, minmax(0,1fr))"]{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}