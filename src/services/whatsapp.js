import { requireSupabase } from '../lib/supabase';

async function request(path, { method = 'GET', orgId, signal, enabled } = {}) {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Faça login novamente para conectar o WhatsApp.');
  const response = await fetch(`/whatsapp/v1/${path}${method === 'GET' ? `?orgId=${encodeURIComponent(orgId)}` : ''}`, {
    method, signal,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(method !== 'GET' && { 'Content-Type': 'application/json' }),
    },
    ...(method !== 'GET' && { body: JSON.stringify({ orgId, enabled }) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages = {
      whatsapp_not_configured: 'A conexão ainda não foi configurada no servidor.',
      forbidden: 'Somente owner ou admin pode gerenciar esta conexão.',
      qr_unavailable: 'A Evolution API não retornou o QR Code. Tente gerar outro.',
      whatsapp_provider_unavailable: 'Não foi possível falar com o serviço do WhatsApp. Tente novamente.',
      whatsapp_not_connected: 'Conecte o WhatsApp antes de ativar as respostas.',
      agent_not_published: 'Publique um agente com objetivo e permissão de responder.',
      agent_model_unavailable: 'O modelo de IA do agente ainda não está configurado no servidor.',
    };
    throw new Error(messages[body.error] || 'Não foi possível concluir a operação.');
  }
  return body;
}

export const getWhatsappStatus = orgId => request('status', { orgId });
export const connectWhatsapp = orgId => request('connect', { method: 'POST', orgId });
export const disconnectWhatsapp = orgId => request('disconnect', { method: 'POST', orgId });
export const setWhatsappAutomation = (orgId, enabled) => request('automation', { method: 'POST', orgId, enabled });
