import { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from './contextCore';
import RealAppProvider from './RealAppProvider';
import { seedConversations, seedLeads } from '../data/mockData';
import { personas, defaultPersonaId } from '../data/personas';
import { isRealMode } from '../lib/config';
import { followUpDueDate } from '../lib/followUpDates';
import { EMPTY_CONTEXT } from '../lib/orgContext';
import { EMPTY_AGENT } from '../lib/agentSim';

const STORAGE_KEY = 'leadia_demo_v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function buildSeedEvents(leads, conversations) {
  const events = {};
  for (const l of leads) {
    const base = [
      { type: 'lead', text: `Lead recebido via ${l.channel}`, time: l.time || nowTime() },
    ];
    if (l.status && l.status !== 'Novo') base.push({ type: 'status', text: `Status: ${l.status}`, time: l.time || nowTime() });
    const conv = conversations[l.id] || [];
    if (conv.some(m => m.from === 'ia')) base.push({ type: 'ia', text: 'IA respondeu ao lead', time: conv.find(m => m.from === 'ia')?.time || l.time || nowTime() });
    events[l.id] = base;
  }
  return events;
}

function mergeState(loaded) {
  if (!loaded) return defaultState;
  return {
    ...defaultState,
    ...loaded,
    settings: { ...defaultState.settings, ...(loaded.settings || {}) },
    tour: { ...defaultState.tour, ...(loaded.tour || {}) },
    goals: { ...defaultState.goals, ...(loaded.goals || {}) },
    leadEvents: loaded.leadEvents || buildSeedEvents(loaded.leads || defaultState.leads, loaded.conversations || defaultState.conversations),
    activePersonaId: loaded.activePersonaId || defaultState.activePersonaId,
    dismissedAlerts: Array.isArray(loaded.dismissedAlerts) ? loaded.dismissedAlerts : [],
    followUps: Array.isArray(loaded.followUps) ? loaded.followUps : [],
  };
}

const defaultState = {
  user: null,
  orgId: null,
  leads: seedLeads,
  conversations: seedConversations,
  leadEvents: buildSeedEvents(seedLeads, seedConversations),
  activePersonaId: defaultPersonaId,
  dismissedAlerts: [],
  followUps: [],
  goals: {
    monthlyLeads: 30,
    conversionRate: 25,
    revenue: 15000,
    responseMinutes: 5,
  },
  settings: {
    companyName: 'Minha Empresa',
    segment: 'Agências de viagens',
    tone: 'Profissional e amigável',
    autoReply: true,
    followUp: true,
    nvidiaApiKey: '',
    nvidiaModel: import.meta.env.VITE_NVIDIA_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b',
    nvidiaProxyUrl: import.meta.env.VITE_NVIDIA_PROXY_URL || '',
    useNvidiaApi: true,
  },
  tour: { active: false, step: 0 },
  adIntegrations: [],
  agent: { id: 'demo-agent', kind: 'atendimento', name: 'Atendimento', draft: EMPTY_AGENT, publishedRevisionId: null, revisions: [] },
};

// Revisões do modo demonstração: mesma regra do banco, numeração crescente e histórico preservado.
function publishDemo(s, config, restoredFrom) {
  const number = (s.agent.revisions[0]?.number || 0) + 1;
  const ctx = s.settings.context || {};
  const revision = { id: `demo-rev-${number}`, number, config, restoredFrom, createdBy: s.user?.id || '', createdAt: new Date().toISOString(),
    context: { company_name: s.settings.companyName, value_proposition: ctx.valueProposition || '', offers: ctx.offers || '', timezone: ctx.timezone || 'America/Sao_Paulo' } };
  return { ...s, agent: { ...s.agent, draft: config, publishedRevisionId: revision.id, revisions: [revision, ...s.agent.revisions] } };
}

