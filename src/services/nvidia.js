import { agentPrompt, parseAgentJson } from '../lib/agentPresets.js';
import { supabase } from '../lib/supabase';

// A IA roda no servidor (deploy/whatsapp/ai.mjs, exposto pelo nginx). Nenhuma chave passa pelo navegador.
const AI_ENDPOINT = '/ai/v1/complete';

const AI_ERRORS = {
  401: 'Sessão expirada. Entre novamente para usar a IA.',
  429: 'Muitas solicitações de IA em pouco tempo. Aguarde um minuto.',
  503: 'A IA ainda não está configurada no servidor.',
};

/** IA disponível: há backend (Supabase) e a opção está ligada em Configurações. */
export function isNvidiaConfigured(settings) {
  return !!supabase && !!settings?.useNvidiaApi;
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

/** Envia o chat ao backend com o token da sessão. `system` vai separado, como o servidor espera. */
async function callAi(messages, signal, maxTokens = 220) {
  if (!supabase) throw new Error('IA indisponível no modo demonstração.');
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error(AI_ERRORS[401]);

  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const chat = messages.filter(m => m.role !== 'system').map(({ role, content }) => ({ role, content }));

  let res;
  try {
    res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ system, messages: chat, maxTokens }),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new Error('Não foi possível falar com a IA agora. Tente de novo em instantes.');
  }

  if (!res.ok) throw new Error(AI_ERRORS[res.status] || `Erro ao gerar com IA (${res.status}).`);

  const body = await res.json();
  const text = String(body?.text ?? '').trim();
  if (!text) throw new Error('A IA não devolveu texto.');
  return text;
}

export async function generateNvidiaReply({ lead, conversations, settings, signal, playbook }) {
  return callAi(toChatMessages(conversations, lead, settings, playbook), signal, 220);
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
  return callAi([{ role: 'system', content: system }, ...history], signal, 120);
}

// Gera a configuração do agente a partir do objetivo e do contexto do negócio.
// Devolve só campos de comportamento já validados; quem chama decide aplicar no rascunho.
export async function generateAgentConfig({ objective, description, context, settings, signal }) {
  const text = await callAi(agentPrompt(objective, description, context), signal, 900);
  return parseAgentJson(text);
}
