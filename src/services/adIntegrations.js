import { requireSupabase } from '../lib/supabase';

const MISSING = ['PGRST205', '42P01'];

export function dbIntegrationToApp(row) {
  return { id: row.id, provider: row.provider, externalId: row.external_id, displayName: row.display_name || '',
    status: row.status, settings: row.settings || {}, lastError: row.last_error || '', createdAt: row.created_at, updatedAt: row.updated_at };
}

// Null quando a migração 005 ainda não foi aplicada.
export async function listIntegrations(orgId) {
  const { data, error } = await requireSupabase().from('ad_integrations').select('*').eq('org_id', orgId).order('created_at');
  if (error && MISSING.includes(error.code)) return null;
  if (error) throw error;
  return data.map(dbIntegrationToApp);
}

export async function addIntegration(orgId, { provider, externalId, displayName }) {
  const { error } = await requireSupabase().from('ad_integrations')
    .insert({ org_id: orgId, provider, external_id: externalId, display_name: displayName || null });
  if (error?.code === '23505') throw new Error('esse identificador já está cadastrado');
  if (error && MISSING.includes(error.code)) throw new Error('o banco ainda não recebeu a migração 005 das integrações');
  if (error) throw error;
}

export async function updateIntegration(id, patch) {
  const payload = {};
  if ('displayName' in patch) payload.display_name = patch.displayName || null;
  if ('status' in patch) payload.status = patch.status;
  if ('settings' in patch) payload.settings = patch.settings;
  const { error } = await requireSupabase().from('ad_integrations').update(payload).eq('id', id);
  if (error) throw error;
}

export async function removeIntegration(id) {
  const { error } = await requireSupabase().from('ad_integrations').delete().eq('id', id);
  if (error) throw error;
}
