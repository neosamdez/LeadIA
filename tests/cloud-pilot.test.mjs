import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { onRequest } from '../functions/ai/v1/complete.js';
import { createAiHandler } from '../deploy/whatsapp/ai.mjs';
import { createWebhook } from '../deploy/whatsapp/webhook.mjs';
import { createRpc } from '../deploy/whatsapp/worker.mjs';

test('Pages encaminha a sessão ao Render sem cookies e preserva o status', async t => {
  const env = { LEADIA_AI_ORIGIN: 'https://render.example' };
  const request = new Request('https://pages.example/ai/v1/complete', {
    method: 'POST',
    headers: { Authorization: 'Bearer sessao', 'Content-Type': 'application/json', Cookie: 'private=1' },
    body: '{}',
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.href, 'https://render.example/ai/v1/complete');
    assert.equal(options.headers.get('Authorization'), 'Bearer sessao');
    assert.equal(options.headers.get('Cookie'), null);
    assert.equal(options.redirect, 'error');
    assert.equal(await new Response(options.body).text(), '{}');
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  });
  const response = await onRequest({ request, env });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'unauthorized' });
});

test('piloto valida a sessão no gateway gerenciado sem habilitar WhatsApp', async t => {
  const authUrl = 'https://db.example/auth/v1';
  const userToken = 'a'.repeat(40);
  const ai = createAiHandler({
    apiKey: 'sb_publishable_test', authUrl, claudeKey: 'test-key', claudeModel: 'claude-haiku-5-5',
    log: () => {},
    fetch: async (url, options) => {
      if (url === `${authUrl}/user`) {
        assert.equal(options.headers.apikey, 'sb_publishable_test');
        assert.equal(options.headers.Authorization, `Bearer ${userToken}`);
        return Response.json({ id: 'test-user' });
      }
      assert.equal(options.headers.apikey, undefined);
      return Response.json({ content: [{ type: 'text', text: 'Teste' }] });
    },
  });
  const server = createWebhook({ ai, whatsappEnabled: false });
  server.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${url}/healthz`)).status, 200);
  assert.equal((await fetch(`${url}/webhooks/whatsapp`)).status, 404);
  const response = await fetch(`${url}/ai/v1/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Teste' }] }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { text: 'Teste' });
});

test('RPC do WhatsApp envia a chave publicável junto do token restrito', async () => {
  const rpc = createRpc({
    crmUrl: 'https://db.example', crmToken: 'token-do-canal', apiKey: 'sb_publishable_test',
    fetch: async (url, options) => {
      assert.equal(url, 'https://db.example/rest/v1/rpc/whatsapp_claim');
      assert.equal(options.headers.apikey, 'sb_publishable_test');
      assert.equal(options.headers.authorization, 'Bearer token-do-canal');
      return Response.json([]);
    },
  });
  assert.deepEqual(await rpc('whatsapp_claim'), []);
});
