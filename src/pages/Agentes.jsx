import { useMemo, useState } from 'react';
import { History, Plus, RotateCcw, Save, Send, Trash2, FlaskConical } from 'lucide-react';
import { useApp } from '../context/AppContext';
import OrgContextForm from '../components/OrgContextForm';
import AgentWizard from '../components/AgentWizard';
import { applyBehavior } from '../lib/agentPresets';
import { ACTIONS, DAYS, ROUTE_ACTIONS, SCENARIOS, normalizeAgent, scenarioDate, simulate } from '../lib/agentSim';
import './Agentes.css';

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const CLASS_LABEL = {
  oferta: 'Oferta', qualificacao: 'Qualificação', fora_de_perfil: 'Fora de perfil', fato_ausente: 'Fato ausente',
  fora_do_horario: 'Fora do horário', handoff: 'Passa para pessoa', instrucao_conflitante: 'Instrução conflitante',
  resposta: 'Resposta', fallback: 'Resposta de segurança', vazio: '—',
};
const lines = text => text.split('\n').map(s => s.trim()).filter(Boolean);

export default function Agentes() {
  const [tab, setTab] = useState('agente');
  return (
    <div className="agentes">
      <header className="page-head">
        <div>
          <h1>Agentes</h1>
          <p>Configure como o agente de atendimento responde e quais fatos do negócio ele pode usar.</p>
        </div>
      </header>
      <div className="ag-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'agente'} className={tab === 'agente' ? 'on' : ''} onClick={() => setTab('agente')}>Agente de atendimento</button>
        <button role="tab" aria-selected={tab === 'negocio'} className={tab === 'negocio' ? 'on' : ''} onClick={() => setTab('negocio')}>Lógica do negócio</button>
      </div>
      {tab === 'agente' ? <AgentEditor /> : <OrgContextForm />}
    </div>
  );
}

function AgentEditor() {
  const { agent, settings, user, members = [], pendingWrites, saveAgentDraft, publishAgent, restoreAgentRevision } = useApp();
  const real = user?.mode === 'real';
  const role = members.find(m => m.id === user?.id)?.role;
  const canEdit = !real || role === 'owner' || role === 'admin';
  const [status, setStatus] = useState('');

  if (!agent) {
    return (
      <section className="card ag-empty">
        <h2>Agente de atendimento</h2>
        <p>Disponível depois que o banco desta organização receber a migração 004.</p>
      </section>
    );
  }
  // Publicar ou restaurar troca a revisão; o formulário recomeça a partir do rascunho gravado.
  return <Editor key={`${agent.id || 'novo'}:${agent.publishedRevisionId || ''}`} {...{ status, setStatus, agent, settings, canEdit, pendingWrites, saveAgentDraft, publishAgent, restoreAgentRevision, members }} />;
}

