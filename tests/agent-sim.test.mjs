import assert from 'node:assert/strict';
import test from 'node:test';
import { SCENARIOS, normalizeAgent, scenarioDate, simulate } from '../src/lib/agentSim.js';

const context = { offers: 'Plano mensal R$ 99; plano anual R$ 990.', businessHours: 'Seg a sex, 8h-18h', timezone: 'America/Sao_Paulo', serviceRestrictions: 'consignado' };
const config = {
  purpose: 'Sou o assistente da loja.',
  qualificationQuestions: ['Qual é o seu nome?', 'Para quando você precisa?'],
  excludedTopics: ['política'],
  routingRules: [{ when: 'cancelar, cancelamento', action: 'handoff' }, { when: 'endereço', action: 'reply', reply: 'Rua A, 10.' }],
};
const monday = scenarioDate('monday');

test('cenário cobre cada classificação esperada', () => {
  const expected = { oferta: 'oferta', qualificacao: 'qualificacao', fora_de_perfil: 'fora_de_perfil', fato_ausente: 'fato_ausente',
    fora_do_horario: 'fora_do_horario', handoff: 'handoff', instrucao_conflitante: 'instrucao_conflitante', modelo_indisponivel: 'handoff' };
  for (const s of SCENARIOS) {
    const result = simulate({ config, context: { ...context, ...s.context }, message: s.message,
      at: scenarioDate(s.at || 'monday'), modelAvailable: s.modelAvailable !== false });
    assert.equal(result.classification, expected[s.id], s.id);
  }
});

test('fato ausente lista o que falta e não inventa resposta', () => {
  const r = simulate({ config, context: { ...context, offers: '' }, message: 'quanto custa?', at: monday });
  assert.deepEqual(r.missingFacts, ['ofertas autorizadas']);
  assert.equal(r.reply, normalizeAgent(config).fallback);
});

test('regras de encaminhamento valem antes da resposta padrão', () => {
  assert.equal(simulate({ config, context, message: 'Quero cancelar', at: monday }).handoff, true);
  assert.equal(simulate({ config, context, message: 'Qual o endereço?', at: monday }).reply, 'Rua A, 10.');
});

test('sem permissão de handoff o agente usa a resposta de segurança', () => {
  const r = simulate({ config: { ...config, allowedActions: ['reply'] }, context, message: 'falar com atendente', at: monday });
  assert.equal(r.handoff, false);
  assert.equal(r.classification, 'fallback');
});

test('horário respeita o fuso do contexto', () => {
  const at = new Date(Date.UTC(2026, 10, 30, 21, 30)); // 18h30 em São Paulo, 17h30 em Manaus
  assert.equal(simulate({ config, context, message: 'oi', at }).classification, 'fora_do_horario');
  assert.notEqual(simulate({ config, context: { ...context, timezone: 'America/Manaus' }, message: 'oi', at }).classification, 'fora_do_horario');
});

test('normalização descarta lixo e mantém padrões', () => {
  const a = normalizeAgent({ allowedActions: ['reply', 'hack'], routingRules: [{ when: '' }, { when: 'x', action: 'zzz' }], qualificationQuestions: [' ', 'Nome?'] });
  assert.deepEqual(a.allowedActions, ['reply']);
  assert.deepEqual(a.routingRules, [{ when: 'x', action: 'reply', reply: '' }]);
  assert.deepEqual(a.qualificationQuestions, ['Nome?']);
  assert.equal(a.hours.start, '08:00');
});
