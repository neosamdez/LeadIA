import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PAGE_SIZE, readAnalyticsPage } from '../services/analytics';
import AnalyticsGoals from './AnalyticsGoals';
import './RealAnalytics.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const timeZone = 'America/Sao_Paulo';
const dateLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone });

function Metric({ orgId, metric, label, description, start, cutoff }) {
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const state = result?.page === page && result.attempt === attempt ? result : null;
  const anchor = 'analytics-' + metric;
  const leads = metric === 'new-leads';

  useEffect(() => {
    const controller = new AbortController();
    readAnalyticsPage({ orgId, metric, start, cutoff, page, signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) setResult({ ...data, page, attempt });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ failed: true, page, attempt });
      });
    return () => controller.abort();
  }, [orgId, metric, start, cutoff, page, attempt]);

  return (
    <article className="card real-analytics-metric">
      <h2>{label}</h2>
      <p>{description}</p>
      {state?.count != null && (
        <a className="real-analytics-count" href={'#' + anchor} aria-label={label + ', ' + state.count + '. Ver registros'}>
          {state.count.toLocaleString('pt-BR')}
        </a>
      )}
      <section id={anchor} tabIndex={-1} aria-label={'Registros de ' + label.toLowerCase()}>
        <h3>Registros do CRM</h3>
        {!state && <p role="status">Carregando registros…</p>}
        {state?.failed && (
          <div role="alert">
            <p>Não foi possível consultar os registros.</p>
            <button className="btn btn-outline btn-sm" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button>
          </div>
        )}
        {state?.count === 0 && <p role="status">{leads ? 'Sem leads nesse período.' : 'Nenhum retorno em atraso nesse corte.'}</p>}
        {state?.rows?.length > 0 && (
          <ul>
            {state.rows.map(row => (
              <li key={row.id}>
                <Link to={'/app/conversas/' + (leads ? row.id : row.lead_id)}>{leads ? row.name : row.title}</Link>
                <time dateTime={leads ? row.created_at : row.due_at}>
                  {dateLabel.format(new Date(leads ? row.created_at : row.due_at))}
                </time>
              </li>
            ))}
          </ul>
        )}
        {(page > 0 || state?.count > PAGE_SIZE) && (
          <div className="real-analytics-controls">
            <button className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
            <span>Página {page + 1}</span>
            <button className="btn btn-outline btn-sm" disabled={!(state?.count > (page + 1) * PAGE_SIZE)} onClick={() => setPage(page + 1)}>Próxima</button>
          </div>
        )}
      </section>
    </article>
  );
}

export default function RealAnalytics({ orgId }) {
  const [days, setDays] = useState(7);
  const [now, setNow] = useState(Date.now);
  const cutoff = new Date(now).toISOString();
  const start = new Date(now - days * DAY_MS).toISOString();

  return (
    <div className="real-analytics">
      <header className="page-head">
        <div><h1>Analytics</h1><p>Indicadores da sua organização no CRM.</p></div>
      </header>
      <div className="real-analytics-controls">
        <label htmlFor="analytics-period">Período dos novos leads</label>
        <select id="analytics-period" value={days} onChange={event => setDays(Number(event.target.value))}>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={() => setNow(Date.now())}>Atualizar</button>
      </div>
      <p className="real-analytics-range">
        {dateLabel.format(new Date(start))} até {dateLabel.format(new Date(cutoff))} · horário de Brasília
      </p>
      <div className="real-analytics-grid">
        <Metric key={orgId + start + cutoff} orgId={orgId} metric="new-leads" label="Novos leads"
          description="Leads cadastrados no período selecionado." start={start} cutoff={cutoff} />
        <Metric key={orgId + cutoff} orgId={orgId} metric="overdue" label="Retornos em atraso"
          description="Retornos abertos com prazo anterior ao horário da consulta." cutoff={cutoff} />
      </div>
      <AnalyticsGoals />
    </div>
  );
}
