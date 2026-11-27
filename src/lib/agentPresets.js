// Objetivos prontos para configurar o agente e validação do que a IA devolve.
// Só os campos de comportamento são trocados: horário, limites e avançado ficam como o cliente deixou.
import { ACTIONS, ROUTE_ACTIONS, normalizeAgent } from './agentSim.js';

export const BEHAVIOR_KEYS = ['purpose', 'tone', 'qualificationQuestions', 'excludedTopics', 'routingRules', 'allowedActions', 'fallback', 'afterHoursMessage'];

export const OBJECTIVES = {
  leads: {
    label: 'Gerar e qualificar leads',
    summary: 'Descobre necessidade, prazo e orçamento antes de passar para o vendedor.',
    when: 'Anúncios trazem muita gente e o time perde tempo com quem não está pronto.',
    config: {
      purpose: 'Atender quem chega pelos anúncios, entender a necessidade e separar quem está pronto para conversar com um vendedor.',
      tone: 'Cordial, objetivo, uma pergunta por vez',
      qualificationQuestions: ['Qual é o seu nome?', 'O que você está procurando?', 'Para quando você precisa?', 'Você já tem um orçamento em mente?'],
      excludedTopics: ['descontos não autorizados', 'prazos de entrega garantidos'],
      routingRules: [
        { when: 'falar com vendedor, atendente, humano, pessoa', action: 'handoff', reply: '' },
        { when: 'preço, valor, quanto custa, orçamento', action: 'qualify', reply: '' },
      ],
      allowedActions: ['reply', 'qualify', 'handoff'],
    },
  },
  agenda: {
    label: 'Agendar visitas e consultas',
    summary: 'Coleta o essencial e propõe horários; confirmação fica com a equipe.',
    when: 'O negócio vende por consulta, visita, avaliação ou demonstração.',
    config: {
      purpose: 'Marcar visitas e consultas com quem demonstra interesse, oferecendo horários e confirmando os dados de contato.',
      tone: 'Acolhedor e prático',
      qualificationQuestions: ['Qual é o seu nome?', 'Qual serviço você quer agendar?', 'Prefere manhã ou tarde?', 'Qual o melhor telefone para confirmar?'],
      excludedTopics: ['diagnósticos', 'orientações médicas ou jurídicas'],
      routingRules: [
        { when: 'remarcar, cancelar, desmarcar', action: 'handoff', reply: '' },
        { when: 'agendar, horário, marcar, disponibilidade, visita, consulta', action: 'qualify', reply: '' },
        { when: 'urgente, emergência', action: 'handoff', reply: '' },
      ],
      allowedActions: ['reply', 'qualify', 'create_followup', 'handoff'],
    },
  },
  vendas: {
    label: 'Vender produto ou serviço',
    summary: 'Apresenta as ofertas cadastradas, responde objeções e leva ao fechamento.',
    when: 'Ticket conhecido, ofertas definidas e o cliente decide na conversa.',
    config: {
      purpose: 'Apresentar as ofertas autorizadas, tirar dúvidas e conduzir o cliente até o pedido ou o pagamento com um vendedor.',
      tone: 'Confiante, claro, sem pressão',
      qualificationQuestions: ['Qual produto ou serviço te interessou?', 'É para você ou para a empresa?', 'Qual forma de pagamento prefere?'],
      excludedTopics: ['descontos fora da tabela', 'promessas de resultado'],
      routingRules: [
        { when: 'comprar, fechar, pagamento, pix, boleto, cartão', action: 'handoff', reply: '' },
        { when: 'caro, desconto, mais barato', action: 'reply', reply: 'Entendo. Posso te mostrar o que está incluído e as condições de pagamento disponíveis?' },
      ],
      allowedActions: ['reply', 'qualify', 'create_followup', 'handoff'],
    },
  },
  suporte: {
    label: 'Suporte pós-venda',
    summary: 'Responde dúvidas frequentes e encaminha reclamações para uma pessoa.',
    when: 'Clientes já compraram e escrevem com dúvidas de uso, troca ou entrega.',
    config: {
      purpose: 'Ajudar clientes que já compraram com dúvidas frequentes e encaminhar reclamações e trocas para a equipe.',
      tone: 'Paciente e empático',
      qualificationQuestions: ['Qual é o seu nome?', 'Qual o número do pedido ou contrato?', 'Pode descrever o que aconteceu?'],
      excludedTopics: ['reembolsos sem análise', 'mudanças de contrato'],
      routingRules: [
        { when: 'reclamação, procon, cancelar, reembolso, estorno', action: 'handoff', reply: '' },
        { when: 'troca, devolução, defeito', action: 'handoff', reply: '' },
      ],
      allowedActions: ['reply', 'qualify', 'handoff'],
    },
  },
  reativar: {
    label: 'Recuperar leads frios',
    summary: 'Retoma conversas paradas com uma pergunta curta e agenda retorno.',
    when: 'Há uma base de contatos que pararam de responder.',
    config: {
      purpose: 'Retomar conversas paradas, entender se o interesse continua e marcar um próximo passo quando fizer sentido.',
      tone: 'Leve, curto, sem insistência',
      qualificationQuestions: ['Ainda faz sentido conversarmos sobre isso?', 'O que mudou desde o nosso último contato?'],
      excludedTopics: ['cobranças'],
      routingRules: [
        { when: 'não tenho interesse, pare, não quero, sair', action: 'decline', reply: 'Tudo bem, não vou mais te incomodar. Se precisar, é só chamar.' },
        { when: 'sim, tenho interesse, quero, pode', action: 'qualify', reply: '' },
      ],
      allowedActions: ['reply', 'qualify', 'create_followup'],
    },
  },
};

