import { followUpDueDate } from './followUpDates';

export function dbLeadToApp(row) {
  if (!row) return row;
  return {
    id: row.id,
    ownerId: row.owner_id || null,
    name: row.name,
    company: row.company || '',
    phone: row.phone_e164 || '',
    channel: row.channel || 'WhatsApp',
    interest: row.interest || '',
    status: row.status || 'Novo',
    value: Number(row.value ?? 0),
    lastMessage: row.last_message || '',
    time: row.updated_at ? new Date(row.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    avatar: row.avatar || (row.name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(),
    score: row.score ?? 0,
    tags: row.tags || [],
    nextAction: row.next_action || '',
    lossReason: row.loss_reason || '',
    whatsappConnected: row.external_id?.startsWith('whatsapp:') || false,
    whatsappPaused: row.whatsapp_paused === true,
    _db: true,
  };
}

export function appLeadToDb(lead, orgId) {
  return {
    org_id: orgId,
    name: lead.name,
    company: lead.company || null,
    channel: lead.channel || null,
    interest: lead.interest || null,
    status: lead.status || 'Novo',
    score: lead.score ?? 0,
    last_message: lead.lastMessage || null,
    avatar: lead.avatar || null,
    tags: lead.tags || [],
    value: Number(lead.value || 0),
    next_action: lead.nextAction || null,
    loss_reason: lead.lossReason || null,
    phone_e164: lead.phone || null,
  };
}

export function dbMessageToApp(row) {
  return {
    from: row.sender,
    text: row.content,
    time: row.created_at ? new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    id: row.id,
    whatsappDelivery: row.meta?.channel === 'whatsapp' ? row.meta.delivery : undefined,
  };
}

export function dbFollowUpToApp(row) {
  if (!row) return row;
  return {
    id: row.id,
    leadId: row.lead_id,
    title: row.title || '',
    note: row.note || '',
    when: row.when_label || '',
    dueAt: row.due_at || '',
    done: row.status === 'done',
    status: row.status || 'open',
    createdAt: row.created_at || '',
  };
}

export function appFollowUpToDb(fu, orgId) {
  return {
    org_id: orgId,
    lead_id: fu.leadId,
    title: fu.title || '',
    note: fu.note || null,
    when_label: fu.when || null,
    due_at: followUpDueDate(fu, fu.createdAt || new Date())?.toISOString() ?? null,
    status: fu.done ? 'done' : (fu.status || 'open'),
  };
}

export function dbGoalsToApp(row) {
  if (!row) return null;
  return {
    monthlyLeads: Number(row.target_leads ?? 0),
    conversionRate: Number(row.target_conversion ?? 0),
    revenue: Number(row.target_revenue ?? 0),
    responseMinutes: Number(row.target_response_minutes ?? 0),
  };
}

export function appGoalsToDb(goals, orgId) {
  return {
    org_id: orgId,
    period: 'monthly',
    target_leads: Number(goals.monthlyLeads ?? 0),
    target_conversion: Number(goals.conversionRate ?? 0),
    target_response_minutes: Number(goals.responseMinutes ?? 0),
    target_revenue: Number(goals.revenue ?? 0),
  };
}

export function dbSettingsToApp(row) {
  if (!row) return null;
  return {
    companyName: row.company_name ?? '',
    segment: row.segment ?? '',
    tone: row.tone ?? '',
    autoReply: row.auto_reply ?? true,
    followUp: row.follow_up ?? true,
    useNvidiaApi: row.use_nvidia_api ?? true,
    nvidiaModel: row.nvidia_model ?? '',
    nvidiaProxyUrl: row.nvidia_proxy_url ?? '',
  };
}

export function appSettingsToDb(settings) {
  const patch = {};
  if ('companyName' in settings) patch.company_name = settings.companyName || null;
  if ('segment' in settings) patch.segment = settings.segment || null;
  if ('tone' in settings) patch.tone = settings.tone || null;
  if ('autoReply' in settings) patch.auto_reply = !!settings.autoReply;
  if ('followUp' in settings) patch.follow_up = !!settings.followUp;
  if ('useNvidiaApi' in settings) patch.use_nvidia_api = !!settings.useNvidiaApi;
  if ('nvidiaModel' in settings) patch.nvidia_model = settings.nvidiaModel || null;
  if ('nvidiaProxyUrl' in settings) patch.nvidia_proxy_url = settings.nvidiaProxyUrl || null;
  if ('aiEnabled' in settings) patch.ai_enabled = !!settings.aiEnabled;
  return patch;
}
