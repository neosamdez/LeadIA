import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhatsappHandler } from '../deploy/whatsapp/whatsapp-connect.mjs';

const orgId = '00000000-0000-4000-8000-000000000021';
const token = 'a-valid-access-token-long-enough-for-validation';

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function invoke(handler, { method = 'GET', path = '/whatsapp/v1/status', authorization = `Bearer ${token}`, body } = {}) {
  const request = {
    method, url: `${path}${method === 'GET' ? `?orgId=${orgId}` : ''}`, headers: { authorization },
    async *iterator() { if (body) yield Buffer.from(JSON.stringify(body)); },
  };
  const output = { headers: {}, writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); },
    end(text) { this.body = text; } };
  return handler(request, output).then(() => ({ ...output, json: JSON.parse(output.body) }));
}

test('rota de status exige token válido antes de consultar o provedor', async () => {
  let providerCalls = 0;
  const handler = createWhatsappHandler({ authUrl: 'https://db.test/auth/v1', apiKey: 'public-key', evolutionEnabled: true,
    evolutionApiUrl: 'https://evolution.test', evolutionApiKey: 'secret', evolutionWebhookUrl: 'https://api.test/webhooks/evolution',
    fetch: async url => {
      if (String(url).endsWith('/user')) return response(401, {});
      providerCalls++;
      return response(200, {});
    } });
  const result = await invoke(handler, { authorization: 'Bearer invalid' });
  assert.equal(result.status, 401);
  assert.equal(providerCalls, 0);
});

test('conexão cria instância, registra webhook privado e entrega QR sem expor credenciais', async () => {
  const calls = [];
  const qr = 'A'.repeat(160);
  const handler = createWhatsappHandler({ authUrl: 'https://db.test/auth/v1', apiKey: 'public-key', evolutionEnabled: true,
    evolutionApiUrl: 'https://evolution.test', evolutionApiKey: 'evolution-secret', evolutionWebhookUrl: 'https://api.test/webhooks/evolution',
    fetch: async (input, init = {}) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith('/user')) return response(200, { id: 'user-1' });
      if (url.includes('/rest/v1/rpc/whatsapp_channel_get')) return response(200, { instance: 'leadia-test' });
      if (url.includes('/rest/v1/rpc/whatsapp_channel_ensure')) return response(200, { instance: 'leadia-test' });
      if (url.includes('/rest/v1/rpc/whatsapp_channel_set_webhook_secret')) return response(200, true);
      if (url.includes('/rest/v1/rpc/whatsapp_channel_set_connected')) return response(200, true);
      if (url.includes('/instance/connectionState/')) return response(404, {});
      if (url.endsWith('/instance/create')) return response(201, { qrcode: { base64: qr } });
      if (url.includes('/event/webhook/set/')) return response(200, {});
      return response(200, {});
    } });
  const result = await invoke(handler, { method: 'POST', path: '/whatsapp/v1/connect', body: { orgId } });
  assert.equal(result.status, 200);
  assert.match(result.json.qr, /^data:image\/png;base64,/);
  assert.equal(result.json.connected, false);
  const webhookCall = calls.find(call => call.url.includes('/event/webhook/set/'));
  assert.ok(webhookCall);
  assert.match(webhookCall.init.body, /Authorization/);
  assert.equal(JSON.stringify(result.json).includes('evolution-secret'), false);
  assert.equal(JSON.stringify(result.json).includes('Bearer '), false);
  assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('feature desligada responde 503 após autenticar o usuário', async () => {
  const handler = createWhatsappHandler({ authUrl: 'https://db.test/auth/v1', apiKey: 'public-key', evolutionEnabled: false,
    fetch: async () => response(200, { id: 'user-1' }) });
  const result = await invoke(handler);
  assert.equal(result.status, 503);
  assert.equal(result.json.error, 'whatsapp_not_configured');
});
