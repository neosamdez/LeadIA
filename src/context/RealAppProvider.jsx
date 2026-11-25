import { useCallback, useEffect, useRef, useState } from 'react';
import { AppContext } from './contextCore';
import { requireSupabase } from '../lib/supabase';
import { getSession, onAuthStateChange, signOut } from '../services/auth';
import { getOrCreateDefaultOrg } from '../services/org';
import * as leadsService from '../services/leads';
import * as conversationsService from '../services/conversations';
import * as followUpsService from '../services/followUps';
import * as goalsService from '../services/goals';
import * as settingsService from '../services/settings';
import { appLeadToDb, dbLeadToApp, dbMessageToApp, dbFollowUpToApp, appFollowUpToDb } from '../lib/mappers';

const empty = {
  leads: [], conversations: {}, leadEvents: {}, followUps: [], dismissedAlerts: [],
  goals: { monthlyLeads: 0, conversionRate: 0, revenue: 0, responseMinutes: 0 },
  settings: { companyName: '', segment: '', tone: '', autoReply: false, followUp: true, useNvidiaApi: false, nvidiaApiKey: '' },
  tour: { active: false, step: 0 }, activePersonaId: null,
};
const noDemoAction = () => {};

async function loadOrganization(orgId) {
  const [leads, convs, followUps, goals, settings, eventsResult] = await Promise.all([
    leadsService.listLeads(orgId), conversationsService.listConversations(orgId),
    followUpsService.listFollowUps(orgId), goalsService.getGoals(orgId), settingsService.getOrgSettings(orgId),
    requireSupabase().from('lead_events').select('*').eq('org_id', orgId).order('created_at'),
  ]);
  if (eventsResult.error) throw eventsResult.error;
  const conversations = Object.fromEntries(convs.map(c => [c.lead_id,
    (c.messages || []).sort((a, b) => a.created_at.localeCompare(b.created_at)).map(dbMessageToApp)]));
  const leadEvents = {};
  for (const event of eventsResult.data) {
    (leadEvents[event.lead_id] ||= []).push({ ...event, time: new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
  }
  return { ...empty, leads: leads.map(dbLeadToApp), conversations, leadEvents,
    followUps: followUps.map(dbFollowUpToApp), goals: goals || empty.goals,
    settings: { ...empty.settings, ...settings },
  };
}

export default function RealAppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [pendingWrites, setPendingWrites] = useState(0);
  const [retry, setRetry] = useState(0);
  const principal = useRef(null);
  const org = useRef(null);
  const readVersion = useRef(0);
  const userId = session?.user?.id;

  useEffect(() => {
    let active = true;
    let authEventSeen = false;
    const receive = (next) => {
      if (!active) return;
      const id = next?.user?.id || null;
      if (principal.current !== id) {
        principal.current = id;
        org.current = null;
        readVersion.current++;
        setData(null); setOrganization(null); setLoadError(''); setSyncError(''); setPendingWrites(0);
      }
      setSession(next);
      setAuthReady(true);
    };
    let subscription;
    subscription = onAuthStateChange((_event, next) => { authEventSeen = true; receive(next); }).data.subscription;
    getSession().then(next => { if (!authEventSeen) receive(next); }).catch(err => {
      if (active) { setLoadError(err.message); setAuthReady(true); }
    });
    return () => { active = false; subscription?.unsubscribe(); };
  }, []);

  const refresh = useCallback(async () => {
    const expected = principal.current;
    const orgId = org.current?.id;
    if (!expected || !orgId) return;
    const version = ++readVersion.current;
    const next = await loadOrganization(orgId);
    if (principal.current === expected && version === readVersion.current) setData(next);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const nextOrg = await getOrCreateDefaultOrg();
      if (cancelled || principal.current !== userId) return;
      org.current = nextOrg;
      setOrganization(nextOrg);
      await refresh();
      if (!cancelled) setLoadError('');
    })().catch(err => { if (!cancelled) setLoadError(err.message || 'Não foi possível carregar o banco.'); });
    return () => { cancelled = true; };
  }, [userId, retry, refresh]);

  async function mutate(operation) {
    const expected = principal.current;
    const orgId = org.current?.id;
    if (!orgId || !data) { setSyncError('Aguarde o carregamento dos dados.'); return null; }
    let saved = false;
    setSyncError(''); setPendingWrites(n => n + 1);
    try {
      const result = await operation(orgId);
      saved = true;
      if (principal.current === expected) await refresh();
      return result;
    } catch (err) {
      if (principal.current === expected) setSyncError(saved
        ? 'A alteração foi gravada, mas a tela não pôde ser atualizada. Recarregue os dados.'
        : `Não foi salvo: ${err.message || 'falha de conexão'}. Tente a ação novamente.`);
      return null;
    } finally {
      if (principal.current === expected) setPendingWrites(n => Math.max(0, n - 1));
    }
  }

  const user = session?.user ? {
    id: userId, email: session.user.email, name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
    company: data?.settings.companyName || organization?.name || 'Minha Empresa', mode: 'real',
  } : null;
  const api = {
    ...(data || empty), user, orgId: organization?.id || null, authReady,
    databaseReady: Boolean(data), loadError, syncError, pendingWrites,
    retryLoad: () => { setLoadError(''); setRetry(n => n + 1); }, clearSyncError: () => setSyncError(''),
    // A sessão válida chega exclusivamente do serviço de autenticação.
    login: noDemoAction,
    logout: async () => {
      principal.current = null; org.current = null; readVersion.current++;
      setSession(null); setData(null); setOrganization(null); setPendingWrites(0);
      await signOut().catch(err => setLoadError(err.message));
    },
    addLead: lead => mutate(orgId => leadsService.createLead(orgId, appLeadToDb(lead, orgId))),
    updateLead: (id, patch) => mutate(() => leadsService.updateLead(id, patchForDb(patch))),
    updateLeadStatus: (id, status) => mutate(() => leadsService.updateLead(id, { status })),
    deleteLead: id => mutate(() => leadsService.deleteLead(id)),
    sendMessage: (leadId, message) => mutate(() => conversationsService.appendMessage(leadId, message)),
    recordEvent: (leadId, event) => mutate(async orgId => {
      const { error } = await requireSupabase().from('lead_events').insert({ org_id: orgId, lead_id: leadId,
        type: event.type || 'event', text: event.text, created_by: userId });
      if (error) throw error;
    }),
    addFollowUp: fu => mutate(orgId => followUpsService.createFollowUp(orgId, appFollowUpToDb(fu, orgId))),
    completeFollowUp: id => mutate(() => followUpsService.updateFollowUp(id, { status: 'done' })),
    updateGoals: patch => mutate(orgId => goalsService.upsertGoals(orgId, { ...data.goals, ...patch })),
    updateSettings: patch => mutate(orgId => settingsService.upsertOrgSettings(orgId, patch)),
    dismissAlert: id => setData(s => ({ ...s, dismissedAlerts: [...s.dismissedAlerts, id] })),
    clearDismissedAlerts: () => setData(s => ({ ...s, dismissedAlerts: [] })),
    applyPersona: noDemoAction, resetDemo: noDemoAction, simulateScenario: noDemoAction,
    startTour: noDemoAction, nextTour: noDemoAction, endTour: noDemoAction,
  };
  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

function patchForDb(patch) {
  const fields = { name: 'name', company: 'company', channel: 'channel', interest: 'interest', status: 'status', score: 'score',
    value: 'value', lastMessage: 'last_message', tags: 'tags', avatar: 'avatar', nextAction: 'next_action', lossReason: 'loss_reason', phone: 'phone_e164' };
  return Object.fromEntries(Object.entries(fields).filter(([key]) => key in patch).map(([key, col]) => [col, patch[key]]));
}
