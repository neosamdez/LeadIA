const endpoint = '/ai/v1/complete';

function unavailable(status) {
  return Response.json({ error: 'ai_unavailable' }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'POST' } });
  }

  let target;
  try {
    target = new URL(endpoint, env.LEADIA_AI_ORIGIN);
    if (target.protocol !== 'https:') return unavailable(503);
  } catch {
    return unavailable(503);
  }

  const headers = new Headers();
  for (const name of ['Authorization', 'Content-Type']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  return fetch(target, {
    method: 'POST',
    headers,
    body: request.body,
    redirect: 'error',
  }).catch(() => unavailable(502));
}
