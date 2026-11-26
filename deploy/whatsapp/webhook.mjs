import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const endpoint = '/webhooks/whatsapp';
const maxBodyBytes = 1024 * 1024;

function matches(expected, supplied) {
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied ?? '');
  return left.length === right.length && timingSafeEqual(left, right);
}

function reply(response, status, body = '') {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(body);
}

export function createWebhook({ verifyToken, appSecret, phoneNumberId, onDelivery = console.log }) {
  if (!verifyToken || !appSecret || !phoneNumberId) {
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
          const messages = Array.isArray(value.messages) ? value.messages.length : 0;
          const statuses = Array.isArray(value.statuses) ? value.statuses.length : 0;
          onDelivery(JSON.stringify({ event: 'whatsapp_test_delivery', messages, statuses }));
        }
      }
      return reply(response, 200);
    } catch {
      return reply(response, 500);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createWebhook({
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  });
  server.listen(3000, '0.0.0.0');
}
