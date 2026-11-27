import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Save, Target } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EMPTY_CONTEXT, LANGUAGES, PRIORITIES, TIMEZONES, missingContext } from '../lib/orgContext';

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const label = { display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 };
const hint = { fontSize: 12, color: 'var(--mute)', fontWeight: 400 };

export default function OrgContextForm() {
  const { settings, updateContext, user, members = [], pendingWrites } = useApp();
  const real = user?.mode === 'real';
  const stored = settings.context ?? (real ? null : EMPTY_CONTEXT);
  const [form, setForm] = useState(() => ({ ...EMPTY_CONTEXT, ...stored }));
  const [saved, setSaved] = useState(false);
  const role = members.find(member => member.id === user?.id)?.role;
  const canEdit = !real || role === 'owner' || role === 'admin';
  const assignees = members.filter(member => member.role !== 'viewer');
  const author = members.find(member => member.id === stored?.updatedBy)?.name;
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#contexto') document.getElementById('contexto')?.scrollIntoView({ block: 'start' });
  }, [hash]);

  if (real && !stored) {
    return (
      <section id="contexto" className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Contexto do negócio</h2>
        <p style={{ margin: 0, color: 'var(--mute)' }}>Disponível depois que o banco desta organização receber a migração 003.</p>
      </section>
    );
  }

  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }));
  const missing = missingContext(form);
  const field = (key, title, help, rows = 2, max = 600) => (
    <label style={label}>{title}
      <textarea rows={rows} maxLength={max} value={form[key]} onChange={set(key)} disabled={!canEdit} />
      <span style={hint}>{help}</span>
    </label>
  );

  async function save(event) {
    event.preventDefault();
    setSaved(false);
    const { updatedAt: _at, updatedBy: _by, ...context } = form;
    const result = await updateContext(context);
    if (result === null) return;
    setSaved(true);
  }

  return (
    <form id="contexto" className="card" onSubmit={save} style={{ padding: 24, display: 'grid', gap: 16 }} aria-labelledby="contexto-title">
      <div>
        <h2 id="contexto-title" style={{ margin: 0, fontSize: 20 }}>Contexto do negócio</h2>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--mute)' }}>
          Fatos aprovados que orientam a equipe e, depois, os agentes. Escreva só o que pode ser dito ao cliente.
        </p>
        {stored?.updatedAt && <p style={{ ...hint, margin: '6px 0 0' }}>Última alteração em {dateTime.format(new Date(stored.updatedAt))}{author ? ` por ${author}` : ''}.</p>}
      </div>

      <fieldset style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, display: 'grid', gap: 12 }} disabled={!canEdit}>
        <legend style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700, padding: '0 6px' }}><Target size={16} color="var(--acc)" /> Prioridade do mês</legend>
        {Object.entries(PRIORITIES).map(([id, priority]) => (
          <label key={id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14 }}>
            <input type="radio" name="priority" value={id} checked={form.priority === id} onChange={set('priority')} style={{ marginTop: 3, width: 'auto', flex: 'none' }} />
            <span><strong>{priority.label}</strong><br /><span style={hint}>Métrica: {priority.metric}. {priority.help}</span></span>
          </label>
        ))}
      </fieldset>

      {field('valueProposition', 'Proposta de valor', 'Por que escolher vocês, em uma ou duas frases.')}
      {field('audience', 'Público', 'Quem vocês atendem e quem fica fora do perfil.')}
      {field('offers', 'Ofertas autorizadas', 'Uma por linha, com preço ou condição somente se puder ser informado ao cliente.', 4, 1500)}
      {field('businessHours', 'Horário de atendimento', 'Exemplo: segunda a sexta, 9h às 18h; sábado, 9h às 13h.', 2, 300)}
      {field('serviceRestrictions', 'Restrições de atendimento', 'O que não prometer, assuntos que exigem uma pessoa, regiões não atendidas.', 3, 1000)}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <label style={label}>Idioma
          <select value={form.language} onChange={set('language')} disabled={!canEdit}>
            {LANGUAGES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
        <label style={label}>Fuso horário
          <select value={form.timezone} onChange={set('timezone')} disabled={!canEdit}>
            {TIMEZONES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
        {real && (
          <label style={label}>Quem assume conversas
            <select value={form.handoffOwnerId || ''} onChange={set('handoffOwnerId')} disabled={!canEdit}>
              <option value="">Definir depois</option>
              {assignees.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {missing.length > 0 && <p style={{ ...hint, margin: 0 }}>Para completar: {missing.join(', ')}.</p>}
      {canEdit ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" type="submit" disabled={Boolean(pendingWrites)}><Save size={16} /> Salvar contexto</button>
          <span role="status" aria-live="polite" style={{ color: 'var(--wa)', fontWeight: 600, fontSize: 14 }}>{saved ? 'Contexto salvo.' : ''}</span>
        </div>
      ) : (
        <p style={{ ...hint, margin: 0 }}>Somente owner ou admin alteram o contexto.</p>
      )}
    </form>
  );
}
