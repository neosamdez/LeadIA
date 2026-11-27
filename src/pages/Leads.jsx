import { useMemo, useState } from 'react';
import { Search, Plus, X, Eye, MessageSquare, Target, Tag, AlertCircle, Trash2, Pencil, Copy, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { channelOptions, statusOptions } from '../data/mockData';

const statusColor = { 'Novo': 'blue', 'Em atendimento': 'yellow', 'Qualificado': 'blue', 'Proposta': 'yellow', 'Convertido': 'green', 'Perdido': 'red' };

function scoreReasons(lead) {
  const reasons = [];
  const score = lead.score ?? 60;
  if (score >= 80) reasons.push('Alta intenção e bom encaixe comercial.');
  if ((lead.tags || []).some(t => /alta|quente|urg|prior/i.test(t))) reasons.push('Tags indicam prioridade comercial.');
  if (['Proposta', 'Qualificado'].includes(lead.status)) reasons.push(`Status "${lead.status}" mostra avanço no funil.`);
  if (/orçamento|parcel|comprar|fechar|agendar|proposta/i.test(lead.lastMessage || '')) reasons.push('Última mensagem indica intenção de avanço.');
  if (/caro|preço|alto|desconto/i.test(lead.lastMessage || '')) reasons.push('Objeção de preço detectada - tratar com valor/condição.');
  if (!reasons.length) reasons.push('Score baseado em perfil inicial e engajamento atual.');
  return reasons;
}

function LeadDetail({ lead, messages, events, onClose, onOpenChat, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState(null);
  if (!lead) return null;
  const score = lead.score ?? 60;
  const scoreColor = score >= 80 ? '#15803D' : score >= 60 ? '#B45309' : '#B91C1C';
  const reasons = scoreReasons(lead);

  function startEdit() {
    setForm({ name: lead.name, channel: lead.channel, interest: lead.interest, value: lead.value, status: lead.status, score: lead.score ?? 60, nextAction: lead.nextAction || '', lossReason: lead.lossReason || '', tags: (lead.tags || []).join(', ') });
    setEditing(true);
  }
  async function saveEdit(e) {
    e.preventDefault();
    const result = await onUpdate(lead.id, {
      ...form,
      value: Number(form.value) || 0,
      score: Math.max(0, Math.min(100, Number(form.score) || 0)),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      avatar: form.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(),
    });
    if (result === null) return;
    setEditing(false);
  }
  function copySummary() {
    const text = `Lead: ${lead.name}\nCanal: ${lead.channel}\nInteresse: ${lead.interest}\nStatus: ${lead.status}\nScore: ${lead.score ?? 60}\nValor estimado: R$ ${lead.value}\nPróxima ação: ${lead.nextAction || '-'}\nTags: ${(lead.tags || []).join(', ') || '-'}\nÚltima mensagem: ${lead.lastMessage || '-'}`;
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,.35)', display: 'flex', justifyContent: 'flex-end', zIndex: 60 }} onClick={onClose}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', height: '100%', borderRadius: '16px 0 0 16px', padding: 24, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--bg-alt)', display: 'grid', placeItems: 'center', fontWeight: 650 }}>{lead.avatar}</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 24 }}>{lead.name}</h2>
              <div style={{ color: 'var(--mute)', fontSize: 13 }}>{lead.channel} · {lead.interest}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={copySummary} title="Copiar resumo">{copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}</button>
            <button className="btn btn-ghost btn-sm" onClick={startEdit} title="Editar"><Pencil size={16} /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm('Excluir este lead?')) { onDelete(lead.id); onClose(); } }} title="Excluir"><Trash2 size={16} /></button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {editing ? (
          <form onSubmit={saveEdit} style={{ display: 'grid', gap: 10, marginBottom: 20, padding: 14, border: '1px solid var(--line)', borderRadius: 8 }}>
            <div style={{ fontWeight: 700 }}>Editar lead</div>
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Nome<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Canal<select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>{channelOptions.map(c => <option key={c}>{c}</option>)}</select></label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{statusOptions.map(s => <option key={s}>{s}</option>)}</select></label>
            </div>
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Interesse<input value={form.interest} onChange={e => setForm({ ...form, interest: e.target.value })} /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Valor (R$)<input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Score<input type="number" min="0" max="100" value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} /></label>
            </div>
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Próxima ação<input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })} /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Tags (vírgula)<input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} /></label>
            <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>Motivo de perda<input value={form.lossReason} onChange={e => setForm({ ...form, lossReason: e.target.value })} /></label>
            <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-primary btn-sm" type="submit">Salvar</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancelar</button></div>
          </form>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-alt)' }}>
                <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 4 }}>Score de conversão</div>
                <div style={{ fontSize: 28, fontWeight: 650, color: scoreColor }}>{score}</div>
              </div>
              <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-alt)' }}>
                <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 4 }}>Valor estimado</div>
                <div style={{ fontSize: 28, fontWeight: 650 }}>R$ {lead.value}</div>
              </div>
            </div>

            <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 6 }}>Por que esse score?</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--mute)', fontSize: 13, display: 'grid', gap: 4 }}>
                {reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>

            <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
              <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--mute)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}><Target size={14} /> Próxima ação sugerida</div>
                <div style={{ fontWeight: 600 }}>{lead.nextAction || 'Acompanhar lead'}</div>
              </div>
              <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--mute)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}><Tag size={14} /> Tags</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(lead.tags || []).length ? (lead.tags || []).map(t => <span key={t} className="badge blue">{t}</span>) : <span style={{ color: 'var(--mute)', fontSize: 13 }}>Sem tags</span>}</div>
              </div>
              {lead.status === 'Perdido' && (
                <div style={{ padding: 14, border: '1px solid #99F6E4', borderRadius: 8, background: '#F0FDFA' }}>
                  <div style={{ fontSize: 12, color: '#B91C1C', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}><AlertCircle size={14} /> Motivo de perda</div>
                  <div style={{ fontWeight: 600 }}>{lead.lossReason || 'Não informado'}</div>
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ marginBottom: 18 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Timeline do lead</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {(() => {
              const toMin = (t) => { const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : -1; };
              const ev = (events || []).map((e, i) => ({ kind: 'event', i, time: e.time || '', text: e.text, type: e.type || 'event' }));
              const msg = (messages || []).map((m, i) => ({ kind: 'msg', i, time: m.time || '', text: m.text, from: m.from }));
              const all = [...ev, ...msg].sort((a, b) => { const ta = toMin(a.time), tb = toMin(b.time); if (ta === -1 && tb === -1) return 0; if (ta === -1) return -1; if (tb === -1) return 1; return ta - tb || (a.kind === 'event' ? -1 : 1); });
              if (all.length === 0) return <div style={{ color: 'var(--mute)', fontSize: 14 }}>Sem atividades registradas.</div>;
              return all.map((item, idx) => (
                <div key={idx} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 8, background: item.kind === 'event' ? '#FAFAF9' : '#FAFAF9' }}>
                  <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 4 }}>
                    {item.kind === 'event'
                      ? `${item.type === 'status' ? 'Status' : item.type === 'handoff' ? 'Handoff' : item.type === 'simulation' ? 'Simulação' : item.type === 'playbook' ? 'Playbook' : item.type === 'ia' ? 'IA' : 'Evento'} · ${item.time}`
                      : `${item.from === 'client' ? 'Cliente' : item.from === 'ia' ? 'LeadIA' : 'Consultor'} · ${item.time}`}
                  </div>
                  <div style={{ fontSize: 14 }}>{item.text}</div>
                </div>
              ));
            })()}
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => onOpenChat(lead.id)}><MessageSquare size={16} /> Abrir conversa</button>
      </div>
    </div>
  );
}

