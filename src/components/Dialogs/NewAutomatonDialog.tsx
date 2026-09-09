import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import type { AutomatonKind } from '../../types/automaton';

const KIND_LABELS: Record<AutomatonKind, string> = {
  DFA: 'AFD — Autômato Finito Determinístico',
  NFA: 'AFN — Autômato Finito Não-Determinístico',
  PDA: 'PDA — Autômato de Pilha',
  TM: 'MT — Máquina de Turing',
};

export function NewAutomatonDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (kind: AutomatonKind, name: string) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<AutomatonKind>('DFA');
  const [name, setName] = useState('Novo autômato');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.select();
  }, []);

  const handleCreate = () => {
    onSubmit(kind, name.trim() || 'Novo autômato');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
  };

  return (
    <Modal title="Novo autômato" onClose={onClose}>
      <div className="field">
        <label>Nome</label>
        <input
          ref={nameInputRef}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="field">
        <label>Tipo</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as AutomatonKind)} onKeyDown={handleKeyDown}>
          {(Object.keys(KIND_LABELS) as AutomatonKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="modal__actions">
        <button className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-primary" onClick={handleCreate}>
          Criar
        </button>
      </div>
    </Modal>
  );
}
