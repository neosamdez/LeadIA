import { requireSupabase } from '../lib/supabase';

export async function getOrCreateDefaultOrg() {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('get_or_create_org').single();
  if (error) throw error;
  return data;
}

export async function listOrgMembers(orgId) {
  const sb = requireSupabase();
  const memberships = await sb.from('memberships').select('user_id, role').eq('org_id', orgId).order('created_at');
  if (memberships.error) throw memberships.error;
  if (!memberships.data.length) return [];
  const profiles = await sb.from('profiles').select('id, full_name').in('id', memberships.data.map(member => member.user_id));
  if (profiles.error) throw profiles.error;
  const names = new Map(profiles.data.map(profile => [profile.id, profile.full_name]));
  return memberships.data.map(member => ({ id: member.user_id, role: member.role, name: names.get(member.user_id) || 'Membro' }));
}
