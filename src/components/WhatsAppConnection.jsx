import { useCallback, useEffect, useState } from 'react';
import { Link2, LoaderCircle, RefreshCw, Unplug } from 'lucide-react';
import { connectWhatsapp, disconnectWhatsapp, getWhatsappStatus } from '../services/whatsapp';

export default function WhatsAppConnection({ orgId, canEdit }) {
  const [status, setStatus] = useState({ loading: true, connected: false, state: 'close', qr: null, error: '' });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    try {
      const next = await getWhatsappStatus(orgId);
      setStatus({ loading: false, connected: next.connected, state: next.state, qr: null, configured: next.configured, error: '' });
    } catch (error) {
      setStatus(current => ({ ...current, loading: false, error: error.message }));
    }
  }, [orgId]);

  useEffect(() => {
    let active = true;
    if (!orgId) return undefined;
    getWhatsappStatus(orgId).then(next => {
      if (active) setStatus({ loading: false, connected: next.connected, state: next.state, qr: null, configured: next.configured, error: '' });
    }).catch(error => {
      if (active) setStatus(current => ({ ...current, loading: false, error: error.message }));
    });
    return () => { active = false; };
  }, [orgId]);

  useEffect(() => {
    if (!status.qr || !orgId) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const next = await getWhatsappStatus(orgId);
        setStatus(current => ({ ...current, connected: next.connected, state: next.state,
          qr: next.connected ? null : current.qr, error: '' }));
      } catch {}
    }, 6000);
    return () => window.clearInterval(timer);
  }, [orgId, status.qr]);

  async function connect() {
    setBusy(true);
    setStatus(current => ({ ...current, error: '', qr: null }));
    try {
      const result = await connectWhatsapp(orgId);
      setStatus(current => ({ ...current, loading: false, connected: result.connected, state: result.state, qr: result.qr, configured: true }));
    } catch (error) {
      setStatus(current => ({ ...current, loading: false, error: error.message }));
    } finally { setBusy(false); }
  }

  async function disconnect() {
    if (!window.confirm('Desconectar o WhatsApp desta organização?')) return;
    setBusy(true);
    try {
      const result = await disconnectWhatsapp(orgId);
      setStatus({ loading: false, connected: false, state: result.state, qr: null, configured: true, error: '' });
    } catch (error) { setStatus(current => ({ ...current, error: error.message })); }
    finally { setBusy(false); }
  }

  return (
    <section className="card in-pad wa-connect" aria-labelledby="wa-connect-title">
      <div className="wa-heading">
        <div><h2 id="wa-connect-title" className="in-h2">WhatsApp</h2>
          <p className="in-hint">Conecte o número da empresa lendo um QR Code com o celular.</p></div>
        <span className={`wa-state ${status.connected ? 'is-on' : ''}`}><i />{status.loading ? 'Verificando' : status.connected ? 'Conectado' : status.state === 'connecting' ? 'Aguardando leitura' : 'Desconectado'}</span>
      </div>
      {status.qr && !status.connected && <div className="wa-qr-area" aria-live="polite">
        <img className="wa-qr" src={status.qr} alt="QR Code para conectar o WhatsApp" />
        <div><strong>Leia o QR Code no WhatsApp</strong>
          <ol><li>Abra o WhatsApp no celular.</li><li>Acesse <b>Dispositivos conectados</b>.</li><li>Toque em <b>Conectar dispositivo</b> e leia este código.</li></ol>
          <p className="in-hint">O código expira. Se isso acontecer, gere outro.</p></div>
      </div>}
      {!status.qr && !status.connected && <p className="in-hint">As mensagens recebidas poderão entrar na caixa de Conversas. A conexão por QR não ativa respostas automáticas.</p>}
      {status.error && <p className="in-err" role="alert">{status.error}</p>}
      {canEdit ? <div className="wa-actions">
        {!status.connected && <button type="button" className="btn btn-primary btn-sm" disabled={busy || status.loading} onClick={connect}>
          {busy ? <LoaderCircle size={14} className="wa-spin" /> : status.qr ? <RefreshCw size={14} /> : <Link2 size={14} />}{status.qr ? 'Gerar outro QR Code' : 'Conectar WhatsApp'}
        </button>}
        {status.connected && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={disconnect}><Unplug size={14} /> Desconectar</button>}
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy || status.loading} onClick={refresh}>Atualizar status</button>
      </div> : <p className="in-hint">Somente owner ou admin podem conectar o WhatsApp.</p>}
    </section>
  );
}
