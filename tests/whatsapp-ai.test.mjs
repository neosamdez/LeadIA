import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createWebhook } from '../deploy/whatsapp/webhook.mjs';
import { callClaude, createAiHandler, normalizeRequest } from '../deploy/whatsapp/ai.mjs';

const token = 'a'.repeat(40);
const authUrl = 'http://gateway.test/auth/v1';
const channel = { verifyToken: 'fake-verify', appSecret: 'fake-secret', phoneNumberId: '1234', recipients: new Set(['15550000101']), rpc: async () => null };

// GoTrue falso: token "a..." pertence ao usuário 1; qualquer outro é recusado.
function fakeAuth(calls = []) {
  return async (url, options) => {
    calls.push(['auth', url, options?.headers?.Authorization]);
    if (url === `${authUrl}/user` && options?.headers?.Authorization === `Bearer ${token}`) {
      return Response.json({ id: 'user-1' });
    }
    return new Response('nope', { status: 401 });
  };
}

// Anthropic falsa: devolve texto e registra o corpo enviado.
function fakeClaude(calls = [], { ok = true, text = 'Olá, posso ajudar.' } = {}) {
  return async (url, options) => {
    if (url === 'https://api.anthropic.com/v1/messages') {
      calls.push(['claude', JSON.parse(options.body), options.headers]);
      if (!ok) return new Response('boom', { status: 500 });
      return Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text }] });
    }
    return fakeAuth(calls)(url, options);
  };
}

async function start(t, ai) {
  const logs = [];
  const server = createWebhook({ ...channel, ai, log: line => logs.push(JSON.parse(line)) });
  t.after(() => new Promise(resolve => server.close(resolve)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { url: `http://127.0.0.1:${server.address().port}/ai/v1/complete`, logs };
}

const body = JSON.stringify({ system: 'Você configura um agente.', messages: [{ role: 'user', content: 'Quero vender apartamentos' }], maxTokens: 300 });
const authed = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

test('configuração de agente usa o esquema fixo e rejeita JSON truncado', async () => {
  const request = normalizeRequest({ ...JSON.parse(body), maxTokens: 3000, responseFormat: 'agent_config' });
  assert.equal(request.maxTokens, 3000);
  assert.equal(normalizeRequest({ ...JSON.parse(body), maxTokens: 3001, responseFormat: 'agent_config' }), null);
  assert.equal(normalizeRequest({ ...JSON.parse(body), maxTokens: 1201 }), null);
  assert.equal(normalizeRequest({ ...JSON.parse(body), responseFormat: { type: 'arbitrary' } }), null);
  const call = stopReason => callClaude(request, {
    claudeKey: 'test-key',
    claudeModel: 'claude-haiku-5-5',
    fetch: async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.max_tokens, 3000);
      assert.deepEqual(payload.thinking, { type: 'disabled' });
      assert.equal(payload.output_config.format.type, 'json_schema');
      assert.equal(payload.output_config.format.schema.additionalProperties, false);
      assert.ok(payload.output_config.format.schema.required.includes('purpose'));
      return Response.json({ stop_reason: stopReason, content: [{ type: 'text', text: '{"purpose":"Teste"}' }] });
    },
  });
  assert.equal(await call('end_turn'), '{"purpose":"Teste"}');
  await assert.rejects(call('max_tokens'), /anthropic_agent_config_truncated/);
});

test('sem chave da Anthropic o endpoint responde 503 e nada é chamado', async t => {
  const calls = [];
  const ai = createAiHandler({ authUrl, claudeKey: undefined, claudeModel: 'claude-haiku-5-5', fetch: fakeClaude(calls) });
  const { url } = await start(t, ai);
  const response = await fetch(url, { method: 'POST', headers: authed, body });
  assert.equal(response.status, 503);
  assert.equal(calls.length, 0);
});

test('sem token válido responde 401 antes de qualquer chamada ao modelo', async t => {
  const calls = [];
  const ai = createAiHandler({ authUrl, claudeKey: 'k', claudeModel: 'claude-haiku-5-5', fetch: fakeClaude(calls) });
  const { url } = await start(t, ai);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })).status, 401);
  assert.equal((await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + 'b'.repeat(40) }, body })).status, 401);
  assert.equal(calls.some(([kind]) => kind === 'claude'), false);
});

test('aceita só POST e responde o texto gerado com chave só no servidor', async t => {
  const calls = [];
  const ai = createAiHandler({ authUrl, claudeKey: 'sk-server-only', claudeModel: 'claude-haiku-5-5', fetch: fakeClaude(calls) });
  const { url } = await start(t, ai);
  assert.equal((await fetch(url, { headers: authed })).status, 405);

  const response = await fetch(url, { method: 'POST', headers: authed, body });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { text: 'Olá, posso ajudar.' });

  const claude = calls.find(([kind]) => kind === 'claude');
  assert.equal(claude[1].model, 'claude-haiku-5-5');
  assert.equal(claude[1].max_tokens, 300);
  assert.equal(claude[1].system, 'Você configura um agente.');
  assert.equal('temperature' in claude[1], false);
  assert.equal(claude[2]['x-api-key'], 'sk-server-only');
});

test('corpo inválido, JSON quebrado e corpo grande são recusados', async t => {
  const ai = createAiHandler({ authUrl, claudeKey: 'k', claudeModel: 'claude-haiku-5-5', fetch: fakeClaude() });
  const { url } = await start(t, ai);
  assert.equal((await fetch(url, { method: 'POST', headers: authed, body: '{nao-json' })).status, 400);
  assert.equal((await fetch(url, { method: 'POST', headers: authed, body: JSON.stringify({ messages: [{ role: 'system', content: 'x' }] }) })).status, 400);
  assert.equal((await fetch(url, { method: 'POST', headers: authed, body: JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(70000) }] }) })).status, 413);
});

test('falha da Anthropic vira 502 sem vazar detalhe', async t => {
  const logs = [];
  const ai = createAiHandler({ authUrl, claudeKey: 'k', claudeModel: 'claude-haiku-5-5', fetch: fakeClaude([], { ok: false }), log: line => logs.push(line) });
  const { url } = await start(t, ai);
  const response = await fetch(url, { method: 'POST', headers: authed, body });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'ai_unavailable' });
  assert.ok(logs.some(line => line.includes('anthropic_500')));
});

test('limite de 20 chamadas por minuto por usuário', async t => {
  const ai = createAiHandler({ authUrl, claudeKey: 'k', claudeModel: 'claude-haiku-5-5', fetch: fakeClaude() });
  const { url } = await start(t, ai);
  for (let i = 0; i < 20; i++) assert.equal((await fetch(url, { method: 'POST', headers: authed, body })).status, 200);
  assert.equal((await fetch(url, { method: 'POST', headers: authed, body })).status, 429);
});

test('normalizeRequest limita campos, remove vazias e fecha a conversa com usuário', () => {
  assert.equal(normalizeRequest(null), null);
  assert.equal(normalizeRequest({ messages: [] }), null);
  assert.equal(normalizeRequest({ messages: [{ role: 'user', content: 'oi' }], maxTokens: 5000 }), null);
  assert.equal(normalizeRequest({ system: 'x'.repeat(4001), messages: [{ role: 'user', content: 'oi' }] }), null);

  const cleaned = normalizeRequest({ messages: [{ role: 'assistant', content: 'Oi' }, { role: 'user', content: '  ' }, { role: 'assistant', content: 'Tudo bem?' }] });
  assert.deepEqual(cleaned.messages, [{ role: 'user', content: 'Gere a próxima mensagem.' }]);
  assert.equal(cleaned.maxTokens, 300);
});
