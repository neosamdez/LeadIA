import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createRpc, runWorker } from './worker.mjs';

const endpoint = '/webhooks/whatsapp';
const maxBodyBytes = 1024 * 1024;
const phone = /^[1-9][0-9]{6,14}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deliveries = new Set(['sent', 'delivered', 'read', 'failed']);

function matches(expected, supplied) {
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied ?? '');
  return left.length === right.length && timingSafeEqual(left, right);
}

function reply(response, status, body = '') {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(body);
}

export function createWebhook({ verifyToken, appSecret, phoneNumberId, recipients, rpc, log = console.log }) {
  if (!verifyToken || !appSecret || !phoneNumberId || !recipients?.size || !rpc) {
    throw new Error('WhatsApp test configuration is incomplete');
  }

  return createServer(async (request, response) => {
    if (!request.url?.startsWith('/')) return reply(response, 400);
    const url = new URL('http://localhost' + request.url);
    if (url.pathname === '/healthz' && request.method === 'GET') {
      return reply(response, 200, 'ok');
    }
    if (url.pathname !== endpoint) return reply(response, 404);

    if (request.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      return mode === 'subscribe' && challenge && matches(verifyToken, token)
        ? reply(response, 200, challenge)
        : reply(response, 403);
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST');
      return reply(response, 405);
    }

    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        size += chunk.length;
        if (size > maxBodyBytes) return reply(response, 413);
        chunks.push(chunk);
      }

      const body = Buffer.concat(chunks);
      const hash = createHmac('sha256', appSecret).update(body).digest('hex');
      if (!matches('sha256=' + hash, request.headers['x-hub-signature-256'])) {
        log(JSON.stringify({ event: 'whatsapp_webhook_rejected', reason: 'invalid_signature', status: 403 }));
        return reply(response, 403);
      }

      let payload;
      try {
        payload = JSON.parse(body.toString('utf8'));
      } catch {
        return reply(response, 400);
      }

      if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
        return reply(response, 400);
      }

      for (const entry of payload.entry) {
        if (!Array.isArray(entry?.changes)) continue;
        for (const change of entry.changes) {
          const value = change?.value;
          if (change?.field !== 'messages' || value?.metadata?.phone_number_id !== phoneNumberId) continue;
          for (const message of Array.isArray(value.messages) ? value.messages : []) {
            const from = message?.from;
            const content = message?.text?.body;
            if (message?.type !== 'text' || !phone.test(from ?? '') || !recipients.has(from)
              || typeof message.id !== 'string' || !message.id || message.id.length > 512
              || typeof content !== 'string' || !content.trim() || content.length > 10000
              || !/^[0-9]{1,10}$/.test(message.timestamp ?? '')) continue;
            const contact = Array.isArray(value.contacts) && value.contacts.find(item => item?.wa_id === from);
            const name = typeof contact?.profile?.name === 'string' ? contact.profile.name.slice(0, 160) : null;
            const result = await rpc('whatsapp_ingest', {
              p_phone_id: phoneNumberId, p_from: from, p_name: name, p_message_id: message.id,
              p_content: content.trim(), p_received_at: new Date(Number(message.timestamp) * 1000).toISOString(),
            });
            log(JSON.stringify({ event: 'whatsapp_inbound', id: message.id.slice(-8), result }));
          }
          for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
            if (!deliveries.has(status?.status) || !recipients.has(status?.recipient_id)
              || typeof status.id !== 'string' || !status.id || status.id.length > 512) continue;
            const job = uuid.test(status.biz_opaque_callback_data ?? '') ? status.biz_opaque_callback_data : null;
            if (await rpc('whatsapp_finish', { p_job: job, p_delivery: status.status, p_outbound_id: status.id })) {
              log(JSON.stringify({ event: 'whatsapp_delivery', id: status.id.slice(-8), result: status.status }));
            }
          }
        }
      }
      log(JSON.stringify({ event: 'whatsapp_webhook_processed', status: 200 }));
      return reply(response, 200);
    } catch {
      log(JSON.stringify({ event: 'whatsapp_webhook_retry', status: 503 }));
      return reply(response, 503);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    recipients: new Set((process.env.WHATSAPP_TEST_RECIPIENTS ?? '').split(',').map(value => value.trim()).filter(Boolean)),
    graphVersion: process.env.META_GRAPH_VERSION,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    crmUrl: process.env.WHATSAPP_CRM_URL?.replace(/\/$/, ''),
    crmToken: process.env.WHATSAPP_CRM_TOKEN,
    claudeKey: process.env.ANTHROPIC_API_KEY,
    claudeModel: process.env.CLAUDE_MODEL,
  };
  if (!/^v[0-9]+\.[0-9]+$/.test(config.graphVersion ?? '') || !/^[0-9]+$/.test(config.phoneNumberId ?? '')
    || !config.crmUrl || !config.crmToken || !config.accessToken || [...config.recipients].some(value => !phone.test(value))
    || (config.claudeKey && !/^claude-haiku-/.test(config.claudeModel ?? ''))) {
    throw new Error('WhatsApp dev worker configuration is incomplete');
  }
  const rpc = createRpc(config);
  const server = createWebhook({ ...config, rpc });
  const stop = new AbortController();
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => { stop.abort(); server.close(); });
  }
  server.listen(3000, '0.0.0.0');
  await runWorker(rpc, config, stop.signal);
}
