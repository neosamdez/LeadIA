import { requireSupabase } from '../lib/supabase';
import { appSettingsToDb, dbSettingsToApp } from '../lib/mappers';

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
