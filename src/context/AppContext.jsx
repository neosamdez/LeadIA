import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { seedConversations, seedLeads } from '../data/mockData';

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

function mergeState(loaded) {
  if (!loaded) return defaultState;
  return {
    ...defaultState,
    ...loaded,
    settings: { ...defaultState.settings, ...(loaded.settings || {}) },
    tour: { ...defaultState.tour, ...(loaded.tour || {}) },
  };
}

const defaultState = {
  user: null,
  leads: seedLeads,
  conversations: seedConversations,
  settings: {
    companyName: 'Minha Empresa',
    segment: 'Agências de viagens',
    tone: 'Profissional e amigável',
    autoReply: true,
    followUp: true,
    nvidiaApiKey: '',
    nvidiaModel: import.meta.env.VITE_NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
    useNvidiaApi: true,
  },
  tour: { active: false, step: 0 },
};

export function AppProvider({ children }) {
  const [state, setState] = useState(() => mergeState(loadState()));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const api = useMemo(() => ({
    ...state,
    login: (user) => setState((s) => ({ ...s, user })),
    logout: () => setState((s) => ({ ...s, user: null })),
    updateLeadStatus: (id, status) => setState((s) => ({
      ...s,
      leads: s.leads.map((l) => (l.id === id ? { ...l, status } : l)),
    })),
    addLead: (lead) => setState((s) => ({
      ...s,
      leads: [lead, ...s.leads],
      conversations: { ...s.conversations, [lead.id]: [] },
    })),
    sendMessage: (leadId, message) => setState((s) => {
      const conv = s.conversations[leadId] || [];
      const nextConv = [...conv, message];
      const leads = s.leads.map((l) => l.id === leadId ? { ...l, lastMessage: message.text, time: message.time } : l);
      return { ...s, conversations: { ...s.conversations, [leadId]: nextConv }, leads };
    }),
    updateSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    resetDemo: () => setState(defaultState),
    startTour: () => setState((s) => ({ ...s, tour: { active: true, step: 0 } })),
    nextTour: () => setState((s) => ({ ...s, tour: { ...s.tour, step: s.tour.step + 1 } })),
    endTour: () => setState((s) => ({ ...s, tour: { active: false, step: 0 } })),
    simulateScenario: (type) => setState((s) => {
      const now = new Date();
      const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const id = 'sim' + Date.now();
      if (type === 'novo_lead') {
        const lead = { id, name: 'Fernanda Alves', channel: 'Instagram', interest: 'Pacote Fernando de Noronha', status: 'Novo', value: 6200, lastMessage: 'Oi! Vi o pacote para Noronha. Tem datas para julho?', time, avatar: 'FA', score: 75, tags: ['Viagem', 'Alta intenção'], nextAction: 'Qualificar datas e número de pessoas', lossReason: '' };
        const conv = [
          { from: 'client', text: 'Oi! Vi o pacote para Noronha. Tem datas para julho?', time },
          { from: 'ia', text: 'Olá, Fernanda! Temos sim disponibilidade em julho. Você pretende viajar sozinha ou acompanhada?', time },
        ];
        return { ...s, leads: [lead, ...s.leads], conversations: { ...s.conversations, [id]: conv } };
      }
      if (type === 'objecao') {
        const target = s.leads.find(l => l.status !== 'Convertido' && l.status !== 'Perdido') || s.leads[0];
        if (!target) return s;
        const conv = [...(s.conversations[target.id] || []),
          { from: 'client', text: 'Achei o valor um pouco alto. Tem desconto ou condição melhor?', time },
          { from: 'ia', text: 'Entendo sua preocupação! Posso parcelar em até 10x sem juros ou oferecer um bônus de traslado. Qual opção faz mais sentido para você?', time },
        ];
        return { ...s, conversations: { ...s.conversations, [target.id]: conv }, leads: s.leads.map(l => l.id === target.id ? { ...l, status: 'Qualificado', lastMessage: 'Achei o valor um pouco alto...', time } : l) };
      }
      if (type === 'conversao') {
        const target = s.leads.find(l => !['Convertido', 'Perdido'].includes(l.status)) || s.leads[0];
        if (!target) return s;
        const conv = [...(s.conversations[target.id] || []),
          { from: 'client', text: 'Perfeito, quero fechar! Pode me enviar o link de pagamento?', time },
          { from: 'ia', text: 'Ótimo! Enviei o link de pagamento e registrei sua proposta como fechada. Bem-vindo(a)!', time },
        ];
        return { ...s, conversations: { ...s.conversations, [target.id]: conv }, leads: s.leads.map(l => l.id === target.id ? { ...l, status: 'Convertido', lastMessage: 'Perfeito, quero fechar!', time } : l) };
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