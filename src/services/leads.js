import { requireSupabase } from '../lib/supabase';

export async function listLeads(orgId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('leads')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createLead(orgId, lead) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('leads')
    .insert({ ...lead, org_id: orgId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLead(id, patch) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('leads')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLead(id) {
  const sb = requireSupabase();
  const { error } = await sb.from('leads').delete().eq('id', id);
  if (error) throw error;
}
