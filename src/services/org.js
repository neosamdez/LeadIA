import { requireSupabase } from '../lib/supabase';

export async function getOrCreateDefaultOrg() {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc('get_or_create_org').single();
  if (error) throw error;
  return data;
}