const clip = (v, max) => String(v ?? '').trim().slice(0, max);

/** Mantém só os campos de comportamento, com tamanhos e valores permitidos. */
export function sanitizeBehavior(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const list = (v, n, max) => (Array.isArray(v) ? v : []).map(x => clip(x, max)).filter(Boolean).slice(0, n);
  const out = {};
  if (c.purpose) out.purpose = clip(c.purpose, 300);
  if (c.tone) out.tone = clip(c.tone, 120);
  if (Array.isArray(c.qualificationQuestions)) out.qualificationQuestions = list(c.qualificationQuestions, 8, 200);
  if (Array.isArray(c.excludedTopics)) out.excludedTopics = list(c.excludedTopics, 10, 120);
  if (Array.isArray(c.routingRules)) {
    out.routingRules = c.routingRules
      .filter(r => r && clip(r.when, 200))
      .slice(0, 8)
      .map(r => ({ when: clip(r.when, 200), action: r.action in ROUTE_ACTIONS ? r.action : 'reply', reply: clip(r.reply, 400) }));
  }
  if (Array.isArray(c.allowedActions)) {
    const actions = c.allowedActions.filter(a => a in ACTIONS);
    if (actions.length) out.allowedActions = [...new Set(actions)];
  }
  if (c.fallback) out.fallback = clip(c.fallback, 400);
  if (c.afterHoursMessage) out.afterHoursMessage = clip(c.afterHoursMessage, 400);
  return out;
}

/** Aplica um comportamento sobre a configuração atual, preservando horário e avançado. */
export function applyBehavior(current, behavior) {
  return normalizeAgent({ ...normalizeAgent(current), ...sanitizeBehavior(behavior) });
}

/** Gera a configuração sem modelo: modelo do objetivo + o que o cliente descreveu + contexto do negócio. */
export function buildFromObjective(objectiveId, { description = '', context = {} } = {}) {
  const objective = OBJECTIVES[objectiveId] || OBJECTIVES.leads;
  const base = structuredClone(objective.config);
  const detail = clip(description, 200).replace(/[.\s]+$/, '');
  if (detail) base.purpose = clip(`${base.purpose} Foco: ${detail}.`, 300);
  const restrictions = String(context.serviceRestrictions || '').split(/\n|;/).map(s => s.trim()).filter(Boolean);
  base.excludedTopics = [...new Set([...base.excludedTopics, ...restrictions])].slice(0, 10);
  if (String(context.businessHours || '').trim()) {
    base.afterHoursMessage = clip(`Recebemos sua mensagem. Nosso horário: ${context.businessHours.trim()}. Respondemos assim que abrirmos.`, 400);
  }
  return sanitizeBehavior(base);
}

/** Extrai o primeiro objeto JSON de uma resposta de modelo (aceita cercas ```json). */
export function parseAgentJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('A IA não devolveu uma configuração em JSON.');
  let parsed;
  try { parsed = JSON.parse(s.slice(start, end + 1)); } catch { throw new Error('A IA devolveu um JSON inválido.'); }
  const behavior = sanitizeBehavior(parsed);
  if (!behavior.purpose) throw new Error('A configuração gerada veio sem objetivo.');
  return behavior;
}

/** Instruções do modelo: só JSON, só os campos de comportamento, sem inventar fatos. */
export function agentPrompt(objectiveId, description, context = {}) {
  const objective = OBJECTIVES[objectiveId] || OBJECTIVES.leads;
  const facts = [
    ['Proposta de valor', context.valueProposition], ['Público', context.audience], ['Ofertas autorizadas', context.offers],
    ['Horário', context.businessHours], ['Restrições', context.serviceRestrictions],
  ].filter(([, v]) => String(v || '').trim()).map(([k, v]) => `${k}: ${String(v).trim().slice(0, 600)}`).join('\n');
  const system = [
    'Você configura um agente de atendimento comercial por WhatsApp em português do Brasil.',
    'Responda SOMENTE com um objeto JSON, sem comentários, com as chaves:',
    'purpose (string até 300), tone (string até 120), qualificationQuestions (array até 6 perguntas curtas),',
    'excludedTopics (array), routingRules (array de {when: termos separados por vírgula, action: um de ' + Object.keys(ROUTE_ACTIONS).join('|') + ', reply: texto ou vazio}),',
    'allowedActions (array com valores de ' + Object.keys(ACTIONS).join('|') + '), fallback (string), afterHoursMessage (string).',
    'Não invente preços, prazos ou promessas que não estejam no contexto. Use regras para pedidos de humano, reclamações e cancelamentos.',
  ].join('\n');
  const user = [
    `Objetivo: ${objective.label}. ${objective.summary}`,
    description ? `Descrição do cliente: ${String(description).slice(0, 800)}` : '',
    facts ? `Contexto do negócio:\n${facts}` : 'Contexto do negócio ainda não preenchido.',
  ].filter(Boolean).join('\n\n');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
