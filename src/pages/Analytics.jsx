import { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Clock, DollarSign, MessageSquare, AlertCircle, Activity } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useApp } from '../context/AppContext';
import RealAnalytics from './RealAnalytics';
import AnalyticsGoals from './AnalyticsGoals';

const COLORS = ['#0F766E', '#1D4ED8', '#15803D', '#B45309', '#6D28D9', '#BE185D'];

function Kpi({ icon: Icon, label, value, note, color }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: 'var(--mute)', fontSize: 13, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 650, letterSpacing: '-.03em' }}>{value}</div>
          <div style={{ color: 'var(--mute)', fontSize: 12, marginTop: 6 }}>{note}</div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: color.bg, color: color.fg, display: 'grid', placeItems: 'center' }}><Icon size={18} /></div>
      </div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: '#FFFFFF', border: '1px solid #D6D3D1', borderRadius: 8, color: '#1C1917' },
  itemStyle: { color: '#1C1917' },
  labelStyle: { color: '#57534E' },
  cursor: { fill: '#F5F5F4' },
};

function ChartTypeSwitch({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.value} className={`btn btn-sm ${value === o.value ? 'btn-primary' : 'btn-outline'}`} onClick={() => onChange(o.value)} style={{ padding: '6px 10px', fontSize: 12 }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ChartCard({ title, icon: Icon, type, setType, options, children, note }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, display: 'flex', gap: 8, alignItems: 'center' }}><Icon size={18} color="var(--acc)" /> {title}</h2>
        <ChartTypeSwitch value={type} onChange={setType} options={options} />
      </div>
      <div style={{ width: '100%', height: 300 }}>{children}</div>
      {note && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--mute)' }}>{note}</div>}
    </div>
  );
}

export default function Analytics() {
  const { user, orgId } = useApp();
  return user?.mode === 'real' ? <RealAnalytics key={orgId} orgId={orgId} /> : <DemoAnalytics />;
}

