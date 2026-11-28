import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createRpc, runWorker } from './worker.mjs';
import { createAiHandler } from './ai.mjs';
import { createWhatsappHandler } from './whatsapp-connect.mjs';
import { runAgentWorker } from './agent-worker.mjs';

const endpoint = '/webhooks/whatsapp';
const evolutionEndpoint = '/webhooks/evolution';
const aiEndpoint = '/ai/v1/complete';
const whatsappApiEndpoint = '/whatsapp/v1/';
const maxBodyBytes = 1024 * 1024;
const phone = /^[1-9][0-9]{6,14}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deliveries = new Set(['sent', 'delivered', 'read', 'failed']);
const mediaTypes = {
  audioMessage: 'áudio', imageMessage: 'imagem', videoMessage: 'vídeo', documentMessage: 'documento',
  stickerMessage: 'figurinha', contactMessage: 'contato', contactsArrayMessage: 'contatos', locationMessage: 'localização',
};

function evolutionContent(message) {
  const actual = message?.ephemeralMessage?.message ?? message?.documentWithCaptionMessage?.message ?? message;
  const text = actual?.conversation ?? actual?.extendedTextMessage?.text
    ?? actual?.imageMessage?.caption ?? actual?.videoMessage?.caption ?? actual?.documentMessage?.caption;
  if (typeof text === 'string' && text.trim()) return text;
  const media = Object.entries(mediaTypes).find(([type]) => actual?.[type])?.[1];
  return media ? `[Mensagem recebida por ${media}. Conteúdo indisponível em texto.]` : null;
}

function matches(expected, supplied) {
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied ?? '');
  return left.length === right.length && timingSafeEqual(left, right);
}

function reply(response, status, body = '') {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(body);
}

