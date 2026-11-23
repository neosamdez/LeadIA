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
  },
};

export function AppProvider({ children }) {
  const [state, setState] = useState(() => ({ ...defaultState, ...loadState() }));

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
  }), [state]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}