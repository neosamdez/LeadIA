const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export function getNvidiaApiKey(settings) {
  return (settings?.nvidiaApiKey || import.meta.env.VITE_NVIDIA_API_KEY || '').trim();
}

export function getNvidiaModel(settings) {
  return (settings?.nvidiaModel || import.meta.env.VITE_NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct').trim();
}

export function getNvidiaUrl(settings) {
  const proxy = (settings?.nvidiaProxyUrl || import.meta.env.VITE_NVIDIA_PROXY_URL || '').trim();
  return proxy || NVIDIA_URL;
}

export function isNvidiaConfigured(settings) {
  return !!getNvidiaApiKey(settings) && !!settings?.useNvidiaApi;
}

function buildSystemPrompt(lead, settings) {
  return [
    `Você é a LeadIA, assistente comercial de IA da empresa "${settings?.companyName || 'Empresa'}".`,
    `Segmento: ${settings?.segment || 'Vendas'}.`,
    `Tom de voz: ${settings?.tone || 'Profissional e amigável'}.`,
    `Objetivo: atender, qualificar, tirar dúvidas, tratar objeções e conduzir o cliente para o próximo passo comercial.`,
    `Regras: responda em português do Brasil, seja clara e objetiva, não invente preços/políticas não informadas, e quando necessário sugira handoff humano.`,
    `Contexto do lead: nome=${lead?.name || 'Cliente'}, canal=${lead?.channel || 'N/A'}, interesse=${lead?.interest || 'N/A'}, status=${lead?.status || 'N/A'}, valor estimado=R$ ${lead?.value ?? 'N/A'}.`,
    `Responda apenas com a mensagem para o cliente, sem aspas e sem prefixos como "LeadIA:".`,
  ].join(' ');
}

function toChatMessages(conversations, lead, settings) {
  const history = (conversations || []).slice(-12).map(m => ({
    role: m.from === 'client' ? 'user' : 'assistant',
    content: m.text,
  }));
  return [{ role: 'system', content: buildSystemPrompt(lead, settings) }, ...history];
}

export async function generateNvidiaReply({ lead, conversations, settings, signal }) {
  const apiKey = getNvidiaApiKey(settings);
  const model = getNvidiaModel(settings);
  if (!apiKey) throw new Error('Chave da API NVIDIA não configurada.');

  let res;
  try {
    res = await fetch(getNvidiaUrl(settings), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: toChatMessages(conversations, lead, settings),
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 220,
      }),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new Error('Falha de rede/CORS ao chamar NVIDIA API. Verifique a chave, modelo e conexão.');
  }

  if (!res.ok) {
    let detail = '';
    try { const err = await res.json(); detail = err?.detail || err?.error?.message || JSON.stringify(err); } catch {}
    throw new Error(`Erro NVIDIA (${res.status})${detail ? ': ' + detail : ''}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Resposta vazia da API NVIDIA.');
  return text;
}
