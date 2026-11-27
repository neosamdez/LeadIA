import { requireSupabase } from '../lib/supabase';

const MISSING = ['PGRST205', '42P01', 'PGRST202'];
const migrationError = () => new Error('o banco ainda não recebeu a migração 004 dos agentes');

export function dbRevisionToApp(row) {
  return { id: row.id, number: row.number, config: row.config, context: row.context, restoredFrom: row.restored_from,
    createdBy: row.created_by, createdAt: row.created_at };
}

export function dbAgentToApp(row, revisions = []) {
  return { id: row.id, kind: row.kind, name: row.name, draft: row.draft || {}, publishedRevisionId: row.published_revision_id,
    updatedAt: row.updated_at, updatedBy: row.updated_by, revisions };
}

// Retorna null quando a migração 004 ainda não chegou, sem derrubar o restante do carregamento.
export async function getAgent(orgId) {
  const sb = requireSupabase();
  const { data, error } = await sb.from('agents').select('*').eq('org_id', orgId).eq('kind', 'atendimento').maybeSingle();
  if (error && MISSING.includes(error.code)) return null;
  if (error) throw error;
  if (!data) return { id: null, kind: 'atendimento', name: 'Atendimento', draft: {}, publishedRevisionId: null, revisions: [] };
  const revs = await sb.from('agent_revisions').select('*').eq('agent_id', data.id).order('number', { ascending: false });
  if (revs.error) throw revs.error;
  return dbAgentToApp(data, revs.data.map(dbRevisionToApp));
}

// Cria o agente no primeiro salvamento; depois só o rascunho muda.
export async function saveAgentDraft(orgId, agentId, draft) {
  const sb = requireSupabase();
  const query = agentId
    ? sb.from('agents').update({ draft }).eq('id', agentId)
    : sb.from('agents').insert({ org_id: orgId, kind: 'atendimento', name: 'Atendimento', draft });
  const { data, error } = await query.select().single();
  if (error && MISSING.includes(error.code)) throw migrationError();
  if (error) throw error;
  return data.id;
}

export async function publishAgent(agentId) {
  const { data, error } = await requireSupabase().rpc('publish_agent', { p_agent_id: agentId });
  if (error && MISSING.includes(error.code)) throw migrationError();
  if (error) throw error;
  return data;
}

export async function restoreRevision(revisionId) {
  const { data, error } = await requireSupabase().rpc('restore_agent_revision', { p_revision_id: revisionId });
  if (error) throw error;
  return data;
}