export function createWebhook({ verifyToken, appSecret, phoneNumberId, recipients, rpc, ai, whatsappEnabled = true,
  evolutionEnabled = false, evolutionWebhookToken, whatsappConnect, evolutionRpc = rpc, log = console.log }) {
  if (whatsappEnabled && (!verifyToken || !appSecret || !phoneNumberId || !recipients?.size || !rpc)) {
    throw new Error('WhatsApp test configuration is incomplete');
  }
  if (evolutionEnabled && !rpc && !evolutionRpc) {
    throw new Error('Evolution webhook configuration is incomplete');
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
    if (url.pathname.startsWith(whatsappApiEndpoint)) {
      return whatsappConnect ? whatsappConnect(request, response) : reply(response, 404);
    }
    if (evolutionEnabled && url.pathname === evolutionEndpoint) {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return reply(response, 405);
      }
      const legacyAuth = Boolean(evolutionWebhookToken)
        && matches('Bearer ' + evolutionWebhookToken, request.headers.authorization);
      const webhookToken = /^Bearer (.{32,128})$/.exec(request.headers.authorization ?? '')?.[1];
      if (!legacyAuth && !webhookToken) {
        log(JSON.stringify({ event: 'evolution_webhook_rejected', reason: 'invalid_auth', status: 403 }));
        return reply(response, 403);
      }
      try {
        let size = 0;
        const chunks = [];
        for await (const chunk of request.iterator({ destroyOnReturn: false })) {
          size += chunk.length;
          if (size > maxBodyBytes) return reply(response, 413);
          chunks.push(chunk);
        }
        let payload;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          return reply(response, 400);
        }
        const event = String(payload?.event ?? '').toUpperCase().replace(/[.-]/g, '_');
        const instance = payload?.instance;
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(instance ?? '')) return reply(response, 400);

        if (event === 'MESSAGES_UPSERT') {
          const data = payload?.data;
          const key = data?.key;
          const remoteJid = typeof key?.remoteJid === 'string' && key.remoteJid.endsWith('@lid')
            ? key.remoteJidAlt : key?.remoteJid;
          const from = typeof remoteJid === 'string' && remoteJid.endsWith('@s.whatsapp.net')
            ? remoteJid.slice(0, -'@s.whatsapp.net'.length) : remoteJid;
          const content = legacyAuth ? data?.message?.conversation ?? data?.message?.extendedTextMessage?.text
            : evolutionContent(data?.message);
          const providerId = key?.id;
          const rawTimestamp = data?.messageTimestamp;
          const timestamp = Number(rawTimestamp);
          if (key?.fromMe === false && phone.test(from ?? '') && typeof providerId === 'string'
            && providerId.length > 0 && providerId.length <= 400 && typeof content === 'string'
            && content.trim() && content.length <= 10000 && Number.isFinite(timestamp) && timestamp > 0) {
            const name = typeof data.pushName === 'string' ? data.pushName.slice(0, 160) : null;
            const id = `evolution:${instance}:${providerId}`;
            const result = legacyAuth
              ? await rpc('whatsapp_ingest', { p_phone_id: instance, p_from: from, p_name: name,
                p_message_id: id, p_content: content.trim(), p_received_at: new Date(timestamp * 1000).toISOString() })
              : await evolutionRpc('whatsapp_ingest_evolution', { p_instance: instance, p_webhook_token: webhookToken,
                p_from: from, p_name: name, p_message_id: id, p_content: content.trim(),
                p_received_at: new Date(timestamp * 1000).toISOString() });
            log(JSON.stringify({ event: 'evolution_inbound', id: id.slice(-8), result }));
          }
        } else if (legacyAuth && event === 'MESSAGES_UPDATE') {
          const updates = Array.isArray(payload.data) ? payload.data : [payload.data];
          const states = new Map([['SERVER_ACK', 'sent'], ['DELIVERY_ACK', 'delivered'], ['READ', 'read'],
            ['PLAYED', 'read'], ['ERROR', 'failed'], ['1', 'sent'], ['2', 'delivered'], ['3', 'read'], ['4', 'read'], ['5', 'failed']]);
          for (const update of updates) {
            const providerId = update?.key?.id;
            const delivery = states.get(String(update?.update?.status ?? update?.status ?? '').toUpperCase());
            if (!delivery || typeof providerId !== 'string' || !providerId || providerId.length > 400) continue;
            const id = `evolution:${instance}:${providerId}`;
            await rpc('whatsapp_finish', { p_job: null, p_delivery: delivery, p_outbound_id: id });
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
  const config = {
    whatsappEnabled: process.env.WHATSAPP_ENABLED !== 'false',
    evolutionEnabled: process.env.WHATSAPP_EVOLUTION_ENABLED === 'true',
    evolutionApiUrl: process.env.EVOLUTION_API_URL?.replace(/\/$/, ''),
    evolutionApiKey: process.env.EVOLUTION_API_KEY,
    evolutionWebhookUrl: process.env.EVOLUTION_WEBHOOK_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    evolutionWebhookToken: process.env.EVOLUTION_WEBHOOK_TOKEN,
    apiKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    recipients: new Set((process.env.WHATSAPP_TEST_RECIPIENTS ?? '').split(',').map(value => value.trim()).filter(Boolean)),
    graphVersion: process.env.META_GRAPH_VERSION,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    crmUrl: (process.env.WHATSAPP_CRM_URL || process.env.AI_AUTH_URL?.replace(/\/auth\/v1\/?$/, ''))?.replace(/\/$/, ''),
    crmToken: process.env.WHATSAPP_CRM_TOKEN,
    claudeKey: process.env.ANTHROPIC_API_KEY,
    claudeModel: process.env.CLAUDE_MODEL,
    authUrl: process.env.AI_AUTH_URL?.replace(/\/$/, ''),
  };
  if (config.claudeKey && (!/^claude-haiku-/.test(config.claudeModel ?? '') || !/^https?:\/\//.test(config.authUrl ?? ''))) {
    throw new Error('AI server configuration is incomplete');
  }
  if (config.whatsappEnabled && (!/^v[0-9]+\.[0-9]+$/.test(config.graphVersion ?? '')
    || !/^[0-9]+$/.test(config.phoneNumberId ?? '') || !config.crmUrl || !config.crmToken || !config.accessToken
    || [...config.recipients].some(value => !phone.test(value)))) {
    throw new Error('WhatsApp worker configuration is incomplete');
  }
  let evolutionUrlAllowed = false;
  try {
    const evolutionUrl = new URL(config.evolutionApiUrl);
    evolutionUrlAllowed = evolutionUrl.protocol === 'https:'
      || (evolutionUrl.protocol === 'http:' && evolutionUrl.hostname === 'leadia-evolution-api');
  } catch {}
  const legacyEvolution = Boolean(config.evolutionWebhookToken && config.crmToken);
  if (config.evolutionEnabled && (!evolutionUrlAllowed || !config.evolutionApiKey
    || (!legacyEvolution && (!/^https:\/\//.test(config.evolutionWebhookUrl ?? '') || !config.serviceRoleKey)))) {
    throw new Error('Evolution API configuration is incomplete');
  }
  const workerEnabled = config.whatsappEnabled || (config.evolutionEnabled && Boolean(config.crmToken));
  const rpc = workerEnabled ? createRpc(config) : null;
  const evolutionRpc = config.evolutionEnabled && config.serviceRoleKey ? async (name, args) => {
    const response = await fetch(config.crmUrl + '/rest/v1/rpc/' + name, {
      method: 'POST', headers: { Authorization: `Bearer ${config.serviceRoleKey}`, apikey: config.serviceRoleKey,
        'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`database_${response.status}`);
    return response.json();
  } : null;
  const ai = createAiHandler(config);
  const managedEvolution = Boolean(evolutionRpc && config.evolutionWebhookUrl);
  const whatsappConnect = createWhatsappHandler({ ...config, evolutionEnabled: managedEvolution });
  const server = createWebhook({ ...config, rpc, evolutionRpc, ai, whatsappConnect });
  const stop = new AbortController();
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => { stop.abort(); server.close(); });
  }
  server.listen(3000, '0.0.0.0');
  await Promise.all([
    workerEnabled && runWorker(rpc, config, stop.signal),
    managedEvolution && config.claudeKey && runAgentWorker(evolutionRpc, config, stop.signal),
  ]);
}
