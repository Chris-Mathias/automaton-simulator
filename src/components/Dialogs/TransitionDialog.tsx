import { useState } from 'react';
import { Modal } from './Modal';
import { EPSILON, type AutomatonKind } from '../../types/automaton';

export interface TransitionDraft {
  input: string;
  pop?: string;
  push?: string;
}

export function TransitionDialog({
  kind,
  alphabet,
  stackAlphabet,
  fromLabel,
  toLabel,
  onSubmit,
  onClose,
}: {
  kind: AutomatonKind;
  alphabet: string[];
  stackAlphabet?: string[];
  fromLabel: string;
  toLabel: string;
  onSubmit: (draft: TransitionDraft) => void;
  onClose: () => void;
}) {
  const symbolOptions = kind === 'DFA' ? alphabet : [...alphabet, EPSILON];
  const [input, setInput] = useState(symbolOptions[0] ?? '');
  const [pop, setPop] = useState('');
  const [push, setPush] = useState('');

  const submit = () => {
    if (!input) return;
    onSubmit(kind === 'PDA' ? { input, pop, push } : { input });
  };

  return (
    <Modal title={`Nova transição: ${fromLabel} → ${toLabel}`} onClose={onClose}>
      <div className="field">
        <label>Símbolo de entrada</label>
        <select value={input} onChange={(e) => setInput(e.target.value)}>
          {symbolOptions.length === 0 && <option value="">(defina o alfabeto primeiro)</option>}
          {symbolOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {kind === 'PDA' && (
        <div className="field-row">
          <div className="field">
            <label>Desempilha (pop)</label>
            <select value={pop} onChange={(e) => setPop(e.target.value)}>
              <option value="">ε (nada)</option>
              {(stackAlphabet ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Empilha (push)</label>
            <input
              className="mono"
              placeholder="ex.: AB (ε = nada)"
              value={push}
              onChange={(e) => setPush(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="modal__actions">
        <button className="btn" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-primary" disabled={!input} onClick={submit}>
          Criar transição
        </button>
      </div>
    </Modal>
  );
}
