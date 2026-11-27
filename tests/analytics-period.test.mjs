import assert from 'node:assert/strict';
import test from 'node:test';
import { analyticsPeriod, analyticsStart } from '../src/lib/analyticsPeriod.js';

test('Analytics mantém opções válidas e usa sete dias como padrão da URL', () => {
  assert.equal(analyticsPeriod('mes'), 'mes');
  assert.equal(analyticsPeriod('30d'), '30d');
  assert.equal(analyticsPeriod('7d'), '7d');
  assert.equal(analyticsPeriod(null), '7d');
  assert.equal(analyticsPeriod('1h'), '7d');
});

test('mês corrente vira à meia-noite de Brasília, inclusive na virada de ano', () => {
  assert.equal(analyticsStart('mes', Date.parse('2027-01-01T02:59:59Z')), '2026-12-01T03:00:00.000Z');
  assert.equal(analyticsStart('mes', Date.parse('2027-01-01T03:00:00Z')), '2027-01-01T03:00:00.000Z');
  assert.equal(analyticsStart('mes', Date.parse('2018-12-15T12:00:00Z')), '2018-12-01T02:00:00.000Z');
});

test('sete e trinta dias são janelas corridas até o instante da consulta', () => {
  const now = Date.parse('2026-11-27T14:30:00Z');
  assert.equal(analyticsStart('7d', now), '2026-11-20T14:30:00.000Z');
  assert.equal(analyticsStart('30d', now), '2026-10-28T14:30:00.000Z');
});
