import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createRpc, runWorker } from './worker.mjs';
import { createAiHandler } from './ai.mjs';
import { evolutionConfigProblems, matchesSecret, readInbound, readStatuses } from './evolution.mjs';

const endpoint = '/webhooks/whatsapp';
const evolutionEndpoint = '/webhooks/evolution';
const aiEndpoint = '/ai/v1/complete';
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

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBodyBytes) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createWebhook({ verifyToken, appSecret, phoneNumberId, recipients, rpc, ai, evolution, whatsappEnabled = true, log = console.log }) {
  if (whatsappEnabled && (!verifyToken || !appSecret || !phoneNumberId || !recipients?.size || !rpc)) {
    throw new Error('WhatsApp test configuration is incomplete');
  }
  if (evolution && (!evolution.secret || !evolution.instance || !evolution.channelKey || !recipients?.size || !rpc)) {
    throw new Error('Evolution configuration is incomplete');
  }

  return createServer(async (request, response) => {
    if (!request.url?.startsWith('/')) return reply(response, 400);
    const url = new URL('http://localhost' + request.url);
    if (url.pathname === '/healthz' && request.method === 'GET') {
      return reply(response, 200, 'ok');
    }
    if (url.pathname === aiEndpoint) {
      return ai ? ai(request, response) : reply(response, 404);
    }
    if (evolution && url.pathname === evolutionEndpoint) {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return reply(response, 405);
      }
      if (!matchesSecret(evolution.secret, request.headers['x-leadia-webhook-secret'])) {
        log(JSON.stringify({ event: 'evolution_webhook_rejected', reason: 'invalid_secret', status: 403 }));
        return reply(response, 403);
      }
      try {
        const body = await readBody(request);
        if (!body) return reply(response, 413);
        let payload;
        try {
          payload = JSON.parse(body.toString('utf8'));
        } catch {
          return reply(response, 400);
        }
        const config = { instance: evolution.instance, recipients };
        for (const item of readInbound(payload, config)) {
          const result = await rpc('whatsapp_ingest', {
            p_phone_id: evolution.channelKey, p_from: item.from, p_name: item.name, p_message_id: item.id,
            p_content: item.content, p_received_at: item.receivedAt,
          });
          log(JSON.stringify({ event: 'whatsapp_inbound', provider: 'evolution', id: item.id.slice(-8), result }));
        }
        for (const item of readStatuses(payload, config)) {
          if (await rpc('whatsapp_finish', { p_job: null, p_delivery: item.delivery, p_outbound_id: item.id })) {
            log(JSON.stringify({ event: 'whatsapp_delivery', provider: 'evolution', id: item.id.slice(-8), result: item.delivery }));
          }
        }
        log(JSON.stringify({ event: 'evolution_webhook_processed', status: 200 }));
        return reply(response, 200);
      } catch {
        log(JSON.stringify({ event: 'evolution_webhook_retry', status: 503 }));
        return reply(response, 503);
      }
    }
    if (!whatsappEnabled || url.pathname !== endpoint) return reply(response, 404);

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
  const provider = process.env.WHATSAPP_PROVIDER ?? 'meta';
  if (!['meta', 'evolution'].includes(provider)) throw new Error('WHATSAPP_PROVIDER must be meta or evolution');
  const config = {
    provider,
    channelEnabled: process.env.WHATSAPP_ENABLED !== 'false',
    whatsappEnabled: process.env.WHATSAPP_ENABLED !== 'false' && provider === 'meta',
    evolutionUrl: process.env.EVOLUTION_API_URL?.replace(/\/$/, ''),
    evolutionKey: process.env.EVOLUTION_API_KEY,
    evolutionInstance: process.env.EVOLUTION_INSTANCE,
    evolutionSecret: process.env.EVOLUTION_WEBHOOK_SECRET,
    evolutionChannelKey: process.env.EVOLUTION_CHANNEL_KEY,
    apiKey: process.env.SUPABASE_PUBLISHABLE_KEY,
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
    authUrl: process.env.AI_AUTH_URL?.replace(/\/$/, ''),
  };
  if (config.claudeKey && (!/^claude-haiku-/.test(config.claudeModel ?? '') || !/^https?:\/\//.test(config.authUrl ?? ''))) {
    throw new Error('AI server configuration is incomplete');
  }
  if (config.channelEnabled && config.provider === 'meta' && (!/^v[0-9]+\.[0-9]+$/.test(config.graphVersion ?? '')
    || !/^[0-9]+$/.test(config.phoneNumberId ?? '') || !config.crmUrl || !config.crmToken || !config.accessToken
    || [...config.recipients].some(value => !phone.test(value)))) {
    throw new Error('WhatsApp worker configuration is incomplete');
  }
  if (config.channelEnabled && config.provider === 'evolution') {
    const problems = evolutionConfigProblems({ url: config.evolutionUrl, key: config.evolutionKey, instance: config.evolutionInstance,
      secret: config.evolutionSecret, channel: config.evolutionChannelKey });
    if (problems.length || !config.crmUrl || !config.crmToken || [...config.recipients].some(value => !phone.test(value))) {
      throw new Error('Evolution worker configuration is incomplete');
    }
  }
  const rpc = config.channelEnabled ? createRpc(config) : null;
  const ai = createAiHandler(config);
  const evolution = config.channelEnabled && config.provider === 'evolution' ? {
    secret: config.evolutionSecret, instance: config.evolutionInstance, channelKey: config.evolutionChannelKey,
  } : undefined;
  const server = createWebhook({ ...config, rpc, ai, evolution });
  const stop = new AbortController();
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => { stop.abort(); server.close(); });
  }
  server.listen(3000, '0.0.0.0');
  if (config.channelEnabled) await runWorker(rpc, config, stop.signal);
}
