import { requireSupabase } from '../lib/supabase';

export async function listConversations(orgId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('conversations')
    .select('*, messages(*)')
    .eq('org_id', orgId);
  if (error) throw error;
  return data;
}

export async function getConversationByLead(orgId, leadId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('conversations')
    .select('*, messages(*)')
    .eq('org_id', orgId)
    .eq('lead_id', leadId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertConversation(orgId, leadId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('conversations')
    .upsert({ org_id: orgId, lead_id: leadId }, { onConflict: 'lead_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function addMessage(orgId, { conversationId, leadId, sender, content, meta = {} }) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('messages')
    .insert({ org_id: orgId, conversation_id: conversationId, lead_id: leadId, sender, content, meta })
    .select()
    .single();
  if (error) throw error;
  return data;
}
