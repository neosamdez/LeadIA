import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

function timeNow() {
  const d = new Date();
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const aiReplies = [
  'Entendi! Posso te explicar as opções e enviar uma proposta personalizada. Qual é a melhor forma de contato?',
  'Perfeito. Vou registrar seu interesse e encaminhar para o próximo passo. Você prefere continuar por aqui ou receber um link?',
  'Ótima pergunta! Com base no que você informou, a melhor opção é o plano recomendado para o seu perfil. Quer que eu detalhe os valores?',
  'Posso cuidar disso agora mesmo. Só preciso confirmar mais um detalhe para te enviar a proposta correta.',
];

export default function Conversations() {
  const { leads, conversations, sendMessage, updateLeadStatus } = useApp();
  const { leadId } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(leadId || leads[0]?.id);
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);

  useEffect(() => { if (leadId) setSelected(leadId); }, [leadId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selected, conversations]);

  const lead = useMemo(() => leads.find(l => l.id === selected) || leads[0], [leads, selected]);
  const msgs = conversations[lead?.id] || [];

  function pick(id) { setSelected(id); navigate(`/app/conversas/${id}`); }

  function send(from = 'consultor') {
    const text = draft.trim();
    if (!text || !lead) return;
    sendMessage(lead.id, { from, text, time: timeNow() });
    setDraft('');
  }

  function sendAI() {
    if (!lead) return;
    const text = aiReplies[Math.floor(Math.random() * aiReplies.length)];
    sendMessage(lead.id, { from: 'ia', text, time: timeNow() });
    if (lead.status === 'Novo') updateLeadStatus(lead.id, 'Em atendimento');
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Conversas</h1>
          <p>Acompanhe o atendimento da IA e intervenha quando necessário.</p>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 560, overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid var(--line)', background: 'var(--surf-2)' }}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--line)', fontWeight: 700, fontSize: 14, color: 'var(--mute)' }}>Caixa de entrada</div>
          <div style={{ overflowY: 'auto', maxHeight: 560 }}>
            {leads.map(l => (
              <button key={l.id} onClick={() => pick(l.id)} style={{ width: '100%', textAlign: 'left', padding: 14, border: 0, borderBottom: '1px solid var(--line)', background: l.id === lead?.id ? '#fff' : 'transparent', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontSize: 14, color: 'var(--ink)' }}>{l.name}</strong>
                  <span style={{ fontSize: 12, color: 'var(--mute)' }}>{l.time}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 2 }}>{l.channel} · {l.status}</div>
                <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.lastMessage}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {lead ? (
            <>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{lead.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--mute)' }}>{lead.channel} · {lead.interest} · <span className="badge blue">{lead.status}</span></div>
                </div>
                <button className="btn btn-sm btn-outline" onClick={sendAI}><Sparkles size={14} /> Simular resposta IA</button>
              </div>

              <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, background: '#FBFDFC' }}>
                {msgs.length === 0 && <div style={{ color: 'var(--mute)', fontSize: 14 }}>Nenhuma mensagem ainda. Envie a primeira mensagem.</div>}
                {msgs.map((m, i) => {
                  const isClient = m.from === 'client';
                  const isIA = m.from === 'ia';
                  return (
                    <div key={i} style={{ alignSelf: isClient ? 'flex-start' : 'flex-end', maxWidth: '78%' }}>
                      <div style={{
                        padding: '10px 13px', borderRadius: 16,
                        borderBottomLeftRadius: isClient ? 4 : 16, borderBottomRightRadius: isClient ? 16 : 4,
                        background: isClient ? '#F4F7F5' : isIA ? 'var(--wa-bg)' : '#E8F0FE',
                        color: 'var(--ink)', fontSize: 14, lineHeight: 1.45
                      }}>
                        {m.text}
                        <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
                          {isClient ? <User size={11} /> : <Bot size={11} />} {isClient ? 'Cliente' : isIA ? 'LeadIA' : 'Consultor'} · {m.time}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
                <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Digite uma mensagem como consultor..." onKeyDown={e => { if (e.key === 'Enter') send('consultor'); }} />
                <button className="btn btn-primary" onClick={() => send('consultor')}><Send size={16} /> Enviar</button>
              </div>
            </>
          ) : <div style={{ padding: 24, color: 'var(--mute)' }}>Selecione um lead.</div>}
        </div>
      </div>
      <style>{`@media (max-width: 900px){ .app-main .card[style*="grid-template-columns: 320px"]{grid-template-columns:1fr !important} .app-main .card[style*="grid-template-columns: 320px"] > div:first-child{max-height:260px;border-right:0 !important;border-bottom:1px solid var(--line)} }`}</style>
    </div>
  );
}