import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, Bot, User, Sparkles, Lightbulb, UserCheck, AlertCircle, Zap, History, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { generateNvidiaReply, generateNvidiaClientMessage, isNvidiaConfigured } from '../services/nvidia';

function timeNow() {
  const d = new Date();
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getSuggestions(lastClientText = '') {
  const t = lastClientText.toLowerCase();
  if (/caro|preço|alto|desconto|valor/.test(t)) return [
    'Entendo sua preocupação com o valor. Posso te mostrar o custo-benefício e opções de parcelamento que cabem no seu orçamento?',
    'Posso oferecer uma condição especial ou um bônus para facilitar sua decisão. Qual opção faz mais sentido para você?',
  ];
  if (/pensar|depois|retorno|ainda não/.test(t)) return [
    'Sem problema! Posso te enviar um resumo com os principais pontos e te chamar no melhor horário. Qual seria?',
    'Claro. Enquanto isso, quer que eu reserve a condição atual por mais um tempo para você avaliar com calma?',
  ];
  if (/fechar|pagar|link|comprar|quero/.test(t)) return [
    'Ótimo! Vou te enviar o link de pagamento agora mesmo. Prefere cartão, Pix ou boleto?',
    'Perfeito, vou finalizar seu atendimento e encaminhar os próximos passos para conclusão da compra.',
  ];
  if (/horário|agenda|disponibilidade|quando/.test(t)) return [
    'Posso verificar a disponibilidade agora. Qual dia e horário funcionam melhor para você?',
    'Temos horários disponíveis esta semana. Prefere atendimento presencial ou online?',
  ];
  return [
    'Entendi! Posso te explicar as opções e enviar uma proposta personalizada para o seu caso.',
    'Posso seguir com a qualificação e já te encaminhar para o melhor próximo passo. Tudo bem?',
  ];
}

export default function Conversations() {
  const { leads, conversations, sendMessage, updateLeadStatus, settings, recordEvent, leadEvents } = useApp();
  const { leadId } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(leadId || leads[0]?.id);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showTimeline, setShowTimeline] = useState(false);
  const endRef = useRef(null);
  const typingTimer = useRef();
  const abortRef = useRef();

  useEffect(() => { if (leadId) setSelected(leadId); }, [leadId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selected, conversations, typing, aiError]);
  useEffect(() => () => { clearTimeout(typingTimer.current); abortRef.current?.abort(); }, []);

  const lead = useMemo(() => leads.find(l => l.id === selected) || leads[0], [leads, selected]);
  const msgs = conversations[lead?.id] || [];
  const lastClient = [...msgs].reverse().find(m => m.from === 'client');
  const suggestions = getSuggestions(lastClient?.text || '');

  function pick(id) { setSelected(id); navigate(`/app/conversas/${id}`); }

  function send(from = 'consultor', textOverride) {
    const text = (textOverride ?? draft).trim();
    if (!text || !lead) return;
    sendMessage(lead.id, { from, text, time: timeNow() });
    if (!textOverride) setDraft('');
  }

  const playbookFallbacks = {
    qualificar: `Olá ${lead?.name?.split(' ')[0] || ''}! Para eu te ajudar melhor, me conta: qual é sua principal necessidade, para quando você precisa e existe um orçamento estimado?`,
    objeção: `Entendo sua preocupação, ${lead?.name?.split(' ')[0] || ''}. Posso te mostrar o custo-benefício e opções que façam mais sentido para o seu cenário. O que pesaria mais na sua decisão: prazo, condição ou resultado?`,
    proposta: `Perfeito, ${lead?.name?.split(' ')[0] || ''}! Posso montar uma proposta com base no que conversamos. Você confirma o interesse em ${lead?.interest || 'nossa solução'} para eu seguir com os próximos passos?`,
    agendar: `Posso agendar o próximo passo com você. Você prefere amanhã às 10h ou às 15h? Se outro horário for melhor, me diga.`,
    recuperar: `Oi ${lead?.name?.split(' ')[0] || ''}, passando para retomar nossa conversa sobre ${lead?.interest || 'sua necessidade'}. Ainda faz sentido eu te ajudar com isso?`,
  };

  async function sendAI(textOverride, playbook) {
    if (!lead || typing) return;
    setAiError('');
    const fallback = (textOverride || (playbook && playbookFallbacks[playbook]) || suggestions[0] || '').trim();
    const useApi = !textOverride && isNvidiaConfigured(settings);

    if (!useApi) {
      const text = fallback;
      if (!text) return;
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        sendMessage(lead.id, { from: 'ia', text, time: timeNow() });
        if (lead.status === 'Novo') updateLeadStatus(lead.id, 'Em atendimento');
        if (playbook) recordEvent(lead.id, { type: 'playbook', text: `Playbook IA: ${playbook}` });
        setTyping(false);
      }, 700);
      return;
    }

    setTyping(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const text = await generateNvidiaReply({
        lead,
        conversations: conversations[lead.id] || [],
        settings,
        signal: controller.signal,
        playbook,
      });
      sendMessage(lead.id, { from: 'ia', text, time: timeNow() });
      if (lead.status === 'Novo') updateLeadStatus(lead.id, 'Em atendimento');
      if (playbook) recordEvent(lead.id, { type: 'playbook', text: `Playbook IA: ${playbook}` });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setAiError(err?.message || 'Falha ao gerar resposta com NVIDIA.');
    } finally {
      if (!controller.signal.aborted) setTyping(false);
    }
  }

  async function simulateNegotiation() {
    if (!lead || typing || simulating) return;
    setAiError('');
    setSimulating(true);
    recordEvent(lead.id, { type: 'simulation', text: 'Simulação de negociação IA iniciada' });
    const useApi = isNvidiaConfigured(settings);
    let conv = [...(conversations[lead.id] || [])];
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    const goals = [
      { status: 'Em atendimento', goal: `Fazer uma pergunta inicial natural sobre "${lead.interest}", demonstrando interesse real e contexto pessoal/profissional.` },
      { status: 'Qualificado', goal: `Levantar uma objeção ou dúvida realista (preço, prazo, resultado, comparação) sobre "${lead.interest}" e pedir esclarecimento.` },
      { status: lead.value >= 1000 ? 'Proposta' : 'Qualificado', goal: `Mostrar que entendeu a resposta, pedir condição comercial/próximo passo (proposta, demonstração, pagamento ou agendamento).` },
      { status: ['Convertido', 'Proposta'].includes(lead.status) ? 'Convertido' : 'Proposta', goal: `Tomar uma decisão: ou concordar em avançar/fechar, ou pedir envio de proposta/link com confirmação clara.` },
    ];

    const fallbackClients = [
      `Oi, vi sobre ${lead.interest} e queria entender melhor como funciona para o meu caso.`,
      `Interessante. No meu caso, o que mais pesa é custo-benefício. Como vocês costumam trabalhar isso?`,
      `Faz sentido. Se a gente avançar, qual seria o próximo passo e o prazo?`,
      `Beleza, gostei da explicação. Pode me enviar uma proposta para eu avaliar?`,
    ];

    try {
      for (let i = 0; i < goals.length; i++) {
        const step = goals[i];
        let clientText = fallbackClients[i] || fallbackClients[fallbackClients.length - 1];

        if (useApi) {
          try {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            clientText = await generateNvidiaClientMessage({ lead, conversations: conv, settings, signal: controller.signal, goal: step.goal });
          } catch (err) {
            if (err?.name === 'AbortError') throw err;
          }
        }

        const clientMsg = { from: 'client', text: clientText, time: timeNow() };
        sendMessage(lead.id, clientMsg);
        conv = [...conv, clientMsg];
        await delay(700);

        setTyping(true);
        let aiText;
        try {
          if (useApi) {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            aiText = await generateNvidiaReply({ lead, conversations: conv, settings, signal: controller.signal });
          } else {
            await delay(700);
            aiText = getSuggestions(clientText)[0];
          }
        } catch (err) {
          if (err?.name === 'AbortError') throw err;
          aiText = getSuggestions(clientText)[0];
          setAiError(err?.message || 'Falha ao gerar resposta com NVIDIA.');
        }

        const aiMsg = { from: 'ia', text: aiText, time: timeNow() };
        sendMessage(lead.id, aiMsg);
        conv = [...conv, aiMsg];
        updateLeadStatus(lead.id, step.status);
        setTyping(false);
        await delay(800);
      }
      recordEvent(lead.id, { type: 'simulation', text: 'Simulação de negociação IA concluída' });
    } catch (err) {
      if (err?.name !== 'AbortError') setAiError(err?.message || 'Falha na simulação.');
    } finally {
      setTyping(false);
      setSimulating(false);
    }
  }

  function handoff() {
    if (!lead) return;
    sendMessage(lead.id, { from: 'ia', text: 'Vou encaminhar você para um consultor humano continuar o atendimento. Um momento, por favor.', time: timeNow() });
    updateLeadStatus(lead.id, 'Em atendimento');
    recordEvent(lead.id, { type: 'handoff', text: 'Handoff para atendimento humano' });
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Conversas</h1>
          <p>Acompanhe o atendimento da IA, use sugestões inteligentes e intervenha quando necessário.</p>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: 'min(72vh, 720px)', minHeight: 560, overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid var(--line)', background: 'var(--surf-2)', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: '1px solid var(--line)', fontWeight: 700, fontSize: 14, color: 'var(--mute)' }}>Caixa de entrada</div>
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {leads.map(l => (
              <button key={l.id} onClick={() => pick(l.id)} style={{ width: '100%', textAlign: 'left', padding: 14, border: 0, borderBottom: '1px solid var(--line)', background: l.id === lead?.id ? 'var(--surf-3)' : 'transparent', cursor: 'pointer' }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          {lead ? (
            <>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{lead.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--mute)' }}>{lead.channel} · {lead.interest} · <span className="badge blue">{lead.status}</span></div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => setShowTimeline(true)}><History size={14} /> Timeline</button>
                  <button className="btn btn-sm btn-outline" onClick={handoff}><UserCheck size={14} /> Handoff humano</button>
                  <button className="btn btn-sm btn-outline" onClick={() => sendAI()} disabled={typing || simulating}><Sparkles size={14} /> {isNvidiaConfigured(settings) ? 'Gerar resposta IA (NVIDIA)' : 'Simular resposta IA'}</button>
                  <button className="btn btn-sm btn-primary" onClick={simulateNegotiation} disabled={typing || simulating}><Zap size={14} /> {simulating ? 'Simulando...' : 'Simular negociação IA'}</button>
                </div>
              </div>

              <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-alt)' }}>
                {msgs.length === 0 && <div style={{ color: 'var(--mute)', fontSize: 14 }}>Nenhuma mensagem ainda. Envie a primeira mensagem.</div>}
                {msgs.map((m, i) => {
                  const isClient = m.from === 'client';
                  const isIA = m.from === 'ia';
                  return (
                    <div key={i} style={{ alignSelf: isClient ? 'flex-start' : 'flex-end', maxWidth: '78%' }}>
                      <div style={{
                        padding: '10px 13px', borderRadius: 16,
                        borderBottomLeftRadius: isClient ? 4 : 16, borderBottomRightRadius: isClient ? 16 : 4,
                        background: isClient ? 'var(--surf-3)' : isIA ? 'var(--wa-bg)' : 'var(--blue-bg)',
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
                {typing && (
                  <div style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>
                    <div style={{ padding: '10px 13px', borderRadius: 16, borderBottomRightRadius: 4, background: 'var(--wa-bg)', color: 'var(--mute)', fontSize: 14 }}>
                      <Bot size={12} style={{ marginRight: 6 }} /> {isNvidiaConfigured(settings) ? 'LeadIA (NVIDIA) está gerando resposta...' : 'LeadIA está digitando...'}
                    </div>
                  </div>
                )}
                {aiError && (
                  <div style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>
                    <div style={{ padding: '10px 13px', borderRadius: 12, background: 'rgba(255,90,82,.12)', color: '#FFB4AF', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} /> <span>{aiError}</span>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <div style={{ padding: 14, borderTop: '1px solid var(--line)', display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}><Sparkles size={13} /> Playbooks IA</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      ['qualificar', 'Qualificar'],
                      ['objeção', 'Contornar objeção'],
                      ['proposta', 'Enviar proposta'],
                      ['agendar', 'Agendar'],
                      ['recuperar', 'Recuperar lead'],
                    ].map(([key, label]) => (
                      <button key={key} className="btn btn-sm btn-outline" style={{ fontSize: 12 }} disabled={typing || simulating} onClick={() => sendAI(undefined, key)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--mute)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}><Lightbulb size={13} /> Sugestões da IA</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {suggestions.map((s, i) => (
                      <button key={i} className="btn btn-sm btn-outline" style={{ whiteSpace: 'normal', textAlign: 'left', height: 'auto', padding: '8px 10px', fontSize: 12 }} onClick={() => sendAI(s)}>
                        {s.length > 72 ? s.slice(0, 72) + '...' : s}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Digite uma mensagem como consultor..." onKeyDown={e => { if (e.key === 'Enter') send('consultor'); }} />
                  <button className="btn btn-primary" onClick={() => send('consultor')}><Send size={16} /> Enviar</button>
                </div>
              </div>
            </>
          ) : <div style={{ padding: 24, color: 'var(--mute)' }}>Selecione um lead.</div>}
        </div>
      </div>
      {showTimeline && lead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,12,.55)', display: 'flex', justifyContent: 'flex-end', zIndex: 60 }} onClick={() => setShowTimeline(false)}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 100%)', height: '100%', borderRadius: '16px 0 0 16px', padding: 24, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>Timeline do lead</h2>
                <div style={{ color: 'var(--mute)', fontSize: 13 }}>{lead.name} · {lead.channel}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTimeline(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {(() => {
                const toMin = (t) => { const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : -1; };
                const ev = (leadEvents[lead.id] || []).map((e, i) => ({ kind: 'event', i, time: e.time || '', text: e.text, type: e.type || 'event' }));
                const msg = (conversations[lead.id] || []).map((m, i) => ({ kind: 'msg', i, time: m.time || '', text: m.text, from: m.from }));
                const all = [...ev, ...msg].sort((a, b) => { const ta = toMin(a.time), tb = toMin(b.time); if (ta === -1 && tb === -1) return 0; if (ta === -1) return -1; if (tb === -1) return 1; return ta - tb || (a.kind === 'event' ? -1 : 1); });
                if (all.length === 0) return <div style={{ color: 'var(--mute)', fontSize: 14 }}>Sem atividades registradas.</div>;
                return all.map((item, idx) => (
                  <div key={idx} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 10, background: item.kind === 'event' ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.02)' }}>
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
        </div>
      )}

      <style>{`@media (max-width: 900px){ .app-main .card[style*="grid-template-columns: 320px"]{grid-template-columns:1fr !important;grid-template-rows:auto minmax(0,1fr) !important;height:min(82vh,760px) !important;min-height:520px !important} .app-main .card[style*="grid-template-columns: 320px"] > div:first-child{max-height:220px;border-right:0 !important;border-bottom:1px solid var(--line)} }`}</style>
    </div>
  );
}