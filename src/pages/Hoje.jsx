import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, Clock, MessageSquare, Sun, Target, UserRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatFollowUpDate } from '../lib/followUpDates';
import { PRIORITIES, missingContext } from '../lib/orgContext';
import { buildTodayQueue, leadsWithoutFollowUp, queueReason, todayProgress } from '../lib/todayQueue';
import './Hoje.css';

const QUEUE_SIZE = 4;
const PERIOD_BADGE = { overdue: ['red', 'Atrasado'], today: ['blue', 'Vence hoje'], upcoming: ['', 'Próximo'], unscheduled: ['', 'Sem prazo'] };

export default function Hoje() {
  const { user, leads, followUps, members = [], settings, completeFollowUp, addFollowUp, pendingWrites } = useApp();
  const real = user?.mode === 'real';
  const viewer = members.some(member => member.id === user?.id && member.role === 'viewer');
  const [scope, setScope] = useState('all');
  const [now, setNow] = useState(() => new Date());
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const ownerId = real && scope === 'mine' ? user?.id : null;
  const queue = useMemo(() => buildTodayQueue({ followUps, leads, members, now, ownerId }), [followUps, leads, members, now, ownerId]);
  const progress = useMemo(() => todayProgress({ followUps, leads, now, ownerId }), [followUps, leads, now, ownerId]);
  const unscheduled = useMemo(() => leadsWithoutFollowUp({ followUps, leads, ownerId }), [followUps, leads, ownerId]);
  const [next, ...rest] = queue;
  const overdue = queue.filter(task => task.period === 'overdue').length;
  const busy = Boolean(pendingWrites);
  const context = settings?.context;
  const priority = PRIORITIES[context?.priority];
  const priorityValue = priority ? priority.measure({ followUps, leads, members, now, ownerId }) : null;
  const contextGaps = missingContext(context);

  async function complete(task) {
    setFeedback('');
    const result = await completeFollowUp(task.id);
    // No modo real, null indica que a gravação falhou e o aviso de sincronização já explica o motivo.
    if (real && result === null) return;
    setFeedback(`Retorno concluído: ${task.title}.`);
  }

  async function schedule(lead) {
    setFeedback('');
    const result = await addFollowUp({ leadId: lead.id, title: `Retorno: ${lead.name}`, note: 'Agendado pela tela Hoje', when: 'Hoje' });
    if (real && result === null) return;
    setFeedback(`Retorno agendado para hoje: ${lead.name}.`);
  }

  return (
    <div className="hoje">
      <div className="page-head">
        <div>
          <h1>Hoje</h1>
          <p>O próximo retorno a fazer, com prazo e responsável. A fila vem dos follow-ups gravados no CRM.</p>
        </div>
        {real && members.length > 0 && (
          <div className="hoje-scope" role="group" aria-label="Retornos exibidos">
            <button type="button" className={'btn btn-sm ' + (scope === 'all' ? 'btn-primary' : 'btn-outline')} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Toda a equipe</button>
            <button type="button" className={'btn btn-sm ' + (scope === 'mine' ? 'btn-primary' : 'btn-outline')} aria-pressed={scope === 'mine'} onClick={() => setScope('mine')}>Atribuídos a mim</button>
          </div>
        )}
      </div>

      {context && (priority ? (
        <section className="card hoje-priority" aria-labelledby="hoje-priority-title">
          <Target size={20} aria-hidden="true" />
          <div>
            <h2 id="hoje-priority-title">Prioridade do mês: {priority.label}</h2>
            <p>{priority.metric}{ownerId ? ' atribuídos a você' : ''}: <strong>{priorityValue}</strong>. {priority.help}</p>
            {contextGaps.length > 0 && <p>Contexto incompleto: {contextGaps.join(', ')}. <Link to="/app/configuracoes#contexto">Completar</Link></p>}
          </div>
        </section>
      ) : (
        <section className="card hoje-priority" aria-labelledby="hoje-priority-title">
          <Target size={20} aria-hidden="true" />
          <div>
            <h2 id="hoje-priority-title">Defina a prioridade do mês</h2>
            <p>Escolha um objetivo medido pelo CRM e registre o contexto do negócio. <Link to="/app/configuracoes#contexto">Abrir contexto</Link></p>
          </div>
        </section>
      ))}

      <section className="card hoje-progress" aria-labelledby="hoje-progress-title">
        <div>
          <h2 id="hoje-progress-title">Progresso do dia</h2>
          <p>{progress.total === 0
            ? 'Nenhum retorno com prazo para hoje.'
            : `${progress.done} de ${progress.total} retornos com prazo hoje concluídos.`}
            {overdue > 0 && ` ${overdue} ${overdue === 1 ? 'atrasado' : 'atrasados'} de dias anteriores.`}</p>
        </div>
        <div className="hoje-bar" role="progressbar" aria-label="Retornos de hoje concluídos" aria-valuemin={0} aria-valuemax={progress.total || 1} aria-valuenow={progress.done}>
          <span style={{ width: progress.total ? `${Math.round(progress.done / progress.total * 100)}%` : '0%' }} />
        </div>
      </section>

      <p className="hoje-feedback" role="status" aria-live="polite">{feedback}</p>

      {next ? (
        <section className="card hoje-next" aria-labelledby="hoje-next-title">
          <div className="hoje-eyebrow"><Sun size={16} /> Próxima ação</div>
          <h2 id="hoje-next-title">{next.title}</h2>
          <p className="hoje-reason">{queueReason(next, now)}{next.note ? ` ${next.note}` : ''}</p>
          <dl className="hoje-facts">
            <div><dt><Clock size={14} /> Prazo</dt><dd>{next.due ? formatFollowUpDate(next.due) : 'Sem prazo'}</dd></div>
            <div><dt><UserRound size={14} /> Responsável</dt><dd>{next.owner?.name || 'Sem responsável'}</dd></div>
            <div><dt><MessageSquare size={14} /> Lead</dt><dd>{next.lead ? `${next.lead.name} · ${next.lead.status}` : 'Lead removido'}</dd></div>
          </dl>
          <div className="hoje-actions">
            {next.lead && <Link className="btn btn-outline" to={`/app/conversas/${next.lead.id}`}>Abrir conversa</Link>}
            <button type="button" className="btn btn-primary" disabled={busy || viewer} onClick={() => complete(next)}>
              <CheckCircle2 size={16} /> Concluir retorno
            </button>
          </div>
          {viewer && <p className="hoje-note">Seu acesso é de leitura. Peça a um membro da equipe para concluir.</p>}
        </section>
      ) : (
        <section className="card hoje-empty">
          <CheckCircle2 size={20} color="#15803D" />
          <div>
            <h2>Nenhum retorno pendente{ownerId ? ' atribuído a você' : ''}.</h2>
            <p>Agende o próximo passo de um lead abaixo ou em Conversas.</p>
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="card hoje-list" aria-labelledby="hoje-queue-title">
          <h2 id="hoje-queue-title">Depois</h2>
          <ol>
            {rest.slice(0, QUEUE_SIZE).map(task => {
              const [tone, label] = PERIOD_BADGE[task.period];
              return (
                <li key={task.id}>
                  <div className="hoje-item">
                    <strong>{task.title}</strong>
                    <span>{[task.due ? formatFollowUpDate(task.due) : 'Sem prazo', task.owner?.name || 'Sem responsável', task.lead?.name].filter(Boolean).join(' · ')}</span>
                  </div>
                  <span className={'badge ' + tone}>{label}</span>
                  {task.lead && <Link className="btn btn-sm btn-ghost" to={`/app/conversas/${task.lead.id}`} aria-label={`Abrir conversa de ${task.lead.name}`}>Abrir</Link>}
                </li>
              );
            })}
          </ol>
          {rest.length > QUEUE_SIZE && <Link className="hoje-more" to="/app/alertas">Ver todos os {queue.length} retornos em Alertas</Link>}
        </section>
      )}

      {unscheduled.length > 0 && (
        <section className="card hoje-list" aria-labelledby="hoje-unscheduled-title">
          <h2 id="hoje-unscheduled-title">Leads sem próximo passo</h2>
          <p className="hoje-note">Leads em aberto sem retorno pendente, por pontuação.</p>
          <ul>
            {unscheduled.map(lead => (
              <li key={lead.id}>
                <div className="hoje-item">
                  <strong>{lead.name}</strong>
                  <span>{[lead.status, lead.interest, lead.channel].filter(Boolean).join(' · ')}</span>
                </div>
                <button type="button" className="btn btn-sm btn-outline" disabled={busy || viewer} onClick={() => schedule(lead)}>
                  <CalendarPlus size={14} /> Agendar para hoje
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
