// Plataformas de anúncio e rastreamento. Os formatos espelham as checagens da migração 005.
export const PLATFORMS = [
  {
    id: 'meta', name: 'Meta', providers: [
      { id: 'meta_ads', label: 'Conta de anúncios', placeholder: 'act_1234567890', pattern: /^act_[0-9]{5,20}$/,
        help: 'Gerenciador de Anúncios > Configurações da conta. Use o prefixo act_.', normalize: v => /^[0-9]+$/.test(v) ? `act_${v}` : v },
      { id: 'meta_pixel', label: 'Pixel / Conversions API', placeholder: '123456789012345', pattern: /^[0-9]{10,20}$/,
        help: 'Gerenciador de Eventos > Fontes de dados. A Conversions API usa o mesmo ID.' },
    ],
  },
  {
    id: 'google', name: 'Google', providers: [
      { id: 'google_ads', label: 'Google Ads', placeholder: '123-456-7890', pattern: /^[0-9]{3}-[0-9]{3}-[0-9]{4}$/,
        help: 'ID do cliente no canto superior direito do Google Ads.',
        normalize: v => /^[0-9]{10}$/.test(v) ? `${v.slice(0, 3)}-${v.slice(3, 6)}-${v.slice(6)}` : v },
      { id: 'ga4', label: 'Google Analytics 4', placeholder: 'G-ABC1234XYZ', pattern: /^G-[A-Z0-9]{6,12}$/,
        help: 'Administrador > Fluxos de dados > ID da métrica.' },
      { id: 'gtm', label: 'Tag Manager', placeholder: 'GTM-AB12CD', pattern: /^GTM-[A-Z0-9]{5,10}$/,
        help: 'ID do contêiner na lista de contêineres do GTM.' },
    ],
  },
  {
    id: 'tiktok', name: 'TikTok', providers: [
      { id: 'tiktok_ads', label: 'Conta de anúncios', placeholder: '7012345678901234567', pattern: /^[0-9]{10,20}$/,
        help: 'TikTok Ads Manager > ID do anunciante.' },
      { id: 'tiktok_pixel', label: 'Pixel / Events API', placeholder: 'C1ABCDEFGHIJ2KLMNOPQ', pattern: /^[A-Z0-9]{15,25}$/,
        help: 'Ferramentas > Eventos > código do pixel.' },
    ],
  },
];

export const PROVIDERS = Object.fromEntries(PLATFORMS.flatMap(p => p.providers.map(x => [x.id, { ...x, platform: p.name }])));

export const STATUS = {
  aguardando_credenciais: { label: 'Aguardando credenciais', tone: 'yellow' },
  conectado: { label: 'Conectado', tone: 'green' },
  erro: { label: 'Erro', tone: 'red' },
  desconectado: { label: 'Desligado', tone: '' },
};

// Etapas do funil mapeadas para eventos de conversão padrão de cada plataforma.
export const FUNNEL_EVENTS = [
  { stage: 'Novo', meta: 'Lead', google: 'generate_lead', tiktok: 'SubmitForm' },
  { stage: 'Qualificado', meta: 'QualifiedLead', google: 'qualify_lead', tiktok: 'Contact' },
  { stage: 'Proposta', meta: 'InitiateCheckout', google: 'begin_checkout', tiktok: 'InitiateCheckout' },
  { stage: 'Convertido', meta: 'Purchase', google: 'purchase', tiktok: 'CompletePayment' },
];

export function parseExternalId(providerId, raw) {
  const provider = PROVIDERS[providerId];
  if (!provider) return { ok: false, error: 'Plataforma desconhecida.' };
  let value = String(raw || '').trim().replace(/\s+/g, '');
  if (providerId !== 'meta_ads') value = value.toUpperCase();
  if (provider.normalize) value = provider.normalize(value);
  return provider.pattern.test(value) ? { ok: true, value } : { ok: false, error: `Formato esperado: ${provider.placeholder}` };
}

// Itens de rastreamento que um gestor de tráfego confere antes de subir campanha.
export function trackingChecklist(integrations) {
  const has = id => integrations.some(i => i.provider === id && i.status !== 'desconectado');
  return [
    { id: 'meta-pair', label: 'Meta: conta de anúncios e Pixel cadastrados', done: has('meta_ads') && has('meta_pixel') },
    { id: 'google-pair', label: 'Google: Ads e GA4 cadastrados', done: has('google_ads') && has('ga4') },
    { id: 'gtm', label: 'Tag Manager no site', done: has('gtm') },
    { id: 'tiktok-pair', label: 'TikTok: conta e Pixel cadastrados', done: has('tiktok_ads') && has('tiktok_pixel') },
    { id: 'live', label: 'Ao menos uma plataforma conectada no servidor', done: integrations.some(i => i.status === 'conectado') },
  ];
}

const slug = v => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Monta URL com UTMs padronizados (minúsculas, sem acento, separador _).
export function buildUtmUrl({ url, source, medium, campaign, content, term }) {
  let target;
  try { target = new URL(String(url || '').trim()); } catch { return { ok: false, error: 'Informe uma URL completa, com https://' }; }
  if (!/^https?:$/.test(target.protocol)) return { ok: false, error: 'Use uma URL http ou https.' };
  const params = { utm_source: source, utm_medium: medium, utm_campaign: campaign, utm_content: content, utm_term: term };
  for (const [k, v] of Object.entries(params)) {
    const value = slug(v);
    if (value) target.searchParams.set(k, value); else target.searchParams.delete(k);
  }
  if (!target.searchParams.get('utm_source') || !target.searchParams.get('utm_campaign')) {
    return { ok: false, error: 'Origem e campanha são obrigatórias.' };
  }
  return { ok: true, url: target.toString() };
}
