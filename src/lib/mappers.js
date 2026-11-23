export function dbLeadToApp(row) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    company: row.company || '',
    channel: row.channel || 'WhatsApp',
    interest: row.interest || '',
    status: row.status || 'Novo',
    value: row.value ?? 0,
    lastMessage: row.last_message || '',
    time: row.updated_at ? new Date(row.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    avatar: row.avatar || (row.name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase(),
    score: row.score ?? 0,
    tags: row.tags || [],
    nextAction: row.next_action || '',
    lossReason: row.loss_reason || '',
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
  };
}

export function dbMessageToApp(row) {
  return {
    from: row.sender,
    text: row.content,
    time: row.created_at ? new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    id: row.id,
  };
}
