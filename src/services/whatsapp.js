import { requireSupabase } from '../lib/supabase';

async function request(path, { method = 'GET', orgId, signal } = {}) {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Faça login novamente para conectar o WhatsApp.');
  const response = await fetch(`/whatsapp/v1/${path}${method === 'GET' ? `?orgId=${encodeURIComponent(orgId)}` : ''}`, {
    method, signal,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(method !== 'GET' && { 'Content-Type': 'application/json' }),
    },
    ...(method !== 'GET' && { body: JSON.stringify({ orgId }) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages = {
      whatsapp_not_configured: 'A conexão ainda não foi configurada no servidor.',
      forbidden: 'Somente owner ou admin pode gerenciar esta conexão.',
      qr_unavailable: 'A Evolution API não retornou o QR Code. Tente gerar outro.',
      whatsapp_provider_unavailable: 'Não foi possível falar com o serviço do WhatsApp. Tente novamente.',
    };
    throw new Error(messages[body.error] || 'Não foi possível concluir a operação.');
  }
  return body;
}

export const getWhatsappStatus = orgId => request('status', { orgId });
export const connectWhatsapp = orgId => request('connect', { method: 'POST', orgId });
export const disconnectWhatsapp = orgId => request('disconnect', { method: 'POST', orgId });
