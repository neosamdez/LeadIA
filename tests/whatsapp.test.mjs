import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { test } from 'node:test';
import { createWebhook } from '../deploy/whatsapp/webhook.mjs';
import { decide, workOnce } from '../deploy/whatsapp/worker.mjs';

const job = { id: '00000000-0000-4000-8000-000000000004', lease_id: 'lease', content: 'Oi, tenho interesse', recipient: '15550000101' };
const channel = { verifyToken: 'fake-verify', appSecret: 'fake-secret', phoneNumberId: '1234', recipients: new Set([job.recipient]) };

test('webhook confirma desafio, exige HMAC do corpo bruto e filtra número e contato', async t => {
  const calls = [];
  let rejectWrite = true;
  const server = createWebhook({ ...channel, log() {}, rpc: async (name, args) => {
    calls.push([name, args]);
    if (rejectWrite) throw new Error('database unavailable');
    return 'stored';
  } });
  t.after(() => new Promise(resolve => server.close(resolve)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port + '/webhooks/whatsapp';
  const verified = await fetch(url + '?hub.mode=subscribe&hub.verify_token=fake-verify&hub.challenge=123');
  assert.equal(await verified.text(), '123');
  assert.equal((await fetch(url + '?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=123')).status, 403);

  const message = { type: 'text', id: 'wamid.inbound', from: job.recipient,
    text: { body: 'Oi, tenho interesse' }, timestamp: String(Math.floor(Date.now() / 1000)) };
  const change = (id, messages) => ({ field: 'messages', value: { metadata: { phone_number_id: id }, messages } });
  const payload = { object: 'whatsapp_business_account', entry: [{ changes: [
    change('wrong', [message]), change(channel.phoneNumberId, [{ ...message, from: '15550000102' }, message]),
  ] }] };
  const body = JSON.stringify(payload, null, 2);
  const signature = 'sha256=' + createHmac('sha256', channel.appSecret).update(body).digest('hex');
  const send = (value, token) => fetch(url, { method: 'POST', body: value, headers: { 'X-Hub-Signature-256': token } });
  assert.equal((await send(JSON.stringify(payload), signature)).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await send(body, signature)).status, 503);
  rejectWrite = false;
  assert.equal((await send(body, signature)).status, 200);
  assert.deepEqual(calls.map(([name, args]) => [name, args.p_from, args.p_message_id]), [
    ['whatsapp_ingest', job.recipient, 'wamid.inbound'], ['whatsapp_ingest', job.recipient, 'wamid.inbound'],
  ]);
});

test('o worker grava a decisão antes de enviar e registra resultado incerto sem repetir envio', async () => {
  const calls = [];
  let available = true;
  const rpc = async (name, body) => {
    calls.push([name, body]);
    if (name === 'whatsapp_claim') {
      if (!available) return [];
      available = false;
      return [job];
    }
    return true;
  };
  const config = {
    phoneNumberId: channel.phoneNumberId, graphVersion: 'v27.0', accessToken: 'fake-token',
    fetch: async (url, { body }) => {
      calls.push(['send', JSON.parse(body)]);
      assert.equal(new URL(url).host, 'graph.facebook.com');
      throw new Error('network timeout');
    },
  };
  assert.equal(await workOnce(rpc, config, () => {}), true);
  assert.equal(await workOnce(rpc, config, () => {}), false);
  assert.deepEqual(calls.map(([name]) => name), ['whatsapp_claim', 'whatsapp_prepare', 'send', 'whatsapp_finish', 'whatsapp_claim']);
  assert.equal(calls[2][1].biz_opaque_callback_data, job.id);
  assert.equal(calls[3][1].p_delivery, 'uncertain');
});

test('Claude pode acrescentar qualificação e o backend preserva limites e fallback', async () => {
  const config = { claudeKey: 'fake', claudeModel: 'claude-haiku-test' };
  const message = 'Preciso viajar até sexta, para três pessoas';
  const suggestion = { intent: 'qualify', reply: 'Vou registrar seu prazo e o tamanho do grupo.', need: 'Viagem para três pessoas', deadline: 'sexta', next_action: 'revisar' };
  const model = async () => Response.json({ content: [{ type: 'text', text: JSON.stringify(suggestion) }] });
  const result = await decide(message, { ...config, fetch: model });
  assert.equal(result.source, 'claude');
  assert.equal(result.intent, 'qualify');
  assert.match(result.need, /três pessoas · sexta/);
  const fall = await decide('Está caro, pode me chamar amanhã?', { ...config, fetch: async () => new Response('', { status: 429 }) });
  assert.equal(fall.source, 'claude_fallback');
  assert.equal(fall.intent, 'follow_up');
  assert.equal((await decide('Quero falar com uma pessoa', { ...config, fetch: model })).intent, 'human');
});