function Editor({ status, setStatus, agent, settings, canEdit, pendingWrites, saveAgentDraft, publishAgent, restoreAgentRevision, members }) {
  const [form, setForm] = useState(() => normalizeAgent(agent.draft));
  const [questions, setQuestions] = useState(() => form.qualificationQuestions.join('\n'));
  const [excluded, setExcluded] = useState(() => form.excludedTopics.join('\n'));
  const published = agent.revisions.find(r => r.id === agent.publishedRevisionId);
  const config = useMemo(() => normalizeAgent({ ...form, qualificationQuestions: lines(questions), excludedTopics: lines(excluded) }), [form, questions, excluded]);
  const dirty = JSON.stringify(config) !== JSON.stringify(normalizeAgent(agent.draft));
  const differsFromPublished = !published || JSON.stringify(config) !== JSON.stringify(normalizeAgent(published.config));

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  const setNested = (group, key) => e => setForm(f => ({ ...f, [group]: { ...f[group], [key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value } }));
  const toggle = (key, value) => setForm(f => ({ ...f, [key]: f[key].includes(value) ? f[key].filter(v => v !== value) : [...f[key], value] }));
  const toggleDay = d => setForm(f => ({ ...f, hours: { ...f.hours, days: f.hours.days.includes(d) ? f.hours.days.filter(x => x !== d) : [...f.hours.days, d] } }));
  const setRule = (i, key) => e => setForm(f => ({ ...f, routingRules: f.routingRules.map((r, j) => j === i ? { ...r, [key]: e.target.value } : r) }));

  function applyProposal(behavior, source) {
    const next = applyBehavior(config, behavior);
    setForm(next);
    setQuestions(next.qualificationQuestions.join('\n'));
    setExcluded(next.excludedTopics.join('\n'));
    setStatus(`${source}: aplicado ao rascunho. Revise, teste no simulador e salve.`);
  }

  async function run(action, done) {
    setStatus('');
    const result = await action();
    if (result === null) return;
    setStatus(done);
  }

  return (
    <>
    <AgentWizard settings={settings} disabled={!canEdit} onApply={applyProposal} />
    <div className="ag-grid">
      <form className="card ag-form" onSubmit={e => { e.preventDefault(); run(() => saveAgentDraft(config), 'Rascunho salvo.'); }}>
        <div className="ag-status">
          <span className={`badge ${published ? 'green' : ''}`}>{published ? `Publicada: revisão ${published.number}` : 'Nunca publicado'}</span>
          {published && differsFromPublished && <span className="badge yellow">Rascunho diferente da publicada</span>}
        </div>
        <fieldset disabled={!canEdit}>
          <Section title="Comportamento">
            <Field label="Objetivo" hint="O que o agente faz em uma frase. Aparece na primeira resposta.">
              <textarea rows={2} maxLength={300} value={form.purpose} onChange={set('purpose')} placeholder="Atender quem chega pelos anúncios e marcar uma visita." />
            </Field>
            <Field label="Tom de voz" hint={`Se vazio, usa o tom da empresa: ${settings.tone || 'não definido'}.`}>
              <input maxLength={120} value={form.tone} onChange={set('tone')} placeholder="Direto, cordial, sem gírias" />
            </Field>
            <Field label="Perguntas de qualificação" hint="Uma por linha, na ordem em que devem ser feitas.">
              <textarea rows={3} value={questions} onChange={e => setQuestions(e.target.value)} placeholder={'Qual é o seu nome?\nPara qual cidade?'} />
            </Field>
            <Field label="Assuntos que o agente não trata" hint="Um por linha. Somam-se às restrições do contexto do negócio.">
              <textarea rows={2} value={excluded} onChange={e => setExcluded(e.target.value)} placeholder="empréstimo" />
            </Field>
          </Section>

          <Section title="Regras de encaminhamento" hint="Avaliadas de cima para baixo. A primeira que casar vale.">
            {form.routingRules.length === 0 && <p className="ag-hint">Nenhuma regra. O agente usa ofertas e perguntas de qualificação.</p>}
            {form.routingRules.map((r, i) => (
              <div className="ag-rule" key={i}>
                <input aria-label="Quando a mensagem contém" value={r.when} onChange={setRule(i, 'when')} placeholder="cancelar, reembolso" />
                <select aria-label="Ação" value={r.action} onChange={setRule(i, 'action')}>
                  {Object.entries(ROUTE_ACTIONS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
                <input aria-label="Resposta" value={r.reply} onChange={setRule(i, 'reply')} placeholder="Texto da resposta (opcional)" disabled={r.action === 'handoff' || r.action === 'qualify'} />
                <button type="button" className="btn btn-ghost btn-icon" aria-label="Remover regra" onClick={() => setForm(f => ({ ...f, routingRules: f.routingRules.filter((_, j) => j !== i) }))}><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" style={{ width: 'fit-content' }} onClick={() => setForm(f => ({ ...f, routingRules: [...f.routingRules, { when: '', action: 'reply', reply: '' }] }))}><Plus size={15} /> Adicionar regra</button>
          </Section>

          <Section title="Horário e limites" hint={`Fuso: ${settings.context?.timezone || 'America/Sao_Paulo'} (definido em Lógica do negócio).`}>
            <div className="ag-days" role="group" aria-label="Dias de atendimento">
              {DAYS.map(([d, t]) => <button type="button" key={d} className={form.hours.days.includes(d) ? 'on' : ''} aria-pressed={form.hours.days.includes(d)} onClick={() => toggleDay(d)}>{t}</button>)}
            </div>
            <div className="ag-row">
              <Field label="Abre"><input type="time" value={form.hours.start} onChange={setNested('hours', 'start')} /></Field>
              <Field label="Fecha"><input type="time" value={form.hours.end} onChange={setNested('hours', 'end')} /></Field>
            </div>
            <Field label="Mensagem fora do horário"><textarea rows={2} maxLength={400} value={form.afterHoursMessage} onChange={set('afterHoursMessage')} /></Field>
            <Field label="Resposta de segurança" hint="Usada quando falta um fato ou a mensagem tenta mudar as regras.">
              <textarea rows={2} maxLength={400} value={form.fallback} onChange={set('fallback')} />
            </Field>
          </Section>

          <Section title="Ações permitidas">
            {Object.entries(ACTIONS).map(([v, t]) => (
              <label key={v} className="ag-check"><input type="checkbox" checked={form.allowedActions.includes(v)} onChange={() => toggle('allowedActions', v)} /> {t}</label>
            ))}
          </Section>

          <details className="ag-advanced">
            <summary>Avançado</summary>
            <div className="ag-row">
              <Field label="Modelo"><select value={form.advanced.model} onChange={setNested('advanced', 'model')}><option value="padrão">Padrão da plataforma</option><option value="rapido">Rápido</option><option value="preciso">Preciso</option></select></Field>
              <Field label="Tempo limite (s)"><input type="number" min={5} max={60} value={form.advanced.timeoutSeconds} onChange={setNested('advanced', 'timeoutSeconds')} /></Field>
              <Field label="Máx. mensagens/hora"><input type="number" min={1} max={500} value={form.advanced.maxMessagesPerHour} onChange={setNested('advanced', 'maxMessagesPerHour')} /></Field>
            </div>
          </details>
        </fieldset>

        {canEdit ? (
          <div className="ag-actions">
            <button className="btn btn-outline" type="submit" disabled={Boolean(pendingWrites) || !dirty}><Save size={15} /> Salvar rascunho</button>
            <button className="btn btn-primary" type="button" disabled={Boolean(pendingWrites) || !differsFromPublished}
              onClick={() => run(() => publishAgent(config), 'Revisão publicada.')}><Send size={15} /> Publicar</button>
            <span role="status" aria-live="polite" className="ag-ok">{status}</span>
          </div>
        ) : <p className="ag-hint">Somente owner ou admin alteram e publicam o agente.</p>}
        <p className="ag-hint">Publicar grava uma revisão. Não liga resposta automática em nenhum canal.</p>
      </form>

      <aside className="ag-side">
        <Simulator config={config} context={settings.context} />
        <Revisions agent={agent} members={members} canEdit={canEdit} busy={Boolean(pendingWrites)}
          onRestore={id => run(() => restoreAgentRevision(id), 'Revisão restaurada e publicada.')} />
      </aside>
    </div>
    </>
  );
}

function Simulator({ config, context }) {
  const [message, setMessage] = useState(SCENARIOS[0].message);
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const ctx = { ...(context || {}), ...(scenario?.context || {}) };
  const result = simulate({ config, context: ctx, message, at: scenarioDate(scenario?.at || 'monday', ctx.timezone), modelAvailable: scenario?.modelAvailable !== false });
  return (
    <section className="card ag-sim" aria-labelledby="sim-title">
      <h2 id="sim-title"><FlaskConical size={16} /> Simulação</h2>
      <p className="ag-hint">Teste sintético com o rascunho atual. Não envia mensagem nem entra nas métricas.</p>
      <div className="ag-scenarios">
        {SCENARIOS.map(s => (
          <button key={s.id} type="button" className={scenario?.id === s.id ? 'on' : ''} onClick={() => { setScenario(s); setMessage(s.message); }}>{s.label}</button>
        ))}
      </div>
      <label className="ag-field"><span>Mensagem do lead</span>
        <textarea rows={2} value={message} onChange={e => { setMessage(e.target.value); setScenario(s => s && { ...s, id: 'livre', message: e.target.value }); }} />
      </label>
      <div className="ag-result">
        <div className="ag-bubble">{result.reply || '—'}</div>
        <dl>
          <dt>Classificação</dt><dd>{CLASS_LABEL[result.classification] || result.classification}</dd>
          <dt>Regra</dt><dd>{result.rule || '—'}</dd>
          {result.missingFacts.length > 0 && <><dt>Falta no contexto</dt><dd className="warn">{result.missingFacts.join(', ')}</dd></>}
          {result.reason && <><dt>Motivo</dt><dd>{result.reason}</dd></>}
          <dt>Passa para pessoa</dt><dd>{result.handoff ? 'Sim' : 'Não'}</dd>
        </dl>
      </div>
    </section>
  );
}

function Revisions({ agent, members, canEdit, busy, onRestore }) {
  const name = id => members.find(m => m.id === id)?.name;
  return (
    <section className="card ag-revs" aria-labelledby="revs-title">
      <h2 id="revs-title"><History size={16} /> Revisões</h2>
      {agent.revisions.length === 0 ? <p className="ag-hint">Nenhuma revisão publicada ainda.</p> : (
        <ol>
          {agent.revisions.map(r => {
            const from = r.restoredFrom && agent.revisions.find(x => x.id === r.restoredFrom);
            const current = r.id === agent.publishedRevisionId;
            return (
              <li key={r.id}>
                <div>
                  <strong>Revisão {r.number}</strong>{current && <span className="badge green">publicada</span>}
                  <div className="ag-hint">{dateTime.format(new Date(r.createdAt))}{name(r.createdBy) ? ` · ${name(r.createdBy)}` : ''}{from ? ` · restaurada da ${from.number}` : ''}</div>
                </div>
                {canEdit && !current && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => onRestore(r.id)}><RotateCcw size={14} /> Restaurar</button>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="ag-section">
      <h3>{title}</h3>
      {hint && <p className="ag-hint">{hint}</p>}
      <div className="ag-section-body">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="ag-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
  );
}
