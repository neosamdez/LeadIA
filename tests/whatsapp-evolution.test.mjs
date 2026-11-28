import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createWebhook } from '../deploy/whatsapp/webhook.mjs';
import { evolutionConfigProblems, readInbound, readStatuses, sendEvolutionText } from '../deploy/whatsapp/evolution.mjs';

const instance = 'ensaio-leadia';
const recipient = '15550000101';
const recipients = new Set([recipient]);
const secret = 's'.repeat(40);
const config = { instance, recipients };
const job = { id: '00000000-0000-4000-8000-000000000009', recipient, content: 'Oi' };

const upsert = (data, overrides = {}) => ({ event: 'messages.upsert', instance, ...overrides, data });
const inbound = (id = 'EVO-IN-1') => ({
  key: { remoteJid: `${recipient}@s.whatsapp.net`, fromMe: false, id },
  pushName: 'Contato de ensaio', message: { conversation: 'Oi, tenho interesse' }, messageTimestamp: 1732000000,
});

test('readInbound aceita mensagem de número autorizado e ignora o resto', () => {
  assert.equal(readInbound(upsert(inbound()), config)[0].content, 'Oi, tenho interesse');
  const extended = { ...inbound('EVO-IN-2'), message: { extendedTextMessage: { text: '  Quero uma cotação  ' } } };
  assert.equal(readInbound(upsert(extended), config)[0].content, 'Quero uma cotação');
  assert.equal(readInbound(upsert([inbound('EVO-IN-3')]), config).length, 1);

  assert.deepEqual(readInbound(upsert({ ...inbound(), key: { ...inbound().key, fromMe: true } }), config), []);
  assert.deepEqual(readInbound(upsert({ ...inbound(), key: { ...inbound().key, remoteJid: '5511999999999@s.whatsapp.net' } }), config), []);
  assert.deepEqual(readInbound(upsert({ ...inbound(), key: { ...inbound().key, remoteJid: '123@g.us' } }), config), []);
  assert.deepEqual(readInbound(upsert({ ...inbound(), message: { imageMessage: {} } }), config), []);
  assert.deepEqual(readInbound({ ...upsert(inbound()), instance: 'outra' }, config), []);
});

test('readStatuses converte o estado da Evolution para o vocabulário do CRM', () => {
  const update = status => ({ event: 'messages.update', instance, data: [{ key: { id: 'EVO-OUT-1', remoteJid: `${recipient}@s.whatsapp.net`, fromMe: true }, status }] });
  assert.deepEqual(readStatuses(update('SERVER_ACK'), config), [{ id: 'EVO-OUT-1', delivery: 'sent' }]);
  assert.deepEqual(readStatuses(update('DELIVERY_ACK'), config), [{ id: 'EVO-OUT-1', delivery: 'delivered' }]);
  assert.deepEqual(readStatuses(update('READ'), config), [{ id: 'EVO-OUT-1', delivery: 'read' }]);
  assert.deepEqual(readStatuses(update('ERROR'), config), [{ id: 'EVO-OUT-1', delivery: 'failed' }]);
  assert.deepEqual(readStatuses(update('PENDING'), config), []);
});

test('sendEvolutionText envia com apikey no header e classifica a resposta', async () => {
  const calls = [];
  const ok = async (url, options) => { calls.push({ url, options }); return Response.json({ key: { id: 'EVO-OUT-9' }, status: 'PENDING' }, { status: 201 }); };
  const opts = { evolutionUrl: 'https://evo.test', evolutionKey: 'k-server-only', evolutionInstance: instance, fetch: ok };
  assert.deepEqual(await sendEvolutionText(job, 'Olá', opts), { delivery: 'accepted', id: 'EVO-OUT-9' });
  assert.equal(calls[0].url, `https://evo.test/message/sendText/${instance}`);
  assert.equal(calls[0].options.headers.apikey, 'k-server-only');
  assert.deepEqual(JSON.parse(calls[0].options.body), { number: recipient, text: 'Olá' });

  assert.deepEqual(await sendEvolutionText(job, 'x', { ...opts, fetch: async () => new Response('no', { status: 400 }) }), { delivery: 'failed' });
  assert.deepEqual(await sendEvolutionText(job, 'x', { ...opts, fetch: async () => new Response('no', { status: 500 }) }), { delivery: 'uncertain' });
  assert.deepEqual(await sendEvolutionText(job, 'x', { ...opts, fetch: async () => { throw new Error('reset'); } }), { delivery: 'uncertain' });
});

test('evolutionConfigProblems aponta variáveis ausentes ou inválidas', () => {
  assert.deepEqual(evolutionConfigProblems({ url: 'https://evo.test', key: 'k', instance, secret, channel: '900001' }), []);
  assert.deepEqual(evolutionConfigProblems({ url: 'evo.test', key: '', instance: 'a b', secret: 'curto', channel: 'abc' }),
    ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE', 'EVOLUTION_WEBHOOK_SECRET', 'EVOLUTION_CHANNEL_KEY']);
});

test('webhook Evolution exige segredo, grava mensagem com a chave do canal e atualiza entrega', async t => {
  const calls = [];
  const logs = [];
  const rpc = async (name, args) => { calls.push([name, args]); return name === 'whatsapp_finish' ? true : 'stored'; };
  const server = createWebhook({ provider: 'evolution', whatsappEnabled: false, recipients, rpc, log: line => logs.push(JSON.parse(line)),
    evolution: { secret, instance, channelKey: '900001' } });
  t.after(() => new Promise(resolve => server.close(resolve)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port + '/webhooks/evolution';
  const body = JSON.stringify({ event: 'messages.upsert', instance, data: inbound('EVO-IN-7') });

  assert.equal((await fetch(url, { method: 'POST', body })).status, 403);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'x-leadia-webhook-secret': 'x'.repeat(40) }, body })).status, 403);
  assert.equal((await fetch(url, { headers: { 'x-leadia-webhook-secret': secret } })).status, 405);
  assert.equal(calls.length, 0);

  const accepted = await fetch(url, { method: 'POST', headers: { 'x-leadia-webhook-secret': secret }, body });
  assert.equal(accepted.status, 200);
  assert.equal(calls[0][0], 'whatsapp_ingest');
  assert.equal(calls[0][1].p_phone_id, '900001');
  assert.equal(calls[0][1].p_message_id, 'EVO-IN-7');

  const status = JSON.stringify({ event: 'messages.update', instance, data: [{ key: { id: 'EVO-OUT-3', remoteJid: `${recipient}@s.whatsapp.net`, fromMe: true }, status: 'READ' }] });
  assert.equal((await fetch(url, { method: 'POST', headers: { 'x-leadia-webhook-secret': secret }, body: status })).status, 200);
  assert.deepEqual(calls[1], ['whatsapp_finish', { p_job: null, p_delivery: 'read', p_outbound_id: 'EVO-OUT-3' }]);
  assert.ok(logs.every(line => !JSON.stringify(line).includes(secret)));
});
