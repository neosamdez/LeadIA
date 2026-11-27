import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

/**
 * Modal acessível sobre <dialog>: Esc fecha, o foco fica preso e volta ao gatilho.
 * side="right" abre como gaveta lateral; tone="deck" usa o tema escuro da tela de Conversas.
 */
export default function Modal({ open, onClose, title, subtitle, icon: Icon, size = 'md', side, tone, footer, children }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const cls = ['modal', `modal-${size}`, side === 'right' && 'modal-drawer', tone === 'deck' && 'modal-deck'].filter(Boolean).join(' ');
  return (
    <dialog ref={ref} className={cls} aria-labelledby={titleId} onClose={onClose}
      onClick={e => { if (e.target === ref.current) onClose(); }}>
      {open && (
        <div className="modal-box">
          <header className="modal-head">
            <div className="modal-titles">
              <h2 id={titleId}>{Icon && <Icon size={17} aria-hidden="true" />}{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button type="button" className="modal-close" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
          </header>
          <div className="modal-body">{children}</div>
          {footer && <footer className="modal-foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
