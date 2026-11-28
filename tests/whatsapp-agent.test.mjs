import test from 'node:test';
import assert from 'node:assert/strict';
import { workAgentOnce } from '../deploy/whatsapp/agent-worker.mjs';
import { proxy } from '../functions/whatsapp/v1/_proxy.js';

const job = {
  id: 'job-00000001', lease_id: 'lease-1', provider: 'evolution', evolution_instance: 'leadia-test',
  recipient: '5586990000000', received_at: '2026-11-23T15:00:00Z', sent_last_hour: 0,
  content: 'Quero conhecer o serviço', history: [{ sender: 'client', content: 'Olá' }],
  config: { purpose: 'Atender a Oficina Azul', allowedActions: ['reply', 'handoff'], tone: 'acolhedor' },
  context: { company_name: 'Oficina Azul', timezone: 'America/Sao_Paulo' },
};

test('gera pela revisão publicada, consulta a autorização final e registra envio Evolution', async () => {
  const steps = [];
  const rpc = async (name, args) => {
    steps.push(name);
    if (name === 'whatsapp_claim_agent') return job;
    if (name === 'whatsapp_prepare_agent') assert.equal(args.p_reply, 'Olá, aqui é a Oficina Azul!');
    if (name === 'whatsapp_finish_agent') assert.equal(args.p_outbound_id, 'evolution:leadia-test:OUT-1');
    return true;
  };
  await workAgentOnce(rpc, { claudeKey: 'server-key', claudeModel: 'claude-haiku-test',
    evolutionApiUrl: 'https://evolution.test', evolutionApiKey: 'server-key',
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      if (url.includes('anthropic.com')) {
        steps.push('claude');
        assert.match(body.system, /Atender a Oficina Azul/);
        assert.deepEqual(JSON.parse(body.messages[0].content).historico, job.history);
        return Response.json({ content: [{ type: 'text', text: 'Olá, aqui é a Oficina Azul!' }] });
      }
      steps.push('evolution');
      assert.equal(body.number, job.recipient);
      assert.equal(body.text, 'Olá, aqui é a Oficina Azul!');
      return Response.json({ key: { id: 'OUT-1' } });
    } }, () => {});
  assert.deepEqual(steps, ['whatsapp_claim_agent', 'claude', 'whatsapp_prepare_agent', 'evolution', 'whatsapp_finish_agent']);
});

test('regra publicada é determinística e bloqueio antes do envio cancela a resposta', async () => {
  const steps = [];
  const rpc = async (name, args) => {
    steps.push(name);
    if (name === 'whatsapp_claim_agent') return { ...job,
      config: { ...job.config, routingRules: [{ when: 'serviço', action: 'reply', reply: 'Aqui está o catálogo.' }] } };
    assert.equal(args.p_reply, 'Aqui está o catálogo.');
    return false;
  };
  await workAgentOnce(rpc, { fetch: async () => assert.fail('Não deveria consultar Claude nem Evolution') });
  assert.deepEqual(steps, ['whatsapp_claim_agent', 'whatsapp_prepare_agent']);
});

test('proxy Cloudflare preserva o orgId na consulta de status', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.href, 'https://render.test/whatsapp/v1/status?orgId=test-org');
    assert.equal(init.headers.get('Authorization'), 'Bearer test');
    return Response.json({ connected: true });
  });
  const request = new Request('https://pages.test/whatsapp/v1/status?orgId=test-org', { headers: { Authorization: 'Bearer test' } });
  assert.equal((await proxy('status', { request, env: { LEADIA_AI_ORIGIN: 'https://render.test' } })).status, 200);
});
