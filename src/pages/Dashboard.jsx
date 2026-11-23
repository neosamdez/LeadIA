import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, MessageSquare, TrendingUp, DollarSign, ArrowRight, Clock, Compass, Sparkles, Target, FileText, X, Zap, Building2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { personas } from '../data/personas';

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

function ExecutiveSummary({ onClose }) {
  const items = [
    { k: 'Problema', v: 'PMEs perdem vendas por demora no atendimento, falta de follow-up e desorganização de leads.' },
    { k: 'Solução', v: 'LeadIA automatiza captação, atendimento, qualificação e follow-up com IA, centralizando tudo em um painel.' },
    { k: 'Público', v: 'Pequenas e médias empresas que vendem por Instagram/WhatsApp (viagens, clínicas, salões, imóveis, etc.).' },
    { k: 'Diferencial', v: 'IA com objetivo comercial: não só responde, mas conduz a conversa, faz follow-up e gera inteligência de conversão.' },
    { k: 'Modelo de negócio', v: 'Assinatura mensal (Start R$97, Pro R$197, Business R$397, Enterprise sob consulta).' },
    { k: 'Roadmap', v: 'V1 demo forte → V2 MVP técnico (backend/auth/banco) → V3 piloto com integrações oficiais e IA real.' },
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(19,34,44,.45)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 120 }} onClick={onClose}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(760px, 100%)', padding: 28, maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div className="badge blue" style={{ marginBottom: 8 }}>Resumo executivo</div>
            <h2 style={{ margin: 0, fontSize: 28, letterSpacing: '-.02em' }}>LeadIA em 1 minuto</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((it) => (
            <div key={it.k} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surf-2)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--acc)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{it.k}</div>
              <div style={{ fontSize: 14, color: 'var(--ink)' }}>{it.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { leads, simulateScenario, startTour, applyPersona, activePersonaId } = useApp();
  const [summary, setSummary] = useState(false);
  const [scenarioMsg, setScenarioMsg] = useState('');

  const stats = useMemo(() => {
    const total = leads.length;
    const convertidos = leads.filter(l => l.status === 'Convertido').length;
    const emAberto = leads.filter(l => !['Convertido', 'Perdido'].includes(l.status)).length;
    const receita = leads.filter(l => l.status === 'Convertido').reduce((a, b) => a + b.value, 0);
    const taxa = total ? Math.round((convertidos / total) * 100) : 0;
    return { total, convertidos, emAberto, receita, taxa };
  }, [leads]);

  const funnel = useMemo(() => {
    const stages = ['Novo', 'Qualificado', 'Proposta', 'Convertido'];
    const counts = stages.map(s => leads.filter(l => l.status === s).length);
    const max = Math.max(1, ...counts);
    return stages.map((s, i) => ({ stage: s, count: counts[i], pct: Math.round((counts[i] / max) * 100) }));
  }, [leads]);

  const recent = leads.slice(0, 5);

  function runScenario(type, label) {
    simulateScenario(type);
    setScenarioMsg(`Cenário executado: ${label}`);
    setTimeout(() => setScenarioMsg(''), 2500);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral do seu atendimento comercial com IA.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => setSummary(true)}><FileText size={15} /> Resumo executivo</button>
          <button className="btn btn-outline btn-sm" onClick={startTour}><Compass size={15} /> Iniciar tour</button>
          <Link to="/app/conversas" className="btn btn-primary btn-sm">Ver conversas <ArrowRight size={16} /></Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 16, marginBottom: 24 }}>
        <Stat icon={Users} label="Leads recebidos" value={stats.total} note={`${stats.emAberto} em aberto`} color={{ bg: 'rgba(96,165,250,.14)', fg: '#93C5FD' }} />
        <Stat icon={MessageSquare} label="Atendimentos" value={stats.total} note="Resposta imediata da IA" color={{ bg: 'rgba(52,211,153,.14)', fg: '#6EE7B7' }} />
        <Stat icon={TrendingUp} label="Taxa de conversão" value={`${stats.taxa}%`} note={`${stats.convertidos} convertidos`} color={{ bg: 'rgba(251,191,36,.14)', fg: '#FCD34D' }} />
        <Stat icon={DollarSign} label="Receita gerada" value={`R$ ${stats.receita}`} note="No período simulado" color={{ bg: 'rgba(255,90,82,.14)', fg: '#FF8A84' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 22, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Target size={18} color="var(--acc)" />
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Funil comercial</h2>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {funnel.map((f) => (
              <div key={f.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{f.stage}</span>
                  <span style={{ color: 'var(--mute)' }}>{f.count} lead(s)</span>
                </div>
                <div style={{ height: 12, background: 'var(--bg-alt)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(f.count ? 8 : 0, f.pct)}%`, height: '100%', background: f.stage === 'Convertido' ? 'var(--wa)' : 'var(--acc)', borderRadius: 999, transition: 'width .3s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <div className="card" style={{ padding: 22, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Building2 size={18} color="var(--acc)" />
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Demo por persona</h2>
            </div>
            <p style={{ margin: '0 0 12px', color: 'var(--mute)', fontSize: 14 }}>Carregue um cenário completo para apresentar o produto em diferentes segmentos.</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {personas.map((p) => (
                <button
                  key={p.id}
                  className={`btn btn-sm ${activePersonaId === p.id ? 'btn-primary' : 'btn-outline'}`}
                  style={{ justifyContent: 'flex-start', textAlign: 'left', height: 'auto', padding: '10px 12px', width: '100%', minWidth: 0, whiteSpace: 'normal' }}
                  onClick={() => applyPersona(p.id)}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{p.label}</div>
                    <div style={{ fontSize: 12, opacity: .85, fontWeight: 400, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{p.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Zap size={18} color="var(--acc)" />
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Cenários prontos</h2>
            </div>
            <p style={{ margin: '0 0 14px', color: 'var(--mute)', fontSize: 14 }}>Use durante a apresentação para demonstrar o fluxo ao vivo.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <button className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => runScenario('novo_lead', 'Novo lead do Instagram')}><Sparkles size={14} /> Simular novo lead do Instagram</button>
              <button className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => runScenario('objecao', 'Objeção de preço')}><Sparkles size={14} /> Simular objeção de preço</button>
              <button className="btn btn-outline btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => runScenario('conversao', 'Conversão')}><Sparkles size={14} /> Simular conversão</button>
            </div>
            {scenarioMsg && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--wa)', fontWeight: 600 }}>{scenarioMsg}</div>}
          </div>
        </div>
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
              { text: 'Respondeu leads novos em menos de 1 minuto', time: 'Agora', color: 'var(--wa)' },
              { text: 'Qualificou interessados com perguntas comerciais', time: 'Hoje', color: 'var(--blue)' },
              { text: 'Enviou propostas e registrou no CRM', time: 'Hoje', color: 'var(--warn)' },
              { text: 'Identificou oportunidades de conversão', time: 'Hoje', color: 'var(--wa)' },
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
            <strong style={{ color: 'var(--ink)' }}>Dica:</strong> use o tour guiado e os cenários prontos para apresentar o app ao vivo.
          </div>
        </div>
      </div>

      {summary && <ExecutiveSummary onClose={() => setSummary(false)} />}

      <style>{`@media (max-width: 1000px){ .app-main [style*="grid-template-columns: repeat(4"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important} .app-main [style*="1.5fr 1fr"], .app-main [style*="1.2fr .8fr"]{grid-template-columns:1fr !important} } @media (max-width: 560px){ .app-main [style*="grid-template-columns: repeat(4"]{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}