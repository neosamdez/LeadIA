import { randomBytes } from 'node:crypto';
import { verifyUser, createLimiter } from './ai.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const routes = new Set(['/whatsapp/v1/status', '/whatsapp/v1/connect', '/whatsapp/v1/disconnect']);

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

export function createWhatsappHandler({ authUrl, apiKey, evolutionEnabled, evolutionApiUrl, evolutionApiKey,
  evolutionWebhookUrl, fetch: fetchImpl = fetch, now = Date.now }) {
  const cache = new Map();
  const allow = createLimiter({ limit: 12, windowMs: 60_000, now });

  async function userRpc(token, name, args) {
    const response = await fetchImpl(`${authUrl.replace(/\/auth\/v1\/?$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) return { denied: true };
    if (!response.ok) throw new Error(`database_${response.status}`);
    return response.json();
  }

  async function evolution(path, options = {}) {
    const response = await fetchImpl(`${evolutionApiUrl.replace(/\/$/, '')}${path}`, {
      ...options,
      headers: { apikey: evolutionApiKey, 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: AbortSignal.timeout(12000),
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(`evolution_${response.status}`);
    return payload;
  }

  async function setWebhook(instanceName, secret) {
    return evolution(`/event/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: 'POST', body: JSON.stringify({ webhook: {
        enabled: true, url: evolutionWebhookUrl,
        headers: { Authorization: `Bearer ${secret}` },
        events: ['MESSAGES_UPSERT'], byEvents: false, base64: false,
      } }),
    });
  }

  return async function handle(request, response) {
    const url = new URL(request.url, 'http://localhost');
    if (!routes.has(url.pathname)) return json(response, 404, { error: 'not_found' });
    const method = url.pathname.endsWith('/status') ? 'GET' : 'POST';
    if (request.method !== method) {
      response.setHeader('Allow', method);
      return json(response, 405, { error: 'method_not_allowed' });
    }
    const token = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1]?.trim();
    const userId = await verifyUser(token, { authUrl, apiKey, fetch: fetchImpl, cache, now });
    if (!userId) return json(response, 401, { error: 'unauthorized' });
    if (!allow(userId)) return json(response, 429, { error: 'rate_limited' });
    if (!evolutionEnabled) return json(response, 503, { error: 'whatsapp_not_configured' });

    let orgId = url.searchParams.get('orgId');
    if (request.method === 'POST') {
      let size = 0;
      const chunks = [];
      for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        size += chunk.length;
        if (size > 4096) return json(response, 413, { error: 'payload_too_large' });
        chunks.push(chunk);
      }
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        orgId = body.orgId;
      } catch { return json(response, 400, { error: 'invalid_json' }); }
    }
    if (!uuid.test(orgId ?? '')) return json(response, 400, { error: 'invalid_org' });

    try {
      const channel = await userRpc(token, 'whatsapp_channel_get', { p_org_id: orgId });
      if (channel?.denied) return json(response, 403, { error: 'forbidden' });
      if (request.method === 'GET') {
        if (!channel?.instance) return json(response, 200, { configured: true, connected: false, state: 'close' });
        const state = await evolution(`/instance/connectionState/${encodeURIComponent(channel.instance)}`);
        const connectionState = state?.instance?.state ?? state?.state ?? 'close';
        const connected = connectionState === 'open';
        await userRpc(token, 'whatsapp_channel_set_connected', {
          p_org_id: orgId, p_connected: connected, p_state: connectionState,
        });
        return json(response, 200, { configured: true, connected, state: connectionState });
      }

      if (url.pathname.endsWith('/disconnect')) {
        if (channel?.instance) {
          try { await evolution(`/instance/logout/${encodeURIComponent(channel.instance)}`, { method: 'DELETE' }); }
          catch (error) { if (!String(error.message).includes('evolution_404')) throw error; }
        }
        await userRpc(token, 'whatsapp_channel_set_connected', {
          p_org_id: orgId, p_connected: false, p_state: 'disconnected',
        });
        return json(response, 200, { connected: false, state: 'close' });
      }

      const created = await userRpc(token, 'whatsapp_channel_ensure', { p_org_id: orgId });
      if (created?.denied || !created?.instance) return json(response, 403, { error: 'forbidden' });
      const instance = created.instance;
      const secret = randomBytes(32).toString('base64url');
      await userRpc(token, 'whatsapp_channel_set_webhook_secret', { p_org_id: orgId, p_secret: secret });
      let current;
      try { current = await evolution(`/instance/connectionState/${encodeURIComponent(instance)}`); } catch {}
      let state = current?.instance?.state ?? current?.state;
      let qr = null;
      if (!state) {
        const result = await evolution('/instance/create', {
          method: 'POST',
          body: JSON.stringify({ instanceName: instance, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
        });
        qr = result?.qrcode?.base64 ?? result?.base64 ?? null;
        state = result?.instance?.state ?? result?.state;
      }
      await setWebhook(instance, secret);
      if (state !== 'open' && !qr) {
        const result = await evolution(`/instance/connect/${encodeURIComponent(instance)}`);
        qr = result?.base64 ?? result?.qrcode?.base64 ?? null;
        state = result?.instance?.state ?? result?.state ?? state;
      }
      const connected = state === 'open';
      await userRpc(token, 'whatsapp_channel_set_connected', {
        p_org_id: orgId, p_connected: connected, p_state: connected ? 'open' : 'connecting',
      });
      const qrDataUrl = typeof qr === 'string' && /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(qr)
        ? qr
        : typeof qr === 'string' && /^[A-Za-z0-9+/=]{100,20000}$/.test(qr) ? `data:image/png;base64,${qr}` : null;
      if (!connected && !qrDataUrl) return json(response, 502, { error: 'qr_unavailable' });
      return json(response, 200, { connected, state: connected ? 'open' : 'connecting', qr: qrDataUrl });
    } catch {
      return json(response, 502, { error: 'whatsapp_provider_unavailable' });
    }
  };
}
