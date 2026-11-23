import { requireSupabase } from '../lib/supabase';

export async function getOrCreateDefaultOrg(user) {
  const sb = requireSupabase();
  // Try to find existing membership
  const { data: memberships, error: mErr } = await sb
    .from('memberships')
    .select('org_id, organizations(*)')
    .eq('user_id', user.id)
    .limit(1);
  if (mErr) throw mErr;
  if (memberships && memberships.length > 0) {
    return memberships[0].organizations || { id: memberships[0].org_id };
  }

  // Create org + membership
  const orgName = user.user_metadata?.company || user.email?.split('@')[0] || 'Minha Empresa';
  const { data: org, error: oErr } = await sb
    .from('organizations')
    .insert({ name: orgName, created_by: user.id })
    .select()
    .single();
  if (oErr) throw oErr;

  const { error: msErr } = await sb.from('memberships').insert({ org_id: org.id, user_id: user.id, role: 'owner' });
  if (msErr) throw msErr;

  const { error: sErr } = await sb.from('org_settings').insert({ org_id: org.id });
  if (sErr && sErr.code !== '23505') throw sErr;

  return org;
}
