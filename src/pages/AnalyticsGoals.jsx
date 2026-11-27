import { useState } from 'react';
import { Save } from 'lucide-react';
import { useApp } from '../context/AppContext';

const fields = [
  ['monthlyLeads', 'Leads', 'Meta leads/mês', 1],
  ['conversionRate', 'Conversão', 'Meta conversão (%)', 0.01, 999.99],
  ['revenue', 'Receita', 'Meta receita (R$)', 0.01],
  ['responseMinutes', 'Tempo de resposta', 'Meta resposta (min)', 1],
];

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatGoal = {
  monthlyLeads: value => number.format(value),
  conversionRate: value => number.format(value) + '%',
  revenue: value => currency.format(value),
  responseMinutes: value => number.format(value) + ' min',
};

export default function AnalyticsGoals({ children }) {
  const { goals, updateGoals, user, members } = useApp();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const viewer = members?.some(member => member.id === user?.id && member.role === 'viewer');

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const values = Object.fromEntries(fields.map(([key]) => [key, Number(form[key]) || 0]));
      if (await updateGoals(values) !== null) setForm(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 22, marginTop: 16, marginBottom: 16 }}>
      <div className="real-analytics-controls" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Metas mensais</h2>
        {!viewer && <button className="btn btn-sm btn-outline" disabled={saving}
          onClick={() => setForm(form ? null : { ...goals })}>{form ? 'Fechar' : 'Editar metas'}</button>}
      </div>
      {user?.mode === 'real' && (
        <dl className="real-analytics-goals" aria-label="Metas configuradas">
          {fields.map(([key, label]) => (
            <div key={key}><dt>{label}</dt><dd>{formatGoal[key](goals[key])}</dd></div>
          ))}
        </dl>
      )}
      {!viewer && form && (
        <form onSubmit={save} className="real-analytics-grid" style={{ marginTop: 12, marginBottom: 14 }}>
          {fields.map(([key, , label, step, max]) => (
            <label key={key} style={{ display: 'grid', gap: 4 }}>
              {label}
              <input type="number" min="0" step={step} max={max} required value={form[key]}
                onChange={event => setForm({ ...form, [key]: event.target.value })} />
            </label>
          ))}
          <div><button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
            <Save size={14} /> {saving ? 'Salvando…' : 'Salvar metas'}
          </button></div>
        </form>
      )}
      {children}
    </div>
  );
}
