import { createHash } from 'node:crypto';

// Endpoint de IA do app: a chave da Anthropic fica aqui, no servidor, nunca no navegador.
// Só usuários autenticados (token do Supabase validado no GoTrue) e com limite por minuto.

const tokenPattern = /^[A-Za-z0-9._-]{20,4096}$/;
const maxBodyBytes = 64 * 1024;
const sessionTtlMs = 60_000;
const rateLimit = 20;
const rateWindowMs = 60_000;
const anthropicUrl = 'https://api.anthropic.com/v1/messages';
const stringField = { type: 'string' };
const agentConfigFields = {
  purpose: stringField,
  tone: stringField,
  qualificationQuestions: { type: 'array', items: stringField },
  excludedTopics: { type: 'array', items: stringField },
  routingRules: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        when: stringField,
        action: { type: 'string', enum: ['reply', 'handoff', 'qualify', 'decline'] },
        reply: stringField,
      },
      required: ['when', 'action', 'reply'],
      additionalProperties: false,
    },
  },
  allowedActions: {
    type: 'array',
    items: { type: 'string', enum: ['reply', 'qualify', 'create_followup', 'handoff'] },
  },
  fallback: stringField,
  afterHoursMessage: stringField,
};
const agentConfigFormat = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: agentConfigFields,
    required: Object.keys(agentConfigFields),
    additionalProperties: false,
  },
};

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

/** Valida o token no GoTrue e devolve o id do usuário, ou null. Resultado fica em cache por 60s. */
export async function verifyUser(token, { authUrl, apiKey, fetch: fetchImpl = fetch, cache = new Map(), now = Date.now }) {
  if (!tokenPattern.test(token ?? '')) return null;
  const key = createHash('sha256').update(token).digest('hex');
  const hit = cache.get(key);
  if (hit && hit.expires > now()) return hit.userId;

  let userId = null;
  try {
    const response = await fetchImpl(`${authUrl}/user`, {
      headers: { Authorization: `Bearer ${token}`, ...(apiKey && { apikey: apiKey }) },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const body = await response.json();
      if (typeof body?.id === 'string' && body.id) userId = body.id;
    }
  } catch {
    return null; // falha de rede não entra no cache
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { userId, expires: now() + sessionTtlMs });
  return userId;
}

/** Limite de chamadas por usuário em janela deslizante. */
export function createLimiter({ limit = rateLimit, windowMs = rateWindowMs, now = Date.now } = {}) {
  const hits = new Map();
  return function allow(userId) {
    const t = now();
    const recent = (hits.get(userId) ?? []).filter(at => t - at < windowMs);
    if (recent.length >= limit) {
      hits.set(userId, recent);
      return false;
    }
    recent.push(t);
    hits.set(userId, recent);
    if (hits.size > 1000) {
      for (const [id, times] of hits) {
        if (!times.some(at => t - at < windowMs)) hits.delete(id);
      }
    }
    return true;
  };
}

/** Aceita só o formato esperado pelo app: system + mensagens user/assistant + teto de tokens. */
export function normalizeRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const system = body.system ?? '';
  if (typeof system !== 'string' || system.length > 4000) return null;
  const maxTokens = body.maxTokens ?? 300;
  const responseFormat = body.responseFormat;
  if (responseFormat !== undefined && responseFormat !== 'agent_config') return null;
  const maxAllowedTokens = responseFormat === 'agent_config' ? 3000 : 1200;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > maxAllowedTokens) return null;
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 30) return null;

  const messages = [];
  let total = 0;
  for (const item of body.messages) {
    if (!item || (item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string') return null;
    const content = item.content.trim();
    if (content.length > 8000) return null;
    if (!content) continue;
    total += content.length;
    messages.push({ role: item.role, content });
  }
  if (total > 24000) return null;

  // A API exige que a conversa comece com usuário e termine com usuário (sem prefill).
  while (messages.length && messages[0].role === 'assistant') messages.shift();
  if (!messages.length || messages.at(-1).role !== 'user') {
    messages.push({ role: 'user', content: 'Gere a próxima mensagem.' });
  }
  return { system: system.trim(), maxTokens, messages, ...(responseFormat && { responseFormat }) };
}

/** Chama a Messages API da Anthropic. Sem temperature: o modelo Haiku 5.5 rejeita o campo. */
export async function callClaude({ system, maxTokens, messages, responseFormat }, { claudeKey, claudeModel, fetch: fetchImpl = fetch }) {
  const payload = { model: claudeModel, max_tokens: maxTokens, messages };
  if (system) payload.system = system;
  if (claudeModel === 'claude-haiku-5-5') payload.thinking = { type: 'disabled' };
  if (responseFormat === 'agent_config') payload.output_config = { format: agentConfigFormat };
  const response = await fetchImpl(anthropicUrl, {
    method: 'POST',
    headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`anthropic_${response.status}`);
  const data = await response.json();
  if (data?.stop_reason === 'refusal') throw new Error('anthropic_refusal');
  if (responseFormat === 'agent_config' && data?.stop_reason === 'max_tokens') {
    throw new Error('anthropic_agent_config_truncated');
  }
  const text = (Array.isArray(data?.content) ? data.content : [])
    .filter(block => block?.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('')
    .trim();
  if (!text) throw new Error('anthropic_empty');
  return text;
}

export function createAiHandler({ authUrl, apiKey, claudeKey, claudeModel, fetch: fetchImpl = fetch, log = console.log, now = Date.now }) {
  const cache = new Map();
  const allow = createLimiter({ now });

  return async function handleAi(request, response) {
    try {
      if (!claudeKey) return json(response, 503, { error: 'ai_not_configured' });
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return json(response, 405, { error: 'method_not_allowed' });
      }

      const match = /^Bearer (.+)$/.exec(request.headers.authorization ?? '');
      const userId = await verifyUser(match?.[1]?.trim(), { authUrl, apiKey, fetch: fetchImpl, cache, now });
      if (!userId) return json(response, 401, { error: 'unauthorized' });
      if (!allow(userId)) return json(response, 429, { error: 'rate_limited' });

      let size = 0;
      const chunks = [];
      for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        size += chunk.length;
        if (size > maxBodyBytes) return json(response, 413, { error: 'payload_too_large' });
        chunks.push(chunk);
      }

      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return json(response, 400, { error: 'invalid_json' });
      }
      const normalized = normalizeRequest(body);
      if (!normalized) return json(response, 400, { error: 'invalid_request' });

      try {
        const text = await callClaude(normalized, { claudeKey, claudeModel, fetch: fetchImpl });
        log(JSON.stringify({ event: 'ai_completion', status: 200 }));
        return json(response, 200, { text });
      } catch (err) {
        log(JSON.stringify({ event: 'ai_completion', status: 502, reason: String(err?.message ?? 'error').slice(0, 80) }));
        return json(response, 502, { error: 'ai_unavailable' });
      }
    } catch {
      return json(response, 500, { error: 'internal' });
    }
  };
}
