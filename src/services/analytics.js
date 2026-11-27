import { requireSupabase } from '../lib/supabase';

export const PAGE_SIZE = 10;

export async function readAnalyticsPage({ orgId, metric, start, cutoff, page, signal }) {
  const db = requireSupabase();
  const query = metric === 'new-leads'
    ? db.from('leads').select('id,name,created_at', { count: 'exact' })
      .eq('org_id', orgId).gte('created_at', start).lt('created_at', cutoff)
      .order('created_at', { ascending: false })
    : db.from('follow_ups').select('id,lead_id,title,due_at', { count: 'exact' })
      .eq('org_id', orgId).eq('status', 'open').lt('due_at', cutoff)
      .order('due_at');

  const offset = page * PAGE_SIZE;
  const { data, count, error } = await query.order('id').range(offset, offset + PAGE_SIZE - 1).abortSignal(signal);
  if (error) throw error;
  if (count == null) throw new Error('Contagem indisponível.');
  return { rows: data, count };
}
