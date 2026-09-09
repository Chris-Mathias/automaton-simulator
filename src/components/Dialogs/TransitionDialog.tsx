import { useState } from 'react';
import { Modal } from './Modal';
import { EPSILON, type AutomatonKind, type TapeMove } from '../../types/automaton';
import { MOVE_OPTIONS, tapeSymbolOptions } from './tapeOptions';

export interface TransitionDraft {
  input: string;
  pop?: string;
  push?: string;
  write?: string;
  move?: TapeMove;
}

export function TransitionDialog({
  kind,
  alphabet,
  stackAlphabet,
  tapeAlphabet,
  fromLabel,
  toLabel,
  onSubmit,
  onClose,
}: {
  kind: AutomatonKind;
  alphabet: string[];
  stackAlphabet?: string[];
  tapeAlphabet?: string[];
  fromLabel: string;
  toLabel: string;
  onSubmit: (draft: TransitionDraft) => void;
  onClose: () => void;
}) {
  const isTm = kind === 'TM';
  // A TM always reads something — the blank included — so ε is never an option;
  // it reads from the tape alphabet rather than the input alphabet.
  const symbolOptions = isTm
    ? tapeSymbolOptions(tapeAlphabet)
    : kind === 'DFA'
      ? alphabet
      : [...alphabet, EPSILON];
  const [input, setInput] = useState(symbolOptions[0] ?? '');
  const [pop, setPop] = useState('');
  const [push, setPush] = useState('');
  const [write, setWrite] = useState(symbolOptions[0] ?? '');
  const [move, setMove] = useState<TapeMove>('R');

  const submit = () => {
    if (!input) return;
    if (kind === 'PDA') onSubmit({ input, pop, push });
    else if (isTm) onSubmit({ input, write, move });
    else onSubmit({ input });
  };

  return (
    <Modal title={`Nova transição: ${fromLabel} → ${toLabel}`} onClose={onClose}>
      <div className="field">
        <label>{isTm ? 'Símbolo lido' : 'Símbolo de entrada'}</label>
        <select
          value={input}
          onChange={(e) => {
            // Writing back the symbol just read is by far the common case, so
            // the write field follows along until it's deliberately changed.
            if (write === input) setWrite(e.target.value);
            setInput(e.target.value);
          }}
        >
          {symbolOptions.length === 0 && <option value="">(defina o alfabeto primeiro)</option>}
          {symbolOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isTm && (
        <div className="field-row">
          <div className="field">
            <label>Escreve</label>
            <select value={write} onChange={(e) => setWrite(e.target.value)}>
              {symbolOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Move o cabeçote</label>
            <select value={move} onChange={(e) => setMove(e.target.value as TapeMove)}>
              {MOVE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

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
