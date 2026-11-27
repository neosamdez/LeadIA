import { useState } from 'react';
import { Check, Copy, Plus, Power, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { FUNNEL_EVENTS, PLATFORMS, PROVIDERS, STATUS, buildUtmUrl, parseExternalId, trackingChecklist } from '../lib/adIntegrations';
import './Integracoes.css';

export default function Integracoes() {
  const { adIntegrations, user, members = [] } = useApp();
  const real = user?.mode === 'real';
  const role = members.find(m => m.id === user?.id)?.role;
  const canEdit = !real || role === 'owner' || role === 'admin';

  return (
    <div className="integracoes">
      <header className="page-head">
        <div>
          <h1>Integrações</h1>
          <p>Contas de anúncio e rastreamento do cliente, e as ferramentas do dia a dia de tráfego pago.</p>
        </div>
      </header>

      {adIntegrations === null ? (
        <section className="card in-pad">
          <h2 className="in-h2">Integrações</h2>
          <p className="in-hint">Disponível depois que o banco desta organização receber a migração 005.</p>
        </section>
      ) : (
        <>
          <p className="in-note">
            Cadastre os IDs agora. A conexão (OAuth) de cada plataforma roda no servidor e fica como <strong>Aguardando credenciais</strong> até
            os apps Meta, Google e TikTok estarem aprovados. Nenhum token é digitado ou guardado no navegador.
          </p>
          <div className="in-grid">
            <div className="in-platforms">
              {PLATFORMS.map(p => <Platform key={p.id} platform={p} items={adIntegrations.filter(i => PROVIDERS[i.provider]?.platform === p.name)} canEdit={canEdit} />)}
            </div>
            <aside className="in-side">
              <Checklist items={adIntegrations} />
              <UtmBuilder />
            </aside>
          </div>
          <EventMap />
        </>
      )}
    </div>
  );
}

function Platform({ platform, items, canEdit }) {
  const { addAdIntegration, updateAdIntegration, removeAdIntegration, pendingWrites } = useApp();
  const [provider, setProvider] = useState(platform.providers[0].id);
  const [externalId, setExternalId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const info = PROVIDERS[provider];

  async function add(e) {
    e.preventDefault();
    const parsed = parseExternalId(provider, externalId);
    if (!parsed.ok) { setError(parsed.error); return; }
    setError('');
    const result = await addAdIntegration({ provider, externalId: parsed.value, displayName: displayName.trim() });
    if (result === null) { setError('Não foi cadastrado. Confira se o ID já existe.'); return; }
    setExternalId(''); setDisplayName('');
  }

  return (
    <section className="card in-platform" aria-labelledby={`pl-${platform.id}`}>
      <h2 id={`pl-${platform.id}`} className="in-h2">{platform.name}</h2>
      {items.length === 0 ? <p className="in-hint">Nada cadastrado.</p> : (
        <ul className="in-list">
          {items.map(i => {
            const st = STATUS[i.status] || STATUS.desconectado;
            const off = i.status === 'desconectado';
            return (
              <li key={i.id} className={off ? 'off' : ''}>
                <div className="in-item">
                  <span className="in-kind">{PROVIDERS[i.provider].label}</span>
                  <code>{i.externalId}</code>
                  {i.displayName && <span className="in-hint">{i.displayName}</span>}
                  {i.lastError && <span className="in-err">{i.lastError}</span>}
                </div>
                <span className={`badge ${st.tone}`}>{st.label}</span>
                {canEdit && (
                  <div className="in-actions">
                    <button type="button" className="btn btn-outline btn-sm" disabled={Boolean(pendingWrites)}
                      onClick={() => updateAdIntegration(i.id, { status: off ? 'aguardando_credenciais' : 'desconectado' })}>
                      <Power size={13} /> {off ? 'Religar' : 'Desligar'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remover ${i.externalId}`} disabled={Boolean(pendingWrites)}
                      onClick={() => removeAdIntegration(i.id)}><Trash2 size={14} /></button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit ? (
        <form className="in-add" onSubmit={add}>
          <select aria-label={`Tipo de integração ${platform.name}`} value={provider} onChange={e => { setProvider(e.target.value); setError(''); }}>
            {platform.providers.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          <input aria-label="ID" value={externalId} onChange={e => setExternalId(e.target.value)} placeholder={info.placeholder} />
          <input aria-label="Apelido" value={displayName} maxLength={120} onChange={e => setDisplayName(e.target.value)} placeholder="Apelido (opcional)" />
          <button className="btn btn-primary btn-sm" type="submit" disabled={Boolean(pendingWrites) || !externalId.trim()}><Plus size={14} /> Adicionar</button>
          <p className={error ? 'in-err' : 'in-hint'} role={error ? 'alert' : undefined}>{error || info.help}</p>
        </form>
      ) : <p className="in-hint">Somente owner ou admin cadastram integrações.</p>}
    </section>
  );
}

function Checklist({ items }) {
  const list = trackingChecklist(items);
  const done = list.filter(i => i.done).length;
  return (
    <section className="card in-pad" aria-labelledby="chk-title">
      <h2 id="chk-title" className="in-h2">Rastreamento <span className="in-count">{done}/{list.length}</span></h2>
      <ul className="in-check">
        {list.map(i => (
          <li key={i.id} className={i.done ? 'done' : ''}><span className="in-tick" aria-hidden="true">{i.done && <Check size={12} />}</span>{i.label}<span className="sr-only">{i.done ? ' (feito)' : ' (pendente)'}</span></li>
        ))}
      </ul>
    </section>
  );
}

function UtmBuilder() {
  const [f, setF] = useState({ url: '', source: 'meta', medium: 'cpc', campaign: '', content: '', term: '' });
  const [copied, setCopied] = useState(false);
  const result = buildUtmUrl(f);
  const set = k => e => { setF(v => ({ ...v, [k]: e.target.value })); setCopied(false); };
  async function copy() {
    try { await navigator.clipboard.writeText(result.url); setCopied(true); } catch { setCopied(false); }
  }
  const touched = f.url || f.campaign;
  return (
    <section className="card in-pad" aria-labelledby="utm-title">
      <h2 id="utm-title" className="in-h2">Gerador de UTM</h2>
      <label className="in-field">URL de destino<input value={f.url} onChange={set('url')} placeholder="https://site.com/oferta" /></label>
      <div className="in-two">
        <label className="in-field">Origem
          <select value={f.source} onChange={set('source')}>
            {['meta', 'google', 'tiktok', 'instagram', 'whatsapp', 'email'].map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="in-field">Mídia
          <select value={f.medium} onChange={set('medium')}>
            {['cpc', 'paid_social', 'display', 'video', 'organic', 'email'].map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label className="in-field">Campanha<input value={f.campaign} onChange={set('campaign')} placeholder="black_friday_2026" /></label>
      <div className="in-two">
        <label className="in-field">Conteúdo<input value={f.content} onChange={set('content')} placeholder="video_1" /></label>
        <label className="in-field">Termo<input value={f.term} onChange={set('term')} placeholder="opcional" /></label>
      </div>
      {touched && (result.ok ? (
        <div className="in-utm">
          <code>{result.url}</code>
          <button type="button" className="btn btn-outline btn-sm" onClick={copy}>{copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}</button>
        </div>
      ) : <p className="in-hint">{result.error}</p>)}
    </section>
  );
}

function EventMap() {
  return (
    <section className="card in-pad" aria-labelledby="ev-title">
      <h2 id="ev-title" className="in-h2">Eventos de conversão do funil</h2>
      <p className="in-hint">Nome do evento que cada plataforma recebe quando o lead muda de etapa no pipeline. O envio começa quando a conexão estiver ativa.</p>
      <div className="in-table-wrap">
        <table className="in-table">
          <thead><tr><th>Etapa do pipeline</th><th>Meta (Pixel/CAPI)</th><th>Google (GA4/Ads)</th><th>TikTok (Events API)</th></tr></thead>
          <tbody>
            {FUNNEL_EVENTS.map(e => <tr key={e.stage}><td>{e.stage}</td><td><code>{e.meta}</code></td><td><code>{e.google}</code></td><td><code>{e.tiktok}</code></td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
