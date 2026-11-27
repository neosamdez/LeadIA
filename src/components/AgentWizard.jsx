import { useRef, useState } from 'react';
import { CalendarCheck, HeartHandshake, Magnet, RefreshCcw, ShoppingBag, Sparkles, Wand2 } from 'lucide-react';
import Modal from './Modal';
import { OBJECTIVES, buildFromObjective } from '../lib/agentPresets';
import { ACTIONS, ROUTE_ACTIONS } from '../lib/agentSim';
import { generateAgentConfig, isNvidiaConfigured } from '../services/nvidia';

const ICONS = { leads: Magnet, agenda: CalendarCheck, vendas: ShoppingBag, suporte: HeartHandshake, reativar: RefreshCcw };

/** Escolher um objetivo ou descrever o negócio e receber uma configuração para revisar antes de aplicar. */
export default function AgentWizard({ settings, disabled, onApply }) {
  const context = settings.context || {};
  const aiReady = isNvidiaConfigured(settings);
  const [proposal, setProposal] = useState(null); // { objective, behavior, source }
  const [genOpen, setGenOpen] = useState(false);
  const [objective, setObjective] = useState('leads');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  function pickObjective(id) {
    setProposal({ objective: id, behavior: buildFromObjective(id, { context }), source: 'modelo' });
  }

  async function generate(e) {
    e.preventDefault();
    setError('');
    if (!aiReady) {
      setGenOpen(false);
      setProposal({ objective, behavior: buildFromObjective(objective, { description, context }), source: 'modelo-sem-ia' });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const behavior = await generateAgentConfig({ objective, description, context, settings, signal: controller.signal });
      setGenOpen(false);
      setProposal({ objective, behavior, source: 'ia' });
    } catch (err) {
      if (err?.name !== 'AbortError') setError(`${err.message} Você pode usar o modelo pronto do objetivo.`);
    } finally {
      setLoading(false);
    }
  }

  function closeGen() { abortRef.current?.abort(); setLoading(false); setGenOpen(false); }

  const contextFilled = ['valueProposition', 'audience', 'offers'].filter(k => String(context[k] || '').trim()).length;
  const sourceLabel = { ia: 'Gerado pela IA com o contexto do negócio', modelo: 'Modelo pronto do objetivo', 'modelo-sem-ia': 'Modelo pronto (IA não configurada em Configurações)' };

  return (
    <section className="ag-wizard" aria-labelledby="ag-wizard-title">
      <div className="ag-wizard-head">
        <div>
          <h2 id="ag-wizard-title">Comece pelo objetivo</h2>
          <p>Escolha o que o agente precisa fazer. Você revisa antes de aplicar, e nada é publicado sem você.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() => { setError(''); setGenOpen(true); }}>
          <Wand2 size={15} /> Gerar com IA
        </button>
      </div>
      <div className="ag-objectives">
        {Object.entries(OBJECTIVES).map(([id, o]) => {
          const Icon = ICONS[id] || Sparkles;
          return (
            <button key={id} type="button" className="ag-objective" disabled={disabled} onClick={() => pickObjective(id)}>
              <Icon size={18} aria-hidden="true" />
              <strong>{o.label}</strong>
              <span>{o.summary}</span>
            </button>
          );
        })}
      </div>

      <Modal open={genOpen} onClose={closeGen} size="md" icon={Wand2} title="Gerar configuração com IA"
        subtitle={aiReady ? 'Usa o modelo configurado e o contexto do negócio.' : 'IA não configurada: será usado o modelo pronto do objetivo com a sua descrição.'}>
        <form className="ag-gen" onSubmit={generate}>
          <label className="ag-field">Objetivo principal
            <select value={objective} onChange={e => setObjective(e.target.value)}>
              {Object.entries(OBJECTIVES).map(([id, o]) => <option key={id} value={id}>{o.label}</option>)}
            </select>
            <span className="ag-hint">{OBJECTIVES[objective].when}</span>
          </label>
          <label className="ag-field">Descreva o negócio e o que o agente deve fazer
            <textarea rows={4} maxLength={800} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Clínica de estética em Teresina. Leads chegam pelo Instagram perguntando preço de harmonização; quero marcar avaliação gratuita." />
          </label>
          <p className={`ag-hint ${contextFilled < 2 ? 'warn' : ''}`}>
            Contexto do negócio: {contextFilled}/3 campos principais preenchidos{contextFilled < 2 ? ' — preencha "Lógica do negócio" para um resultado melhor.' : '.'}
          </p>
          {error && <p className="ag-error" role="alert">{error}</p>}
          <div className="ag-gen-actions">
            {error && <button type="button" className="btn btn-outline btn-sm" onClick={() => { setGenOpen(false); setProposal({ objective, behavior: buildFromObjective(objective, { description, context }), source: 'modelo' }); }}>Usar modelo pronto</button>}
            <button type="button" className="btn btn-outline btn-sm" onClick={closeGen}>Cancelar</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}><Sparkles size={14} /> {loading ? 'Gerando…' : 'Gerar proposta'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!proposal} onClose={() => setProposal(null)} size="lg" icon={Sparkles}
        title={proposal ? OBJECTIVES[proposal.objective]?.label : ''} subtitle={proposal ? sourceLabel[proposal.source] : ''}
        footer={proposal && <>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setProposal(null)}>Cancelar</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { onApply(proposal.behavior, sourceLabel[proposal.source]); setProposal(null); }}>Aplicar ao rascunho</button>
        </>}>
        {proposal && <Preview behavior={proposal.behavior} />}
      </Modal>
    </section>
  );
}

function Preview({ behavior: b }) {
  return (
    <div className="ag-preview">
      <p className="ag-hint">Substitui objetivo, tom, perguntas, assuntos fora, regras e ações do rascunho. Horário e limites ficam como estão.</p>
      <dl>
        <dt>Objetivo</dt><dd>{b.purpose}</dd>
        {b.tone && <><dt>Tom</dt><dd>{b.tone}</dd></>}
        {b.qualificationQuestions?.length > 0 && <><dt>Perguntas</dt><dd><ol>{b.qualificationQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol></dd></>}
        {b.routingRules?.length > 0 && <><dt>Regras</dt><dd><ul>{b.routingRules.map((r, i) => (
          <li key={i}><code>{r.when}</code> → {ROUTE_ACTIONS[r.action]}{r.reply ? `: “${r.reply}”` : ''}</li>
        ))}</ul></dd></>}
        {b.excludedTopics?.length > 0 && <><dt>Não trata</dt><dd>{b.excludedTopics.join(' · ')}</dd></>}
        {b.allowedActions?.length > 0 && <><dt>Ações</dt><dd>{b.allowedActions.map(a => ACTIONS[a]).join(' · ')}</dd></>}
        {b.afterHoursMessage && <><dt>Fora do horário</dt><dd>{b.afterHoursMessage}</dd></>}
      </dl>
    </div>
  );
}
