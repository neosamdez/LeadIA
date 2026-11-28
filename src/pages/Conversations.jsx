import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, Bot, User, Sparkles, UserCheck, AlertCircle, Zap, History, Copy, FileText, CalendarPlus, Brain, CheckCircle2, Search, SlidersHorizontal, ArrowLeft, Pause, Play } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dateInputValue } from '../lib/followUpDates';
import { generateNvidiaReply, generateNvidiaClientMessage, isNvidiaConfigured } from '../services/nvidia';
import Modal from '../components/Modal';
import './Conversations.css';

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

function normalizeSearch(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

const whatsappDeliveryLabels = {
  accepted: 'Aceita pela Meta', sent: 'Enviada', delivered: 'Entregue', read: 'Lida',
  failed: 'Falha de envio', uncertain: 'Envio a confirmar',
};


const PLAYBOOK_OPTIONS = [
  ['qualificar', 'Qualificar', 'Necessidade, prazo e orçamento'],
  ['objeção', 'Contornar objeção', 'Responde à dúvida sobre preço ou valor'],
  ['proposta', 'Encaminhar proposta', 'Confirma interesse e próximo passo'],
  ['agendar', 'Agendar', 'Oferece dois horários'],
  ['recuperar', 'Recuperar', 'Retoma uma conversa parada'],
];

const EVENT_LABEL = { status: 'Status', handoff: 'Handoff', simulation: 'Simulação', playbook: 'Playbook', ia: 'IA', event: 'Evento' };

export default function Conversations() {
  const { leads, conversations, sendMessage, updateLeadStatus, settings, recordEvent, leadEvents, addFollowUp, setWhatsAppPause, pendingWrites, members = [], assignLead, user } = useApp();
  const { leadId } = useParams();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(leadId || leads[0]?.id);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState('all');
  const [typing, setTyping] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showTimeline, setShowTimeline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ date: '', min: '' });
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [panel, setPanel] = useState(null); // 'acoes' | 'ia' | 'inbox'
  const [mobileView, setMobileView] = useState(leadId ? 'chat' : 'list');
  const endRef = useRef(null);
  const typingTimer = useRef();
  const abortRef = useRef();

  useEffect(() => { if (leadId) setSelected(leadId); }, [leadId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [selected, conversations, typing, aiError]);
  useEffect(() => () => { clearTimeout(typingTimer.current); abortRef.current?.abort(); }, []);

  const lead = useMemo(() => leads.find(l => l.id === selected) || leads[0], [leads, selected]);
  const query = normalizeSearch(search);
  const visibleLeads = leads.filter(item => {
    if (inboxFilter === 'whatsapp' && item.channel !== 'WhatsApp') return false;
    if (inboxFilter === 'paused' && !(item.whatsappConnected && item.whatsappPaused)) return false;
    const searchable = [item.name, item.company, item.phone, item.interest, item.lastMessage].join(" ");
    return !query || normalizeSearch(searchable).includes(query);
  });
  const assignees = members.filter(member => member.role !== 'viewer');
  const owner = members.find(member => member.id === lead?.ownerId);
  const canAssign = assignees.some(member => member.id === user?.id);
  const msgs = conversations[lead?.id] || [];
  const whatsapp = lead?.whatsappConnected;
  const lastClassification = (leadEvents[lead?.id] || []).findLast(event => event.type === 'whatsapp' && event.meta?.intent);
  const lastClient = [...msgs].reverse().find(m => m.from === 'client');
  const suggestions = getSuggestions(lastClient?.text || '');
  const intent = (() => {
    if (whatsapp) return { label: lastClassification?.text || 'Aguardando classificação', tone: 'blue' };
    const t = (lastClient?.text || '').toLowerCase();
    if (!t) return { label: 'Sem mensagem', tone: 'blue' };
    if (/caro|preço|alto|desconto|valor/.test(t)) return { label: 'Objeção de preço', tone: 'yellow' };
    if (/fechar|comprar|pagamento|pix|boleto|assinar/.test(t)) return { label: 'Intenção de compra', tone: 'green' };
    if (/agendar|visita|reunião|horário|ligar/.test(t)) return { label: 'Agendamento', tone: 'blue' };
    if (/não|nao|depois|pensar/.test(t)) return { label: 'Hesitação', tone: 'red' };
    return { label: 'Interesse geral', tone: 'blue' };
  })();

  function copyLeadSummary() {
    if (!lead) return;
    const text = `Resumo LeadIA\nLead: ${lead.name}\nCanal: ${lead.channel}\nInteresse: ${lead.interest}\nStatus: ${lead.status}\nScore: ${lead.score ?? 60}\nValor: R$ ${lead.value}\nÚltima mensagem: ${lead.lastMessage || '-'}\nPróxima ação: ${lead.nextAction || '-'}`;
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  function buildProposalText() {
    if (!lead) return '';
    return `Olá ${lead.name.split(' ')[0]},\n\nConforme nossa conversa, segue uma proposta inicial para ${lead.interest}.\n\nEmpresa: ${settings.companyName}\nSegmento: ${settings.segment}\nValor estimado: R$ ${lead.value}\nCondição: a definir conforme necessidade\n\nPróximo passo: confirmar escopo e agendar validação final.\n\nAtenciosamente,\nEquipe ${settings.companyName} (via LeadIA)`;
  }

  function pick(id) { setSelected(id); setMobileView('chat'); setPanel(null); navigate(`/app/conversas/${id}`); }

  function openFollowUp() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    setFollowUpForm({ date: dateInputValue(tomorrow), min: dateInputValue(today) });
    setPanel(null);
    setFollowUpOpen(true);
  }

  async function submitFollowUp(event) {
    event.preventDefault();
    const date = new Date(followUpForm.date + 'T23:59:59.999');
    if (!lead || Number.isNaN(date.getTime())) return;
    const result = await addFollowUp({
      leadId: lead.id, title: 'Follow-up: ' + lead.name, note: 'Retomar ' + lead.interest, dueAt: date.toISOString(),
    });
    if (result === null) return;
    setFollowUpOpen(false);
    await recordEvent(lead.id, { type: 'event', text: 'Follow-up agendado pelo consultor' });
  }

  async function send(from = 'consultor', textOverride) {
    const text = (textOverride ?? draft).trim();
    if (!text || !lead) return;
    const result = await sendMessage(lead.id, { from, text, time: timeNow() });
    if (result === null) return;
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

  const ai = isNvidiaConfigured(settings);
  const counts = {
    all: leads.length,
    whatsapp: leads.filter(l => l.channel === 'WhatsApp').length,
    paused: leads.filter(l => l.whatsappConnected && l.whatsappPaused).length,
  };
  const busy = typing || simulating;
  const firstName = lead?.name?.split(' ')[0] || '';
  const actions = lead ? [
    { id: 'timeline', label: 'Timeline', hint: 'Mensagens e eventos em ordem', icon: History, onClick: () => { setPanel(null); setShowTimeline(true); } },
    { id: 'resumo', label: copied ? 'Copiado' : 'Copiar resumo', hint: 'Ficha do lead para colar', icon: copied ? CheckCircle2 : Copy, onClick: copyLeadSummary },
    { id: 'proposta', label: 'Proposta', hint: 'Texto pronto para enviar', icon: FileText, onClick: () => { setPanel(null); setShowProposal(true); } },
    { id: 'followup', label: 'Agendar retorno', hint: 'Cria um follow-up', icon: CalendarPlus, onClick: openFollowUp },
    whatsapp
      ? { id: 'pausa', label: lead.whatsappPaused ? 'Retomar automação' : 'Pausar automação', hint: 'Liga ou desliga o agente nesta conversa', icon: lead.whatsappPaused ? Play : Pause,
        onClick: () => setWhatsAppPause(lead.id, !lead.whatsappPaused), disabled: Boolean(pendingWrites) }
      : { id: 'handoff', label: 'Passar para pessoa', hint: 'Avisa o lead e registra o handoff', icon: UserCheck, onClick: () => { handoff(); setPanel(null); } },
    !whatsapp && { id: 'simular', label: simulating ? 'Simulando…' : 'Simular negociação', hint: '4 trocas entre lead e IA', icon: Zap, onClick: () => { setPanel(null); simulateNegotiation(); }, disabled: busy },
  ].filter(Boolean) : [];

  const inbox = (
    <div className="deck-inbox-body">
      <div className="deck-search">
        <Search size={15} aria-hidden="true" />
        <input type="search" aria-label="Buscar na caixa de entrada" placeholder="Buscar nome, interesse ou mensagem" value={search} onChange={event => setSearch(event.target.value)} />
      </div>
      <div className="deck-filters" role="group" aria-label="Filtrar caixa de entrada">
        {[['all', 'Todas'], ['whatsapp', 'WhatsApp'], ['paused', 'Pausadas']].map(([key, label]) => (
          <button key={key} type="button" aria-pressed={inboxFilter === key} className={inboxFilter === key ? 'on' : ''} onClick={() => setInboxFilter(key)}>
            {label}<span>{counts[key]}</span>
          </button>
        ))}
      </div>
      <ul className="deck-list">
        {visibleLeads.length === 0 && <li className="deck-empty" role="status">
          {leads.length ? 'Nenhuma conversa corresponde à busca e ao filtro.' : 'Os contatos aparecem aqui quando entram no CRM.'}
        </li>}
        {visibleLeads.map(l => (
          <li key={l.id}>
            <button type="button" className={l.id === lead?.id ? 'deck-thread on' : 'deck-thread'} aria-current={l.id === lead?.id ? 'true' : undefined} onClick={() => pick(l.id)}>
              <span className="deck-avatar" aria-hidden="true">{l.name.slice(0, 2).toUpperCase()}</span>
              <span className="deck-thread-main">
                <span className="deck-thread-top"><strong>{l.name}</strong><time>{l.time}</time></span>
                <span className="deck-thread-msg">{l.lastMessage || 'Sem mensagens'}</span>
                <span className="deck-thread-meta">{l.channel} · {l.status}{l.whatsappConnected && l.whatsappPaused ? ' · pausada' : ''}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className={`deck deck-view-${mobileView}`}>
      <header className="deck-bar">
        <div className="deck-title">
          <span className="deck-kicker">Central de conversas</span>
          <h1>Conversas</h1>
        </div>
        <dl className="deck-stats">
          <div><dt>Ativas</dt><dd>{counts.all}</dd></div>
          <div><dt>WhatsApp</dt><dd>{counts.whatsapp}</dd></div>
          <div><dt>Pausadas</dt><dd>{counts.paused}</dd></div>
          <div><dt>Motor IA</dt><dd className={ai ? 'live' : 'idle'}><span className="deck-dot" aria-hidden="true" />{ai ? 'Online' : 'Local'}</dd></div>
        </dl>
      </header>

      <div className="deck-grid">
        <aside className="deck-inbox" aria-label="Caixa de entrada">
          <div className="deck-label">Caixa de entrada</div>
          {inbox}
        </aside>

        <section className="deck-chat" aria-label={lead ? `Conversa com ${lead.name}` : 'Conversa'}>
          {lead ? (
            <>
              <header className="deck-chat-head">
                <button type="button" className="deck-icon-btn deck-back" aria-label="Voltar para a caixa de entrada" onClick={() => setMobileView('list')}><ArrowLeft size={17} /></button>
                <span className="deck-avatar lg" aria-hidden="true">{lead.name.slice(0, 2).toUpperCase()}</span>
                <div className="deck-who">
                  <h2>{lead.name}</h2>
                  <p>{lead.channel} · {lead.interest}{owner ? ` · ${owner.name}` : ''}</p>
                </div>
                <div className="deck-chips">
                  <span className={`deck-chip tone-${intent.tone}`}><Brain size={12} aria-hidden="true" />{intent.label}</span>
                  <span className="deck-chip">{lead.status}</span>
                  {whatsapp && lead.whatsappPaused && <span className="deck-chip tone-yellow">Automação pausada</span>}
                </div>
                <button type="button" className="btn btn-outline btn-sm deck-actions-btn" onClick={() => setPanel('acoes')} aria-haspopup="dialog">
                  <SlidersHorizontal size={14} /> Ações
                </button>
              </header>

              <div className="deck-stream" aria-live="polite">
                {msgs.length === 0 && <p className="deck-empty">Nenhuma mensagem ainda. Envie a primeira.</p>}
                {msgs.map((m, i) => {
                  const kind = m.from === 'client' ? 'client' : m.from === 'ia' ? 'ia' : 'agent';
                  const who = kind === 'client' ? firstName || 'Cliente' : kind === 'ia' ? 'LeadIA' : whatsapp ? 'Nota interna' : 'Consultor';
                  return (
                    <div key={i} className={`deck-msg ${kind}`}>
                      <div className="deck-msg-meta">{kind === 'client' ? <User size={11} /> : <Bot size={11} />}{who}<time>{m.time}</time>
                        {m.whatsappDelivery && <span>· {whatsappDeliveryLabels[m.whatsappDelivery]}</span>}</div>
                      <div className="deck-bubble">{m.text}</div>
                    </div>
                  );
                })}
                {typing && <div className="deck-msg ia"><div className="deck-bubble deck-typing"><span /><span /><span /> {ai ? 'Gerando resposta' : 'Digitando'}</div></div>}
                {aiError && <div className="deck-alert" role="alert"><AlertCircle size={14} /> {aiError}</div>}
                <div ref={endRef} />
              </div>

              <form className="deck-composer" onSubmit={e => { e.preventDefault(); send('consultor'); }}>
                {!whatsapp && (
                  <button type="button" className="deck-ai-btn" onClick={() => setPanel('ia')} disabled={busy} aria-haspopup="dialog">
                    <Sparkles size={15} /> <span>IA</span>
                  </button>
                )}
                <input value={draft} onChange={e => setDraft(e.target.value)} aria-label={whatsapp ? 'Nota interna' : 'Mensagem'}
                  placeholder={whatsapp ? 'Nota interna para a equipe' : `Responder ${firstName || 'o lead'}…`} />
                <button type="submit" className="btn btn-primary btn-sm" disabled={!draft.trim()}><Send size={15} /> <span className="deck-hide-sm">{whatsapp ? 'Salvar nota' : 'Enviar'}</span></button>
              </form>
            </>
          ) : <p className="deck-empty pad">Selecione uma conversa.</p>}
        </section>
      </div>

      <Modal open={panel === 'acoes' && !!lead} onClose={() => setPanel(null)} tone="deck" size="lg" icon={SlidersHorizontal}
        title="Ações da conversa" subtitle={lead ? `${lead.name} · ${lead.channel}` : ''}>
        {lead && <>
          <dl className="deck-sheet">
            <div><dt>Status</dt><dd>{lead.status}</dd></div>
            <div><dt>Interesse</dt><dd>{lead.interest || '—'}</dd></div>
            <div><dt>Valor</dt><dd>R$ {Number(lead.value || 0).toLocaleString('pt-BR')}</dd></div>
            <div><dt>Score</dt><dd>{lead.score ?? 60}</dd></div>
            <div><dt>Próxima ação</dt><dd>{lead.nextAction || '—'}</dd></div>
          </dl>
          {user?.mode === 'real' && members.length > 0 && <label className="deck-field">Responsável
            <select aria-label="Responsável pela conversa" value={lead.ownerId || ''} disabled={!canAssign || Boolean(pendingWrites)}
              onChange={event => assignLead(lead.id, event.target.value || null)}>
              <option value="">Sem responsável</option>
              {lead.ownerId && !assignees.some(member => member.id === lead.ownerId) && <option value={lead.ownerId} disabled>{owner?.name || 'Responsável indisponível'}</option>}
              {assignees.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>}
          <div className="deck-tiles">
            {actions.map(({ id, label, hint, icon: Icon, onClick, disabled }) => (
              <button key={id} type="button" className="deck-tile" onClick={onClick} disabled={disabled}>
                <Icon size={18} aria-hidden="true" /><strong>{label}</strong><small>{hint}</small>
              </button>
            ))}
          </div>
        </>}
      </Modal>

      <Modal open={panel === 'ia' && !!lead} onClose={() => setPanel(null)} tone="deck" size="lg" icon={Sparkles}
        title="Assistente de resposta" subtitle={ai ? 'Gera com o modelo configurado em Configurações.' : 'Sem modelo configurado: usa respostas prontas.'}>
        <div className="deck-label">Playbooks</div>
        <div className="deck-tiles">
          {PLAYBOOK_OPTIONS.map(([key, label, hint]) => (
            <button key={key} type="button" className="deck-tile" disabled={busy} onClick={() => { setPanel(null); sendAI(undefined, key); }}>
              <strong>{label}</strong><small>{hint}</small>
            </button>
          ))}
        </div>
        <div className="deck-label">Sugestões para a última mensagem</div>
        <div className="deck-suggestions">
          {suggestions.slice(0, 3).map((s, i) => (
            <button key={i} type="button" className="deck-suggestion" disabled={busy} onClick={() => { setPanel(null); sendAI(s); }}>{s}</button>
          ))}
        </div>
        <div className="deck-row-end">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => { setDraft(suggestions[0] || ''); setPanel(null); }}>Colocar no campo para editar</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => { setPanel(null); sendAI(); }}><Sparkles size={14} /> Responder com IA</button>
        </div>
      </Modal>

      <Modal open={showTimeline && !!lead} onClose={() => setShowTimeline(false)} tone="deck" side="right" icon={History}
        title="Timeline" subtitle={lead ? `${lead.name} · ${lead.channel}` : ''}>
        {lead && (() => {
          const toMin = (t) => { const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : -1; };
          const ev = (leadEvents[lead.id] || []).map((e, i) => ({ kind: 'event', i, time: e.time || '', text: e.text, type: e.type || 'event' }));
          const msg = (conversations[lead.id] || []).map((m, i) => ({ kind: 'msg', i, time: m.time || '', text: m.text, from: m.from }));
          const all = [...ev, ...msg].sort((a, b) => { const ta = toMin(a.time), tb = toMin(b.time); if (ta === -1 && tb === -1) return 0; if (ta === -1) return -1; if (tb === -1) return 1; return ta - tb || (a.kind === 'event' ? -1 : 1); });
          if (all.length === 0) return <p className="deck-empty">Sem atividades registradas.</p>;
          return <ol className="deck-timeline">{all.map((item, idx) => (
            <li key={idx} className={item.kind}>
              <span className="deck-timeline-meta">{item.kind === 'event'
                ? `${EVENT_LABEL[item.type] || 'Evento'} · ${item.time}`
                : `${item.from === 'client' ? 'Cliente' : item.from === 'ia' ? 'LeadIA' : 'Consultor'} · ${item.time}`}</span>
              <span>{item.text}</span>
            </li>
          ))}</ol>;
        })()}
      </Modal>

      <Modal open={followUpOpen} onClose={() => setFollowUpOpen(false)} tone="deck" size="sm" icon={CalendarPlus} title="Agendar retorno">
        <form onSubmit={submitFollowUp} className="deck-form">
          <label className="deck-field">Data do retorno
            <input type="date" required min={followUpForm.min} value={followUpForm.date} onChange={event => setFollowUpForm({ ...followUpForm, date: event.target.value })} />
          </label>
          <div className="deck-row-end">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setFollowUpOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={Boolean(pendingWrites)}>Salvar retorno</button>
          </div>
        </form>
      </Modal>

      <Modal open={showProposal && !!lead} onClose={() => setShowProposal(false)} tone="deck" size="lg" icon={FileText} title="Proposta"
        footer={lead && <>
          <button className="btn btn-outline btn-sm" onClick={() => { const blob = new Blob([buildProposalText()], { type: 'text/plain;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `proposta-${lead.name.replace(/\s+/g, '-').toLowerCase()}.txt`; a.click(); URL.revokeObjectURL(a.href); recordEvent(lead.id, { type: 'event', text: 'Proposta exportada (.txt)' }); }}>Exportar .txt</button>
          <button className="btn btn-primary btn-sm" onClick={() => { navigator.clipboard?.writeText(buildProposalText()); recordEvent(lead.id, { type: 'event', text: 'Proposta/resumo copiado' }); }}><Copy size={14} /> Copiar texto</button>
        </>}>
        <textarea readOnly aria-label="Texto da proposta" value={buildProposalText()} className="deck-proposal" />
      </Modal>
    </div>
  );
}
