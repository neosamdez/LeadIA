import { requireSupabase } from '../lib/supabase';
import { appGoalsToDb, dbGoalsToApp } from '../lib/mappers';

export async function getGoals(orgId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('goals')
    .select('*')
    .eq('org_id', orgId)
    .eq('period', 'monthly')
    .maybeSingle();
  if (error) throw error;
  return data ? dbGoalsToApp(data) : null;
}

export async function upsertGoals(orgId, goals) {
  const sb = requireSupabase();
  const payload = appGoalsToDb(goals, orgId);
  const { data, error } = await sb
    .from('goals')
    .upsert(payload, { onConflict: 'org_id,period' })
    .select()
    .single();
  if (error) throw error;
  return dbGoalsToApp(data);
}
