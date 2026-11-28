const path = '/whatsapp/v1/';

export function proxy(action, { request, env }) {
  if (!['status', 'connect', 'disconnect'].includes(action)) {
    return Response.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const method = action === 'status' ? 'GET' : 'POST';
  if (request.method !== method) {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: method } });
  }
  let target;
  try {
    target = new URL(`${path}${action}`, env.LEADIA_AI_ORIGIN);
    if (target.protocol !== 'https:') throw new Error('invalid origin');
  } catch {
    return Response.json({ error: 'whatsapp_not_configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const headers = new Headers();
  for (const name of ['Authorization', 'Content-Type']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return fetch(target, { method, headers, ...(method === 'POST' && { body: request.body }), redirect: 'manual' })
    .then(response => response.status >= 300 && response.status < 400
      ? Response.json({ error: 'whatsapp_unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
      : response)
    .catch(() => Response.json({ error: 'whatsapp_unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } }));
}
