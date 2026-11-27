import assert from 'node:assert/strict';
import test from 'node:test';
import { OBJECTIVES, applyBehavior, buildFromObjective, parseAgentJson, sanitizeBehavior, agentPrompt } from '../src/lib/agentPresets.js';
import { ACTIONS, ROUTE_ACTIONS, normalizeAgent, simulate } from '../src/lib/agentSim.js';

test('todo objetivo gera uma configuração válida e utilizável pelo simulador', () => {
  for (const id of Object.keys(OBJECTIVES)) {
    const behavior = buildFromObjective(id);
    assert.ok(behavior.purpose.length > 20, id);
    assert.ok(behavior.qualificationQuestions.length >= 2, id);
    assert.ok(behavior.allowedActions.every(a => a in ACTIONS), id);
    assert.ok(behavior.routingRules.every(r => r.action in ROUTE_ACTIONS), id);
    const config = applyBehavior({}, behavior);
    const result = simulate({ config, context: {}, message: 'quero falar com um atendente', at: new Date('2026-11-25T14:00:00Z') });
    assert.ok(result && typeof result === 'object', id);
  }
});

test('o modelo do objetivo usa descrição e contexto do negócio', () => {
  const b = buildFromObjective('agenda', {
    description: 'clínica odontológica em Teresina.',
    context: { serviceRestrictions: 'convênios\nurgências', businessHours: 'seg a sex, 8h às 18h' },
  });
  assert.match(b.purpose, /clínica odontológica em Teresina\.$/);
  assert.ok(b.excludedTopics.includes('convênios') && b.excludedTopics.includes('urgências'));
  assert.match(b.afterHoursMessage, /seg a sex, 8h às 18h/);
});

test('aplicar comportamento preserva horário e avançado do cliente', () => {
  const current = normalizeAgent({ hours: { days: ['6'], start: '09:00', end: '12:00' }, advanced: { model: 'preciso', timeoutSeconds: 40, maxMessagesPerHour: 10 } });
  const next = applyBehavior(current, { ...buildFromObjective('vendas'), hours: { days: ['0'] }, advanced: { model: 'x' } });
  assert.deepEqual(next.hours, current.hours);
  assert.deepEqual(next.advanced, current.advanced);
  assert.match(next.purpose, /ofertas autorizadas/);
});

test('JSON da IA é extraído de cercas e saneado', () => {
  const text = 'Claro!\n```json\n{"purpose":"Atender leads","tone":"direto","qualificationQuestions":["Nome?",""],'
    + '"routingRules":[{"when":"humano","action":"handoff"},{"when":"","action":"reply"},{"when":"x","action":"apagar_banco"}],'
    + '"allowedActions":["reply","delete_all"],"hours":{"days":["0"]},"extra":"ignorar"}\n```';
  const b = parseAgentJson(text);
  assert.deepEqual(b.qualificationQuestions, ['Nome?']);
  assert.deepEqual(b.routingRules, [{ when: 'humano', action: 'handoff', reply: '' }, { when: 'x', action: 'reply', reply: '' }]);
  assert.deepEqual(b.allowedActions, ['reply']);
  assert.equal(b.hours, undefined);
  assert.equal(b.extra, undefined);
});

test('respostas sem JSON ou sem objetivo são recusadas', () => {
  assert.throws(() => parseAgentJson('não sei'), /JSON/);
  assert.throws(() => parseAgentJson('{"purpose": }'), /inválido/);
  assert.throws(() => parseAgentJson('{"tone":"x"}'), /objetivo/);
});

test('saneamento limita tamanhos', () => {
  const b = sanitizeBehavior({ purpose: 'a'.repeat(999), qualificationQuestions: Array(20).fill('q') });
  assert.equal(b.purpose.length, 300);
  assert.equal(b.qualificationQuestions.length, 8);
});

test('prompt inclui só os fatos preenchidos do contexto', () => {
  const [system, user] = agentPrompt('leads', 'imobiliária', { offers: 'Apto 2q R$ 300 mil', audience: '' });
  assert.match(system.content, /SOMENTE com um objeto JSON/);
  assert.match(user.content, /Ofertas autorizadas: Apto 2q/);
  assert.doesNotMatch(user.content, /Público/);
});
