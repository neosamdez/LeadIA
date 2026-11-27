import { buildTodayQueue, leadsWithoutFollowUp } from './todayQueue.js';

export const EMPTY_CONTEXT = {
  valueProposition: '', audience: '', offers: '', language: 'pt-BR', timezone: 'America/Sao_Paulo',
  businessHours: '', serviceRestrictions: '', handoffOwnerId: '', priority: '',
  updatedAt: '', updatedBy: '',
};

export const LANGUAGES = [['pt-BR', 'Português (Brasil)'], ['en', 'Inglês'], ['es', 'Espanhol']];
export const TIMEZONES = [
  ['America/Sao_Paulo', 'Brasília (SP, RJ, MG, Sul, GO, DF)'], ['America/Fortaleza', 'Fortaleza (NE sem BA)'],
  ['America/Bahia', 'Salvador'], ['America/Recife', 'Recife'], ['America/Belem', 'Belém'],
  ['America/Manaus', 'Manaus'], ['America/Cuiaba', 'Cuiabá'], ['America/Campo_Grande', 'Campo Grande'],
  ['America/Porto_Velho', 'Porto Velho'], ['America/Boa_Vista', 'Boa Vista'], ['America/Rio_Branco', 'Rio Branco'],
  ['America/Noronha', 'Fernando de Noronha'],
];

// Cada prioridade aponta para uma métrica que o CRM já calcula com registros verificáveis.
export const PRIORITIES = {
  clear_overdue_followups: {
    label: 'Zerar retornos atrasados',
    metric: 'Retornos em atraso',
    help: 'Follow-ups abertos com prazo anterior a agora.',
    measure: data => buildTodayQueue(data).filter(task => task.period === 'overdue').length,
  },
  follow_up_new_leads: {
    label: 'Todo lead em aberto com próximo passo',
    metric: 'Leads em aberto sem retorno pendente',
    help: 'Leads fora de Convertido e Perdido sem follow-up aberto.',
    measure: data => leadsWithoutFollowUp({ ...data, limit: Infinity }).length,
  },
};

const FIELDS = {
  valueProposition: 'value_proposition', audience: 'audience', offers: 'offers', language: 'language',
  timezone: 'timezone', businessHours: 'business_hours', serviceRestrictions: 'service_restrictions',
  handoffOwnerId: 'handoff_owner_id', priority: 'priority',
};

// Colunas da migração 003 ausentes indicam banco ainda não migrado.
export function dbContextToApp(row) {
  if (!row || !('priority' in row)) return null;
  const context = { ...EMPTY_CONTEXT };
  for (const [key, column] of Object.entries(FIELDS)) context[key] = row[column] ?? EMPTY_CONTEXT[key];
  context.updatedAt = row.context_updated_at || '';
  context.updatedBy = row.context_updated_by || '';
  return context;
}

export function appContextToDb(context) {
  const patch = {};
  for (const [key, column] of Object.entries(FIELDS)) {
    if (!(key in context)) continue;
    const value = typeof context[key] === 'string' ? context[key].trim() : context[key];
    patch[column] = value === '' && !['language', 'timezone'].includes(key) ? null : value;
  }
  return patch;
}

// Campos mínimos para o contexto orientar atendimento e rotina.
export function missingContext(context) {
  if (!context) return [];
  const required = [['valueProposition', 'proposta de valor'], ['audience', 'público'], ['offers', 'ofertas autorizadas'],
    ['businessHours', 'horário de atendimento'], ['priority', 'prioridade do mês']];
  return required.filter(([key]) => !String(context[key] || '').trim()).map(([, label]) => label);
}
