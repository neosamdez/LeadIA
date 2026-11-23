import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { seedConversations, seedLeads } from '../data/mockData';
import { personas, defaultPersonaId } from '../data/personas';
import { isSupabaseConfigured } from '../lib/config';
import { onAuthStateChange, signOut } from '../services/auth';
import { getOrCreateDefaultOrg } from '../services/org';
import * as leadsService from '../services/leads';
import * as conversationsService from '../services/conversations';
import { dbLeadToApp, appLeadToDb, dbMessageToApp } from '../lib/mappers';

const AppContext = createContext(null);
const STORAGE_KEY = 'leadia_app_v1';

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
};

export function AppProvider({ children }) {
  const [state, setState] = useState(() => mergeState(loadState()));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return undefined;
    const { data } = onAuthStateChange((_event, session) => {
      const u = session?.user;
      setState((s) => {
        if (u) {
          return {
            ...s,
            user: {
              id: u.id,
              name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Usuário',
              company: u.user_metadata?.company || s.user?.company || 'Minha Empresa',
              email: u.email || '',
              mode: 'real',
            },
          };
        }
        if (s.user?.mode === 'real') return { ...s, user: null };
        return s;
      });
    });
    return () => data?.subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || state.user?.mode !== 'real' || !state.user?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const org = await getOrCreateDefaultOrg({ id: state.user.id, email: state.user.email, user_metadata: { company: state.user.company, full_name: state.user.name } });
        if (cancelled) return;
        const [dbLeads, dbConvs] = await Promise.all([
          leadsService.listLeads(org.id),
          conversationsService.listConversations(org.id),
        ]);
        if (cancelled) return;
        const leads = (dbLeads || []).map(dbLeadToApp);
        const conversations = {};
        for (const c of (dbConvs || [])) {
          const msgs = (c.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(dbMessageToApp);
          conversations[c.lead_id] = msgs;
        }
        setState((s) => ({ ...s, orgId: org.id, leads, conversations, leadEvents: buildSeedEvents(leads, conversations) }));
      } catch (err) {
        console.error('Falha ao carregar dados reais', err);
      }
    })();
    return () => { cancelled = true; };
  }, [state.user?.mode, state.user?.id]);

  const api = useMemo(() => ({
    ...state,
    login: (user) => setState((s) => ({ ...s, user })),
    logout: () => {
      if (isSupabaseConfigured()) signOut().catch(() => {});
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
      if (state.user?.mode === 'real' && state.orgId) {
        const dbPatch = {};
        if ('name' in patch) dbPatch.name = patch.name;
        if ('company' in patch) dbPatch.company = patch.company;
        if ('channel' in patch) dbPatch.channel = patch.channel;
        if ('interest' in patch) dbPatch.interest = patch.interest;
        if ('status' in patch) dbPatch.status = patch.status;
        if ('score' in patch) dbPatch.score = patch.score;
        if ('lastMessage' in patch) dbPatch.last_message = patch.lastMessage;
        if ('tags' in patch) dbPatch.tags = patch.tags;
        if ('avatar' in patch) dbPatch.avatar = patch.avatar;
        if (Object.keys(dbPatch).length) leadsService.updateLead(id, dbPatch).catch((e) => console.error('updateLead supabase', e));
      }
    },
    deleteLead: (id) => {
      setState((s) => {
        const { [id]: _conv, ...restConv } = s.conversations;
        const { [id]: _ev, ...restEv } = s.leadEvents;
        return { ...s, leads: s.leads.filter((l) => l.id !== id), conversations: restConv, leadEvents: restEv, followUps: s.followUps.filter(f => f.leadId !== id) };
      });
      if (state.user?.mode === 'real' && state.orgId) {
        leadsService.deleteLead(id).catch((e) => console.error('deleteLead supabase', e));
      }
    },
    dismissAlert: (alertId) => setState((s) => ({ ...s, dismissedAlerts: s.dismissedAlerts.includes(alertId) ? s.dismissedAlerts : [...s.dismissedAlerts, alertId] })),
    clearDismissedAlerts: () => setState((s) => ({ ...s, dismissedAlerts: [] })),
    addFollowUp: (fu) => setState((s) => ({ ...s, followUps: [{ id: 'fu' + Date.now(), done: false, createdAt: nowTime(), ...fu }, ...s.followUps] })),
    completeFollowUp: (id) => setState((s) => ({ ...s, followUps: s.followUps.map(f => f.id === id ? { ...f, done: true } : f) })),
    updateGoals: (patch) => setState((s) => ({ ...s, goals: { ...s.goals, ...patch } })),
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
      if (state.user?.mode === 'real' && state.orgId) {
        leadsService.updateLead(id, { status }).catch((e) => console.error('updateLeadStatus supabase', e));
      }
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
      if (state.user?.mode === 'real' && state.orgId) {
        (async () => {
          try {
            const payload = appLeadToDb(localLead, state.orgId);
            const created = await leadsService.createLead(state.orgId, payload);
            const mapped = dbLeadToApp(created);
            setState((s) => {
              const conversations = { ...s.conversations, [mapped.id]: s.conversations[localLead.id] || [] };
              if (mapped.id !== localLead.id) delete conversations[localLead.id];
              const leadEvents = { ...s.leadEvents, [mapped.id]: s.leadEvents[localLead.id] || [] };
              if (mapped.id !== localLead.id) delete leadEvents[localLead.id];
              return { ...s, leads: s.leads.map((l) => (l.id === localLead.id ? { ...mapped, time: l.time } : l)), conversations, leadEvents };
            });
          } catch (e) {
            console.error('addLead supabase', e);
          }
        })();
      }
    },
    sendMessage: (leadId, message) => {
      setState((s) => {
        const conv = s.conversations[leadId] || [];
        const nextConv = [...conv, message];
        const leads = s.leads.map((l) => l.id === leadId ? { ...l, lastMessage: message.text, time: message.time } : l);
        return { ...s, conversations: { ...s.conversations, [leadId]: nextConv }, leads };
      });
      if (state.user?.mode === 'real' && state.orgId) {
        (async () => {
          try {
            const conv = await conversationsService.upsertConversation(state.orgId, leadId);
            await conversationsService.addMessage(state.orgId, {
              conversationId: conv.id,
              leadId,
              sender: message.from || 'client',
              content: message.text,
              meta: {},
            });
            await leadsService.updateLead(leadId, { last_message: message.text }).catch(() => {});
          } catch (e) {
            console.error('sendMessage supabase', e);
          }
        })();
      }
    },
    updateSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    applyPersona: (personaId) => setState((s) => {
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
    resetDemo: () => setState((s) => ({
      ...defaultState,
      user: s.user,
      settings: { ...defaultState.settings, nvidiaApiKey: s.settings.nvidiaApiKey, nvidiaModel: s.settings.nvidiaModel, nvidiaProxyUrl: s.settings.nvidiaProxyUrl, useNvidiaApi: s.settings.useNvidiaApi },
    })),
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