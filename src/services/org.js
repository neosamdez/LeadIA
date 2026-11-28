import { requireSupabase } from '../lib/supabase';

export async function getOrCreateDefaultOrg() {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('get_or_create_org').single();
  if (error) throw error;
  return data;
}

export async function listOrgMembers(orgId) {
  const { data, error } = await requireSupabase().rpc('list_lead_assignees', { p_org_id: orgId });
  if (error?.code === 'PGRST202') return [];
  if (error) throw error;
  return data.map(member => ({ id: member.user_id, role: member.role, name: member.full_name || 'Membro' }));
}
