'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  /** Affiche un bouton « agrandir » (plein écran) — demande DG module Mission. */
  expandable?: boolean;
}

/**
 * Modale rendue via un portail sur `document.body` : elle échappe à tout `transform` /
 * `overflow` d'un conteneur parent (ex. `.cc:hover{transform}` qui la décentrait et la
 * faisait scintiller). Structure `.modal-ov > .modal` de v8 + bouton agrandir.
 */
export default function Modal({ open, onClose, title, children, footer, wide, expandable }: Props) {
  const [full, setFull] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    setFull(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Bloque le défilement de la page derrière la modale.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const style: React.CSSProperties = full
    ? { maxWidth: '96vw', width: '96vw', height: 'calc(100vh - 32px)' }
    : wide
      ? { width: 'min(900px, calc(100vw - 24px))', maxWidth: 'calc(100vw - 24px)' }
      : { maxWidth: 'calc(100vw - 24px)' };

  return createPortal(
    <div className="modal-ov vis" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={style}>
        {title != null && (
          <div className="modal-hd">
            <h3>{title}</h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {expandable && (
                <button className="modal-cl" onClick={() => setFull((v) => !v)} aria-label="Agrandir" title={full ? 'Réduire' : 'Agrandir'} style={{ fontSize: '.85rem' }}>
                  {full ? 'Réduire' : 'Agrandir'}
                </button>
              )}
              <button className="modal-cl" onClick={onClose} aria-label="Fermer">✕</button>
            </div>
          </div>
        )}
        <div className="modal-bd">{children}</div>
        {footer != null && <div className="modal-ft">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
