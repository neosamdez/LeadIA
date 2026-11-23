const ALLOWED = new Set(['/v1/chat/completions', '/v1/models']);

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const path = ALLOWED.has(url.pathname) ? url.pathname : '/v1/chat/completions';
    if (!['GET', 'POST'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: cors });

    const upstream = await fetch('https://integrate.api.nvidia.com' + path, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
      },
      body: request.method === 'POST' ? request.body : undefined,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
    });
  },
};
