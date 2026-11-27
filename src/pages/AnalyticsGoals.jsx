import { useState } from 'react';
import { Save } from 'lucide-react';
import { useApp } from '../context/AppContext';

const fields = [
  ['monthlyLeads', 'Meta leads/mês'],
  ['conversionRate', 'Meta conversão (%)'],
  ['revenue', 'Meta receita (R$)'],
  ['responseMinutes', 'Meta resposta (min)'],
];

export default function AnalyticsGoals({ children }) {
  const { goals, updateGoals } = useApp();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

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
        <button className="btn btn-sm btn-outline" disabled={saving}
          onClick={() => setForm(form ? null : { ...goals })}>{form ? 'Fechar' : 'Editar metas'}</button>
      </div>
      {form && (
        <form onSubmit={save} className="real-analytics-grid" style={{ marginTop: 12, marginBottom: 14 }}>
          {fields.map(([key, label]) => (
            <label key={key} style={{ display: 'grid', gap: 4 }}>
              {label}
              <input type="number" min="0" step={key === 'revenue' ? '0.01' : '1'} value={form[key]}
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
