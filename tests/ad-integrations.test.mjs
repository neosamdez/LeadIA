import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUtmUrl, parseExternalId, trackingChecklist } from '../src/lib/adIntegrations.js';

test('identificadores são normalizados como o banco espera', () => {
  assert.deepEqual(parseExternalId('meta_ads', '1234567890'), { ok: true, value: 'act_1234567890' });
  assert.deepEqual(parseExternalId('google_ads', '123 456 7890'), { ok: true, value: '123-456-7890' });
  assert.deepEqual(parseExternalId('ga4', 'g-abc1234xyz'), { ok: true, value: 'G-ABC1234XYZ' });
  assert.equal(parseExternalId('ga4', 'UA-1234-1').ok, false);
  assert.equal(parseExternalId('gtm', 'GTM-1').ok, false);
  assert.equal(parseExternalId('linkedin', '1').ok, false);
});

test('UTMs saem padronizados e exigem origem e campanha', () => {
  const r = buildUtmUrl({ url: 'https://loja.com/oferta?x=1', source: 'Meta', medium: 'cpc', campaign: 'Black Friday São Paulo', content: 'Vídeo 1' });
  assert.equal(r.url, 'https://loja.com/oferta?x=1&utm_source=meta&utm_medium=cpc&utm_campaign=black_friday_sao_paulo&utm_content=video_1');
  assert.equal(buildUtmUrl({ url: 'loja.com', source: 'a', campaign: 'b' }).ok, false);
  assert.equal(buildUtmUrl({ url: 'https://loja.com', source: 'meta' }).ok, false);
  assert.equal(buildUtmUrl({ url: 'javascript:alert(1)', source: 'a', campaign: 'b' }).ok, false);
});

test('checklist ignora integrações desligadas', () => {
  const list = trackingChecklist([
    { provider: 'meta_ads', status: 'aguardando_credenciais' },
    { provider: 'meta_pixel', status: 'desconectado' },
    { provider: 'gtm', status: 'conectado' },
  ]);
  const done = Object.fromEntries(list.map(i => [i.id, i.done]));
  assert.equal(done['meta-pair'], false);
  assert.equal(done.gtm, true);
  assert.equal(done.live, true);
});
