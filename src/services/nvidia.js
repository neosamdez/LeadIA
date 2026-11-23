const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export function getNvidiaApiKey(settings) {
  return (settings?.nvidiaApiKey || import.meta.env.VITE_NVIDIA_API_KEY || '').trim();
}

export function getNvidiaModel(settings) {
  return (settings?.nvidiaModel || import.meta.env.VITE_NVIDIA_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b').trim();
}

export function getNvidiaUrl(settings) {
  const proxy = (settings?.nvidiaProxyUrl || import.meta.env.VITE_NVIDIA_PROXY_URL || '').trim();
  return proxy || NVIDIA_URL;
}

export function isNvidiaConfigured(settings) {
  return !!getNvidiaApiKey(settings) && !!settings?.useNvidiaApi;
}

const PLAYBOOKS = {
  qualificar: 'Playbook QUALIFICAR: faça perguntas objetivas para entender necessidade, prazo, orçamento, decisor e encaixe. Termine com uma pergunta clara.',
  objeção: 'Playbook CONTORNAR OBJEÇÃO: reconheça a preocupação, traga valor/custo-benefício, ofereça alternativa (condição, parcelamento, bônus, escopo) sem inventar política. Termine com pergunta de avanço.',
  proposta: 'Playbook ENVIAR PROPOSTA: resuma o valor percebido, confirme o que entra na proposta, peça dados necessários e proponha envio/próximo passo comercial.',
  agendar: 'Playbook AGENDAR: proponha agendamento/ligação/demonstração, ofereça 2 opções e peça confirmação.',
  recuperar: 'Playbook RECUPERAR LEAD: seja leve e útil, retome contexto, ofereça novo motivo de contato e faça CTA simples.',
};

function buildSystemPrompt(lead, settings, playbook) {
  const extra = playbook && PLAYBOOKS[playbook] ? `\n${PLAYBOOKS[playbook]}` : '';
  return [
    `Você é a LeadIA, assistente comercial de IA da empresa "${settings?.companyName || 'Empresa'}".`,
    `Segmento: ${settings?.segment || 'Vendas'}.`,
    `Tom de voz: ${settings?.tone || 'Profissional e amigável'}.`,
    `Objetivo: atender, qualificar, tirar dúvidas, tratar objeções e conduzir o cliente para o próximo passo comercial.`,
    `Regras: responda em português do Brasil, seja clara e objetiva (máx. ~90 palavras), não invente preços/políticas não informadas, e quando necessário sugira handoff humano.`,
    `Contexto do lead: nome=${lead?.name || 'Cliente'}, canal=${lead?.channel || 'N/A'}, interesse=${lead?.interest || 'N/A'}, status=${lead?.status || 'N/A'}, valor estimado=R$ ${lead?.value ?? 'N/A'}.`,
    `Responda apenas com a mensagem para o cliente, sem aspas e sem prefixos como "LeadIA:".`,
    extra,
  ].join(' ');
}

function toChatMessages(conversations, lead, settings, playbook) {
  const history = (conversations || []).slice(-12).map(m => ({
    role: m.from === 'client' ? 'user' : 'assistant',
    content: m.text,
  }));
  const messages = [{ role: 'system', content: buildSystemPrompt(lead, settings, playbook) }, ...history];
  if (playbook && PLAYBOOKS[playbook]) {
    messages.push({ role: 'user', content: `Aplique o ${PLAYBOOKS[playbook].split(':')[0]} nesta conversa e gere a próxima mensagem para o cliente.` });
  }
  return messages;
}

async function callNvidia(messages, settings, signal, maxTokens = 220) {
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
        messages,
        temperature: 0.8,
        top_p: 0.95,
        max_tokens: maxTokens,
        chat_template_kwargs: { enable_thinking: false },
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
  return text.replace(/^["']|["']$/g, '').trim();
}

export async function generateNvidiaReply({ lead, conversations, settings, signal, playbook }) {
  return callNvidia(toChatMessages(conversations, lead, settings, playbook), settings, signal, 220);
}

export { PLAYBOOKS };

export async function generateNvidiaClientMessage({ lead, conversations, settings, signal, goal }) {
  const history = (conversations || []).slice(-10).map(m => ({
    role: m.from === 'client' ? 'assistant' : 'user',
    content: m.text,
  }));
  const system = [
    `Você está simulando um CLIENTE real em uma conversa de vendas por ${lead?.channel || 'WhatsApp'}.`,
    `Persona: ${lead?.name || 'Cliente'}, interessado em "${lead?.interest || 'produto/serviço'}".`,
    `Contexto: valor estimado R$ ${lead?.value ?? 'N/A'}, status atual ${lead?.status || 'Novo'}.`,
    `Objetivo desta mensagem: ${goal || 'responder naturalmente e avançar na negociação'}.`,
    `Regras: escreva em português do Brasil, tom natural de WhatsApp/Instagram (curto, humano, pode ter pequenas variações), sem ser robótico.`,
    `Não use prefixos como "Cliente:". Não faça papel de vendedor. Apenas a mensagem do cliente.`,
  ].join(' ');
  return callNvidia([{ role: 'system', content: system }, ...history], settings, signal, 120);
}
