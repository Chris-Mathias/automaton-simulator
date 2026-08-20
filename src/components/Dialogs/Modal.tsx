import type { ReactNode } from 'react';
import './Modal.css';

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="Fechar">
            <span className="msy">close</span>
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