function DemoAppProvider({ children }) {
  const [state, setState] = useState(() => mergeState(loadState()));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const api = useMemo(() => ({
    ...state,
    login: (user) => setState((s) => ({ ...s, user })),
    logout: () => {
      setState((s) => ({ ...s, user: null }));
    },
    recordEvent: (leadId, event) => setState((s) => ({
      ...s,
      leadEvents: { ...s.leadEvents, [leadId]: [...(s.leadEvents[leadId] || []), { time: nowTime(), ...event }] },
    })),
    updateLead: (id, patch) => {
      setState((s) => {
        const prev = s.leads.find((l) => l.id === id)?.status;
        return {
          ...s,
          leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
          leadEvents: patch.status && patch.status !== prev
            ? { ...s.leadEvents, [id]: [...(s.leadEvents[id] || []), { type: 'status', text: `Status alterado: ${prev || '—'} → ${patch.status}`, time: nowTime() }] }
            : s.leadEvents,
        };
      });
    },
    deleteLead: (id) => {
      setState((s) => {
        const { [id]: _conv, ...restConv } = s.conversations;
        const { [id]: _ev, ...restEv } = s.leadEvents;
        return { ...s, leads: s.leads.filter((l) => l.id !== id), conversations: restConv, leadEvents: restEv, followUps: s.followUps.filter(f => f.leadId !== id) };
      });
    },
    dismissAlert: (alertId) => setState((s) => ({ ...s, dismissedAlerts: s.dismissedAlerts.includes(alertId) ? s.dismissedAlerts : [...s.dismissedAlerts, alertId] })),
    clearDismissedAlerts: () => setState((s) => ({ ...s, dismissedAlerts: [] })),
    addFollowUp: (fu) => {
      const localId = 'fu' + Date.now();
      const createdAt = new Date().toISOString();
      const localFu = { id: localId, done: false, createdAt, ...fu,
        dueAt: followUpDueDate(fu, fu.createdAt || createdAt)?.toISOString() ?? null };
      setState((s) => ({ ...s, followUps: [localFu, ...s.followUps] }));
    },
    completeFollowUp: (id) => {
      setState((s) => ({ ...s, followUps: s.followUps.map(f => f.id === id ? { ...f, done: true, status: 'done' } : f) }));
    },
    updateGoals: (patch) => {
      setState((s) => ({ ...s, goals: { ...s.goals, ...patch } }));
    },
    updateLeadStatus: (id, status) => {
      setState((s) => {
        const prev = s.leads.find(l => l.id === id)?.status;
        if (prev === status) return s;
        const time = nowTime();
        return {
          ...s,
          leads: s.leads.map((l) => (l.id === id ? { ...l, status } : l)),
          leadEvents: { ...s.leadEvents, [id]: [...(s.leadEvents[id] || []), { type: 'status', text: `Status alterado: ${prev || '—'} → ${status}`, time }] },
        };
      });
    },
    addLead: (lead) => {
      const time = lead.time || nowTime();
      const localLead = { ...lead, time };
      setState((s) => ({
        ...s,
        leads: [localLead, ...s.leads],
        conversations: { ...s.conversations, [localLead.id]: [] },
        leadEvents: { ...s.leadEvents, [localLead.id]: [{ type: 'lead', text: `Lead criado via ${localLead.channel || 'painel'}`, time }] },
      }));
    },
    sendMessage: (leadId, message) => {
      setState((s) => {
        const conv = s.conversations[leadId] || [];
        const nextConv = [...conv, message];
        const leads = s.leads.map((l) => l.id === leadId ? { ...l, lastMessage: message.text, time: message.time } : l);
        return { ...s, conversations: { ...s.conversations, [leadId]: nextConv }, leads };
      });
    },
    updateSettings: (patch) => {
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    },
    updateContext: (patch) => {
      setState((s) => ({ ...s, settings: { ...s.settings, context: { ...EMPTY_CONTEXT, ...s.settings.context, ...patch, updatedAt: new Date().toISOString(), updatedBy: s.user?.id || '' } } }));
      return true;
    },
    addAdIntegration: (item) => {
      if (state.adIntegrations.some((i) => i.provider === item.provider && i.externalId === item.externalId)) return null;
      const now = new Date().toISOString();
      const row = { id: `demo-ads-${Date.now()}`, ...item, status: 'aguardando_credenciais', settings: {}, lastError: '', createdAt: now, updatedAt: now };
      setState((s) => ({ ...s, adIntegrations: [...s.adIntegrations, row] }));
      return true;
    },
    updateAdIntegration: (id, patch) => {
      setState((s) => ({ ...s, adIntegrations: s.adIntegrations.map((i) => i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i) }));
      return true;
    },
    removeAdIntegration: (id) => {
      setState((s) => ({ ...s, adIntegrations: s.adIntegrations.filter((i) => i.id !== id) }));
      return true;
    },
    saveAgentDraft: (draft) => {
      setState((s) => ({ ...s, agent: { ...s.agent, draft, updatedAt: new Date().toISOString() } }));
      return true;
    },
    publishAgent: (draft) => {
      setState((s) => publishDemo(s, draft, null));
      return true;
    },
    restoreAgentRevision: (revisionId) => {
      setState((s) => {
        const old = s.agent.revisions.find((r) => r.id === revisionId);
        return old ? publishDemo(s, old.config, old.id) : s;
      });
      return true;
    },
    applyPersona: (personaId) => setState((s) => {
      if (s.user?.mode === 'real') return s;
      const p = personas.find(x => x.id === personaId);
      if (!p) return s;
      const keep = { nvidiaApiKey: s.settings.nvidiaApiKey, nvidiaModel: s.settings.nvidiaModel, nvidiaProxyUrl: s.settings.nvidiaProxyUrl, useNvidiaApi: s.settings.useNvidiaApi };
      return {
        ...s,
        leads: p.leads,
        conversations: p.conversations,
        leadEvents: buildSeedEvents(p.leads, p.conversations),
        activePersonaId: p.id,
        dismissedAlerts: [],
        followUps: [],
        settings: { ...s.settings, ...p.settings, ...keep },
      };
    }),
    resetDemo: () => setState((s) => {
      if (s.user?.mode === 'real') return s;
      return {
        ...defaultState,
        user: s.user,
        settings: { ...defaultState.settings, nvidiaApiKey: s.settings.nvidiaApiKey, nvidiaModel: s.settings.nvidiaModel, nvidiaProxyUrl: s.settings.nvidiaProxyUrl, useNvidiaApi: s.settings.useNvidiaApi },
      };
    }),
    startTour: () => setState((s) => ({ ...s, tour: { active: true, step: 0 } })),
    nextTour: () => setState((s) => ({ ...s, tour: { ...s.tour, step: s.tour.step + 1 } })),
    endTour: () => setState((s) => ({ ...s, tour: { active: false, step: 0 } })),
    simulateScenario: (type) => setState((s) => {
      const now = new Date();
      const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const id = 'sim' + Date.now();
      if (type === 'novo_lead') {
        const lead = { id, name: 'Fernanda Alves', channel: 'Instagram', interest: 'Novo interesse', status: 'Novo', value: 2500, lastMessage: 'Oi! Quero saber mais sobre a oferta.', time, avatar: 'FA', score: 75, tags: ['Novo', 'Simulação'], nextAction: 'Qualificar interesse', lossReason: '' };
        const conv = [
          { from: 'client', text: 'Oi! Quero saber mais sobre a oferta.', time },
          { from: 'ia', text: `Olá, Fernanda! Sou a LeadIA da ${s.settings.companyName}. Posso te explicar as opções e entender o que faz mais sentido para você.`, time },
        ];
        return {
          ...s,
          leads: [lead, ...s.leads],
          conversations: { ...s.conversations, [id]: conv },
          leadEvents: { ...s.leadEvents, [id]: [{ type: 'lead', text: 'Lead simulado recebido via Instagram', time }, { type: 'ia', text: 'IA respondeu automaticamente', time }] },
        };
      }
      if (type === 'objecao') {
        const target = s.leads.find(l => l.status !== 'Convertido' && l.status !== 'Perdido') || s.leads[0];
        if (!target) return s;
        const conv = [...(s.conversations[target.id] || []),
          { from: 'client', text: 'Achei o valor um pouco alto. Tem desconto ou condição melhor?', time },
          { from: 'ia', text: 'Entendo sua preocupação! Posso apresentar condições flexíveis e mostrar o custo-benefício. Qual formato faria mais sentido para você?', time },
        ];
        const prev = target.status;
        return {
          ...s,
          conversations: { ...s.conversations, [target.id]: conv },
          leads: s.leads.map(l => l.id === target.id ? { ...l, status: 'Qualificado', lastMessage: 'Achei o valor um pouco alto...', time } : l),
          leadEvents: { ...s.leadEvents, [target.id]: [...(s.leadEvents[target.id] || []), { type: 'simulation', text: 'Simulação: objeção de preço', time }, ...(prev !== 'Qualificado' ? [{ type: 'status', text: `Status alterado: ${prev} → Qualificado`, time }] : [])] },
        };
      }
      if (type === 'conversao') {
        const target = s.leads.find(l => !['Convertido', 'Perdido'].includes(l.status)) || s.leads[0];
        if (!target) return s;
        const conv = [...(s.conversations[target.id] || []),
          { from: 'client', text: 'Perfeito, quero fechar! Pode me enviar o link de pagamento?', time },
          { from: 'ia', text: 'Ótimo! Vou encaminhar os próximos passos para conclusão. Fico feliz em avançar com você!', time },
        ];
        const prev = target.status;
        return {
          ...s,
          conversations: { ...s.conversations, [target.id]: conv },
          leads: s.leads.map(l => l.id === target.id ? { ...l, status: 'Convertido', lastMessage: 'Perfeito, quero fechar!', time } : l),
          leadEvents: { ...s.leadEvents, [target.id]: [...(s.leadEvents[target.id] || []), { type: 'simulation', text: 'Simulação: conversão', time }, ...(prev !== 'Convertido' ? [{ type: 'status', text: `Status alterado: ${prev} → Convertido`, time }] : [])] },
        };
      }
      return s;
    }),
  }), [state]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }) {
  return isRealMode() ? <RealAppProvider>{children}</RealAppProvider> : <DemoAppProvider>{children}</DemoAppProvider>;
}
