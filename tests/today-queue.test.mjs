import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTodayQueue, leadsWithoutFollowUp, queueReason, todayProgress } from '../src/lib/todayQueue.js';

const now = new Date(2026, 10, 27, 15, 0);
const at = (day, hour = 18) => new Date(2026, 10, day, hour, 0).toISOString();
const leads = [
  { id: 'a', name: 'Ana', status: 'Novo', score: 40, ownerId: 'u1' },
  { id: 'b', name: 'Bruno', status: 'Proposta', score: 90, ownerId: 'u2' },
  { id: 'c', name: 'Carla', status: 'Convertido', score: 99, ownerId: 'u1' },
  { id: 'd', name: 'Davi', status: 'Qualificado', score: 70, ownerId: null },
];
const members = [{ id: 'u1', name: 'Leo', role: 'owner' }, { id: 'u2', name: 'Bia', role: 'member' }];
const followUps = [
  { id: 'f-up', leadId: 'a', title: 'Amanhã', dueAt: at(28), status: 'open', done: false, createdAt: at(26) },
  { id: 'f-today', leadId: 'a', title: 'Hoje', dueAt: at(27), status: 'open', done: false, createdAt: at(26) },
  { id: 'f-late', leadId: 'b', title: 'Atrasado', dueAt: at(25), status: 'open', done: false, createdAt: at(24) },
  { id: 'f-none', leadId: 'b', title: 'Sem prazo', status: 'open', done: false, createdAt: at(20) },
  { id: 'f-done', leadId: 'a', title: 'Feito', dueAt: at(27, 10), status: 'done', done: true, createdAt: at(26) },
  { id: 'f-cancel', leadId: 'a', title: 'Cancelado', dueAt: at(27), status: 'canceled', done: false, createdAt: at(26) },
];

test('fila põe atrasados primeiro, depois hoje, próximos e sem prazo; ignora concluídos e cancelados', () => {
  const queue = buildTodayQueue({ followUps, leads, members, now });
  assert.deepEqual(queue.map(task => task.id), ['f-late', 'f-today', 'f-up', 'f-none']);
  assert.equal(queue[0].owner.name, 'Bia');
  assert.equal(queue[0].lead.name, 'Bruno');
});

test('filtro por responsável usa o dono do lead', () => {
  const queue = buildTodayQueue({ followUps, leads, members, now, ownerId: 'u1' });
  assert.deepEqual(queue.map(task => task.id), ['f-today', 'f-up']);
});

test('motivo informa dias de atraso a partir do prazo gravado', () => {
  const [late] = buildTodayQueue({ followUps, leads, members, now });
  assert.equal(queueReason(late, now), 'Atrasado há 2 dias.');
  assert.equal(queueReason({ period: 'today' }, now), 'Vence hoje.');
});

test('progresso conta só prazos de hoje e exclui cancelados', () => {
  assert.deepEqual(todayProgress({ followUps, leads, now }), { done: 1, total: 2 });
  assert.deepEqual(todayProgress({ followUps, leads, now, ownerId: 'u2' }), { done: 0, total: 0 });
});

test('sugere leads em aberto sem retorno pendente, por pontuação', () => {
  assert.deepEqual(leadsWithoutFollowUp({ followUps, leads }).map(lead => lead.id), ['d']);
  const onlyDone = followUps.filter(task => task.done);
  assert.deepEqual(leadsWithoutFollowUp({ followUps: onlyDone, leads }).map(lead => lead.id), ['b', 'd', 'a']);
});

test('contexto: mapeia colunas, detecta banco sem migração e mede a prioridade', async () => {
  const { PRIORITIES, appContextToDb, dbContextToApp, missingContext } = await import('../src/lib/orgContext.js');
  assert.equal(dbContextToApp({ company_name: 'X' }), null);
  const context = dbContextToApp({ priority: 'clear_overdue_followups', audience: 'PMEs', timezone: 'America/Fortaleza', language: 'pt-BR', context_updated_by: 'u1' });
  assert.equal(context.audience, 'PMEs');
  assert.equal(context.updatedBy, 'u1');
  assert.deepEqual(missingContext(context), ['proposta de valor', 'ofertas autorizadas', 'horário de atendimento']);
  assert.deepEqual(appContextToDb({ audience: '  ', handoffOwnerId: '', timezone: 'America/Recife' }), { audience: null, handoff_owner_id: null, timezone: 'America/Recife' });
  assert.equal(PRIORITIES.clear_overdue_followups.measure({ followUps, leads, members, now }), 1);
  assert.equal(PRIORITIES.follow_up_new_leads.measure({ followUps, leads, members, now }), 1);
});