export default function Leads() {
  const { leads, addLead, updateLead, updateLeadStatus, deleteLead, conversations, leadEvents } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Todos');
  const [channel, setChannel] = useState('Todos');
  const [minScore, setMinScore] = useState(0);
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState({ name: '', channel: 'Instagram', interest: '', value: '' });

  const filtered = useMemo(() => leads.filter(l => {
    const matchQ = (l.name + l.interest + l.channel + (l.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase());
    const matchS = status === 'Todos' || l.status === status;
    const matchC = channel === 'Todos' || l.channel === channel;
    const matchScore = (l.score ?? 0) >= Number(minScore);
    return matchQ && matchS && matchC && matchScore;
  }), [leads, q, status, channel, minScore]);

  const detailLead = leads.find(l => l.id === detailId);

  async function create(e) {
    e.preventDefault();
    const id = 'l' + Date.now();
    const result = await addLead({
      id, name: form.name, channel: form.channel, interest: form.interest,
      status: 'Novo', value: Number(form.value) || 0,
      lastMessage: 'Lead criado manualmente.', time: 'Agora', avatar: form.name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase(),
      score: 60, tags: ['Novo'], nextAction: 'Fazer primeiro contato', lossReason: ''
    });
    if (result === null) return;
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

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute)' }} />
          <input placeholder="Buscar por nome, interesse, canal ou tag..." value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: 180, flex: '0 0 auto' }}>
          <option value="Todos">Todos status</option>
          {statusOptions.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={channel} onChange={e => setChannel(e.target.value)} style={{ width: 160, flex: '0 0 auto' }}>
          <option value="Todos">Todos canais</option>
          {channelOptions.map(c => <option key={c}>{c}</option>)}
        </select>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--mute)' }}>
          Score ≥ {minScore}
          <input type="range" min="0" max="100" value={minScore} onChange={e => setMinScore(e.target.value)} style={{ width: 120 }} />
        </label>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr style={{ background: 'var(--surf-2)', textAlign: 'left', fontSize: 13, color: 'var(--mute)' }}>
              {['Lead', 'Canal', 'Interesse', 'Valor', 'Score', 'Status', 'Ações'].map(h => (
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
                <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 700, color: (l.score ?? 60) >= 80 ? '#15803D' : (l.score ?? 60) >= 60 ? '#B45309' : '#B91C1C' }}>{l.score ?? 60}</td>
                <td style={{ padding: '14px 16px' }}>
                  <select value={l.status} onChange={e => updateLeadStatus(l.id, e.target.value)} style={{ padding: '6px 8px', fontSize: 13, borderRadius: 8, width: 150 }}>
                    {statusOptions.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-outline" onClick={() => setDetailId(l.id)}><Eye size={14} /> Detalhes</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/app/conversas/${l.id}`)}>Chat</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--mute)' }}>Nenhum lead encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {detailLead && <LeadDetail lead={detailLead} messages={conversations[detailLead.id] || []} events={leadEvents[detailLead.id] || []} onClose={() => setDetailId(null)} onOpenChat={(id) => { setDetailId(null); navigate(`/app/conversas/${id}`); }} onUpdate={updateLead} onDelete={deleteLead} />}

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,.35)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 50 }} onClick={() => setOpen(false)}>
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