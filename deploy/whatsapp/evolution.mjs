import { timingSafeEqual } from 'node:crypto';

// Provedor alternativo ao Meta Cloud API, baseado na Evolution API (Baileys).
// Atenção: a Evolution usa o protocolo não oficial do WhatsApp Web. Use só em
// ensaio com número de teste; a Meta Cloud API continua sendo o provedor de produção.

const phoneDigits = /^[1-9][0-9]{6,14}$/;
const channelKey = /^[0-9]{1,18}$/;
const deliveries = { SERVER_ACK: 'sent', DELIVERY_ACK: 'delivered', READ: 'read', PLAYED: 'read', ERROR: 'failed' };

export function matchesSecret(expected, supplied) {
  const left = Buffer.from(expected);
  const right = Buffer.from(typeof supplied === 'string' ? supplied : '');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function evolutionConfigProblems({ url, key, instance, secret, channel }) {
  const problems = [];
  if (!/^https?:\/\//.test(url ?? '')) problems.push('EVOLUTION_API_URL');
  if (!key) problems.push('EVOLUTION_API_KEY');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(instance ?? '')) problems.push('EVOLUTION_INSTANCE');
  if (!secret || secret.length < 32) problems.push('EVOLUTION_WEBHOOK_SECRET');
  if (!channelKey.test(channel ?? '')) problems.push('EVOLUTION_CHANNEL_KEY');
  return problems;
}

// Envia texto pela instância. Mesmo contrato de deliver() do Meta:
// accepted com id, failed para recusa definitiva, uncertain para o resto.
// O corpo {number, text} segue a especificação 2.1 da Evolution; a 2.3 documenta
// textMessage.text. Confirme a versão instalada no ensaio antes de produção.
export async function sendEvolutionText(job, text, { evolutionUrl, evolutionKey, evolutionInstance, fetch: request = fetch }) {
  try {
    const response = await request(`${evolutionUrl}/message/sendText/${encodeURIComponent(evolutionInstance)}`, {
      method: 'POST',
      headers: { apikey: evolutionKey, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ number: job.recipient, text }),
    });
    if (response.status >= 400 && response.status < 500) return { delivery: 'failed' };
    if (!response.ok) return { delivery: 'uncertain' };
    const payload = await response.json();
    const id = payload?.key?.id;
    return typeof id === 'string' && id.length > 0 && id.length <= 512
      ? { delivery: 'accepted', id }
      : { delivery: 'uncertain' };
  } catch {
    return { delivery: 'uncertain' };
  }
}

function eventName(event) {
  return String(event ?? '').toLowerCase().replace(/_/g, '.');
}

function asList(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

// Lê mensagens recebidas (messages.upsert) de conversas individuais com números autorizados.
export function readInbound(payload, { instance, recipients }) {
  if (payload?.instance !== instance || eventName(payload.event) !== 'messages.upsert') return [];
  const items = [];
  for (const data of asList(payload.data)) {
    const key = data?.key;
    const match = /^([0-9]+)@s\.whatsapp\.net$/.exec(key?.remoteJid ?? '');
    const from = match?.[1];
    const content = data?.message?.conversation ?? data?.message?.extendedTextMessage?.text;
    const seconds = Number(data?.messageTimestamp);
    if (key?.fromMe !== false || !from || !phoneDigits.test(from) || !recipients.has(from)) continue;
    if (typeof key.id !== 'string' || !key.id || key.id.length > 512) continue;
    if (typeof content !== 'string' || !content.trim() || content.length > 10000) continue;
    if (!Number.isFinite(seconds) || seconds <= 0) continue;
    const name = typeof data.pushName === 'string' ? data.pushName.slice(0, 160) : null;
    items.push({
      id: key.id, from, name, content: content.trim(),
      receivedAt: new Date(seconds * 1000).toISOString(),
    });
  }
  return items;
}

// Lê atualizações de entrega (messages.update) e as converte para o vocabulário do CRM.
export function readStatuses(payload, { instance, recipients }) {
  if (payload?.instance !== instance || eventName(payload.event) !== 'messages.update') return [];
  const items = [];
  for (const data of asList(payload.data)) {
    const id = data?.key?.id ?? data?.keyId;
    const remote = data?.key?.remoteJid ?? data?.remoteJid ?? '';
    const from = /^([0-9]+)@s\.whatsapp\.net$/.exec(remote)?.[1];
    const delivery = deliveries[data?.status ?? data?.update?.status];
    if (data?.fromMe === false || data?.key?.fromMe === false) continue;
    if (!delivery || typeof id !== 'string' || !id || id.length > 512) continue;
    if (!from || !recipients.has(from)) continue;
    items.push({ id, delivery });
  }
  return items;
}
