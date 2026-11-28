import { followUpDueDate, followUpPeriod } from './followUpDates.js';

const PERIOD_RANK = { overdue: 0, today: 1, upcoming: 2, unscheduled: 3 };
const CLOSED = ['Convertido', 'Perdido'];

// Ordena os retornos abertos pelo que vence primeiro: atrasados, hoje, próximos e, por último, sem prazo.
export function buildTodayQueue({ followUps = [], leads = [], members = [], now = new Date(), ownerId = null }) {
  const leadById = new Map(leads.map(lead => [lead.id, lead]));
  const memberById = new Map(members.map(member => [member.id, member]));
  return followUps
    .filter(task => !task.done && task.status !== 'canceled' && task.status !== 'done')
    .map(task => {
      const due = followUpDueDate(task);
      const lead = leadById.get(task.leadId) || null;
      const owner = lead?.ownerId ? memberById.get(lead.ownerId) || { id: lead.ownerId, name: 'Responsável indisponível' } : null;
      return { ...task, due, period: followUpPeriod(due, now), lead, owner };
    })
    .filter(task => !ownerId || task.lead?.ownerId === ownerId)
    .sort((left, right) => PERIOD_RANK[left.period] - PERIOD_RANK[right.period]
      || (left.due?.getTime() ?? Infinity) - (right.due?.getTime() ?? Infinity)
      || String(left.createdAt).localeCompare(String(right.createdAt)));
}

// Motivo legível para a próxima ação, derivado só do prazo e da nota gravados.
export function queueReason(task, now = new Date()) {
  if (task.period === 'overdue') {
    const days = Math.floor((startOfDay(now) - startOfDay(task.due)) / 86400000);
    return days <= 0 ? 'Prazo venceu hoje e o retorno segue aberto.' : `Atrasado há ${days} ${days === 1 ? 'dia' : 'dias'}.`;
  }
  if (task.period === 'today') return 'Vence hoje.';
  if (task.period === 'upcoming') return 'Próximo retorno agendado.';
  return 'Retorno aberto sem prazo definido.';
}

// Progresso do dia: retornos com prazo hoje, concluídos sobre o total. Atrasados ficam fora da razão.
export function todayProgress({ followUps = [], leads = [], now = new Date(), ownerId = null }) {
  const leadById = new Map(leads.map(lead => [lead.id, lead]));
  const dueToday = followUps.filter(task => {
    if (task.status === 'canceled') return false;
    if (ownerId && leadById.get(task.leadId)?.ownerId !== ownerId) return false;
    const due = followUpDueDate(task);
    return Boolean(due) && due.toDateString() === now.toDateString();
  });
  const done = dueToday.filter(task => task.done || task.status === 'done').length;
  return { done, total: dueToday.length };
}

// Leads em aberto sem nenhum retorno pendente: candidatos para agendar o próximo passo.
export function leadsWithoutFollowUp({ followUps = [], leads = [], ownerId = null, limit = 5 }) {
  const withOpen = new Set(followUps.filter(task => !task.done && (task.status || 'open') === 'open').map(task => task.leadId));
  return leads
    .filter(lead => !CLOSED.includes(lead.status) && !withOpen.has(lead.id))
    .filter(lead => !ownerId || lead.ownerId === ownerId)
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, limit);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}