function DemoAnalytics() {
  const { leads, goals } = useApp();
  const [funnelType, setFunnelType] = useState('bar');
  const [channelType, setChannelType] = useState('pie');
  const [lossType, setLossType] = useState('bar');
  const [trendType, setTrendType] = useState('area');

  const data = useMemo(() => {
    const total = leads.length || 1;
    const convertidos = leads.filter(l => l.status === 'Convertido');
    const perdidos = leads.filter(l => l.status === 'Perdido');
    const emAberto = leads.filter(l => !['Convertido', 'Perdido'].includes(l.status));
    const receita = convertidos.reduce((a, b) => a + (b.value || 0), 0);
    const potencial = emAberto.reduce((a, b) => a + (b.value || 0), 0);
    const taxa = Math.round((convertidos.length / total) * 100);
    const avgScore = Math.round(leads.reduce((a, b) => a + (b.score || 50), 0) / total);

    const funnel = ['Novo', 'Em atendimento', 'Qualificado', 'Proposta', 'Convertido'].map((s, i) => ({
      etapa: s, leads: leads.filter(l => l.status === s).length, fill: '#0F766E'
    }));

    const channels = ['Instagram', 'WhatsApp'].map((c) => {
      const ls = leads.filter(l => l.channel === c);
      return { canal: c, leads: ls.length, convertidos: ls.filter(l => l.status === 'Convertido').length, receita: ls.filter(l => l.status === 'Convertido').reduce((a, b) => a + (b.value || 0), 0) };
    });
    const pieChannels = channels.map((c, i) => ({ name: c.canal, value: c.leads, fill: COLORS[i] }));

    const reasonsMap = {};
    perdidos.forEach(l => { const r = l.lossReason || 'Não informado'; reasonsMap[r] = (reasonsMap[r] || 0) + 1; });
    const reasons = Object.entries(reasonsMap).map(([motivo, valor], i) => ({ motivo, valor, fill: COLORS[i % COLORS.length] }));
    if (reasons.length === 0) reasons.push({ motivo: 'Nenhuma perda', valor: 0, fill: '#15803D' });

    const trend = [
      { semana: 'Sem 1', leads: Math.max(1, Math.round(total * 0.4)), convertidos: 0, receita: 0 },
      { semana: 'Sem 2', leads: Math.max(1, Math.round(total * 0.6)), convertidos: Math.max(0, Math.round(convertidos.length * 0.3)), receita: Math.round(receita * 0.2) },
      { semana: 'Sem 3', leads: Math.max(2, Math.round(total * 0.8)), convertidos: Math.max(0, Math.round(convertidos.length * 0.6)), receita: Math.round(receita * 0.6) },
      { semana: 'Sem 4', leads: total, convertidos: convertidos.length, receita },
    ];

    return { total: leads.length, convertidos: convertidos.length, receita, potencial, taxa, avgScore, funnel, channels, pieChannels, reasons, trend };
  }, [leads]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p>Demonstração · Os indicadores e gráficos usam dados de exemplo.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        <Kpi icon={TrendingUp} label="Taxa de conversão" value={`${data.taxa}%`} note={`${data.convertidos} de ${data.total} leads`} color={{ bg: 'var(--surf-2)', fg: 'var(--mute)' }} />
        <Kpi icon={DollarSign} label="Receita convertida" value={`R$ ${data.receita}`} note={`R$ ${data.potencial} em aberto`} color={{ bg: 'var(--surf-2)', fg: 'var(--mute)' }} />
        <Kpi icon={Clock} label="Tempo médio resposta" value="< 1 min" note="Simulação IA ativa" color={{ bg: 'var(--surf-2)', fg: 'var(--mute)' }} />
        <Kpi icon={BarChart3} label="Score médio" value={data.avgScore} note="Qualidade dos leads" color={{ bg: 'var(--surf-2)', fg: 'var(--mute)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="Funil comercial" icon={TrendingUp} type={funnelType} setType={setFunnelType} options={[{ value: 'bar', label: 'Barras' }, { value: 'area', label: 'Área' }, { value: 'line', label: 'Linha' }]} note="Passe o mouse nos pontos/barras para ver detalhes.">
          <ResponsiveContainer width="100%" height="100%">
            {funnelType === 'bar' ? (
              <BarChart data={data.funnel} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="etapa" stroke="#57534E" fontSize={12} />
                <YAxis stroke="#57534E" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="leads" name="Leads" radius={[8, 8, 0, 0]}>
                  {data.funnel.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            ) : funnelType === 'area' ? (
              <AreaChart data={data.funnel} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs><linearGradient id="funnelG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0F766E" stopOpacity={0.45} /><stop offset="95%" stopColor="#0F766E" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="etapa" stroke="#57534E" fontSize={12} />
                <YAxis stroke="#57534E" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#0F766E" fill="url(#funnelG)" strokeWidth={3} />
              </AreaChart>
            ) : (
              <LineChart data={data.funnel} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="etapa" stroke="#57534E" fontSize={12} />
                <YAxis stroke="#57534E" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="leads" name="Leads" stroke="#0F766E" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Canais" icon={MessageSquare} type={channelType} setType={setChannelType} options={[{ value: 'pie', label: 'Pizza' }, { value: 'bar', label: 'Barras' }]}>
          <ResponsiveContainer width="100%" height="100%">
            {channelType === 'pie' ? (
              <PieChart>
                <Pie data={data.pieChannels} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={4} label>
                  {data.pieChannels.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend />
              </PieChart>
            ) : (
              <BarChart data={data.channels} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="canal" stroke="#57534E" fontSize={12} />
                <YAxis stroke="#57534E" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <Bar dataKey="leads" name="Leads" fill="#1D4ED8" radius={[3,3,0,0]} />
                <Bar dataKey="convertidos" name="Convertidos" fill="#15803D" radius={[3,3,0,0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="Motivos de perda" icon={AlertCircle} type={lossType} setType={setLossType} options={[{ value: 'bar', label: 'Barras' }, { value: 'pie', label: 'Pizza' }]}>
          <ResponsiveContainer width="100%" height="100%">
            {lossType === 'bar' ? (
              <BarChart data={data.reasons} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis type="number" stroke="#57534E" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="motivo" stroke="#57534E" fontSize={12} width={120} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="valor" name="Casos" fill="#B45309" radius={[0,3,3,0]} />
              </BarChart>
            ) : (
              <PieChart>
                <Pie data={data.reasons} dataKey="valor" nameKey="motivo" outerRadius={100} label>
                  {data.reasons.map((e, i) => <Cell key={i} fill={e.fill || COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolução simulada" icon={Activity} type={trendType} setType={setTrendType} options={[{ value: 'area', label: 'Área' }, { value: 'line', label: 'Linha' }, { value: 'bar', label: 'Barras' }]} note="Dados simulados para demonstração de tendência ao longo das semanas.">
          <ResponsiveContainer width="100%" height="100%">
            {trendType === 'bar' ? (
              <BarChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="semana" stroke="#57534E" fontSize={12} />
                <YAxis stroke="#57534E" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <Bar dataKey="leads" name="Leads" fill="#1D4ED8" radius={[3,3,0,0]} />
                <Bar dataKey="convertidos" name="Convertidos" fill="#15803D" radius={[3,3,0,0]} />
              </BarChart>
            ) : trendType === 'line' ? (
              <LineChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="semana" stroke="#57534E" fontSize={12} />
                <YAxis stroke="#57534E" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="leads" name="Leads" stroke="#1D4ED8" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="convertidos" name="Convertidos" stroke="#15803D" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            ) : (
              <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.35} /><stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#15803D" stopOpacity={0.35} /><stop offset="95%" stopColor="#15803D" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis dataKey="semana" stroke="#57534E" fontSize={12} />
                <YAxis stroke="#57534E" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#1D4ED8" fill="url(#gLeads)" strokeWidth={3} />
                <Area type="monotone" dataKey="convertidos" name="Convertidos" stroke="#15803D" fill="url(#gConv)" strokeWidth={3} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <AnalyticsGoals>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
          {[
            { label: 'Leads', actual: data.total, goal: goals.monthlyLeads, fmt: v => v },
            { label: 'Conversão', actual: data.taxa, goal: goals.conversionRate, fmt: v => `${v}%` },
            { label: 'Receita', actual: data.receita, goal: goals.revenue, fmt: v => `R$ ${v}` },
            { label: 'Resposta', actual: 1, goal: goals.responseMinutes, fmt: v => `${v} min`, invert: true },
          ].map((m) => {
            const pct = m.invert ? (m.actual <= m.goal ? 100 : Math.round((m.goal / Math.max(m.actual,1)) * 100)) : Math.min(100, Math.round((m.actual / Math.max(m.goal,1)) * 100));
            const ok = m.invert ? m.actual <= m.goal : m.actual >= m.goal;
            return (
              <div key={m.label} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--mute)' }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 650, color: ok ? '#15803D' : '#B45309' }}>{m.fmt(m.actual)}</div>
                <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 8 }}>Meta: {m.fmt(m.goal)}</div>
                <div style={{ height: 8, background: 'var(--surf-2)', borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: ok ? '#15803D' : '#B45309' }} /></div>
              </div>
            );
          })}
        </div>
      </AnalyticsGoals>

      <div className="card" style={{ padding: 22 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>Recomendações da IA</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 10 }}>
          {[
            'Responder leads novos em até 1 minuto aumenta a chance de qualificação.',
            'Leads com objeção de preço devem receber opção de parcelamento ou âncora de valor.',
            'Leads em “Proposta” há mais de 24h devem entrar em sequência de follow-up.',
            'Registrar motivo de perda ajuda a treinar o script comercial e melhorar conversão.',
          ].map((t, i) => (
            <div key={i} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 8, fontSize: 14, color: 'var(--mute)', background: '#FAFAF9' }}>{t}</div>
          ))}
        </div>
      </div>

      <style>{`@media (max-width: 1000px){ .app-main [style*="repeat(4, minmax(0,1fr))"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important} .app-main [style*="1.2fr .8fr"], .app-main [style*="1fr 1fr"]{grid-template-columns:1fr !important} } @media (max-width: 560px){ .app-main [style*="repeat(4, minmax(0,1fr))"]{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}