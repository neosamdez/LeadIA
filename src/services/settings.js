import { requireSupabase } from '../lib/supabase';
import { appSettingsToDb, dbSettingsToApp } from '../lib/mappers';
import { appContextToDb } from '../lib/orgContext';

export async function getOrgSettings(orgId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('org_settings')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return data ? dbSettingsToApp(data) : null;
}

export async function upsertOrgSettings(orgId, settingsPatch) {
  const sb = requireSupabase();
  const payload = { org_id: orgId, ...appSettingsToDb(settingsPatch) };
  const { data, error } = await sb
    .from('org_settings')
    .upsert(payload, { onConflict: 'org_id' })
    .select()
    .single();
  if (error) throw error;
  return dbSettingsToApp(data);
}

// Grava só as colunas do contexto para não sobrescrever outras configurações.
export async function updateOrgContext(orgId, context) {
  const { data, error } = await requireSupabase()
    .from('org_settings')
    .update(appContextToDb(context))
    .eq('org_id', orgId)
    .select()
    .single();
  if (error?.code === 'PGRST204') throw new Error('o banco ainda não recebeu a migração 003 do contexto');
  if (error) throw error;
  return dbSettingsToApp(data);
}
