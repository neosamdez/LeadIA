import { requireSupabase } from '../lib/supabase';

export async function listFollowUps(orgId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('follow_ups')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createFollowUp(orgId, payload) {
  const sb = requireSupabase();
  const { data, error } = await sb.from('follow_ups').insert({ ...payload, org_id: orgId }).select().single();
  if (error) throw error;
  return data;
}

export async function updateFollowUp(id, patch) {
  const sb = requireSupabase();
  const { data, error } = await sb.from('follow_ups').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
