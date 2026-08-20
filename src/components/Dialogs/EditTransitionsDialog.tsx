import { useState } from 'react';
import { Modal } from './Modal';
import { EPSILON, type AutomatonKind, type Transition } from '../../types/automaton';

export function EditTransitionsDialog({
  kind,
  alphabet,
  stackAlphabet,
  fromLabel,
  toLabel,
  transitions,
  onUpdate,
  onRemove,
  onAdd,
  onClose,
}: {
  kind: AutomatonKind;
  alphabet: string[];
  stackAlphabet?: string[];
  fromLabel: string;
  toLabel: string;
  transitions: Transition[];
  onUpdate: (id: string, patch: Partial<Omit<Transition, 'id'>>) => void;
  onRemove: (id: string) => void;
  onAdd: (draft: Omit<Transition, 'id'>) => void;
  onClose: () => void;
}) {
  const symbolOptions = kind === 'DFA' ? alphabet : [...alphabet, EPSILON];
  const isPda = kind === 'PDA';
  const [draftInput, setDraftInput] = useState(symbolOptions[0] ?? '');
  const [draftPop, setDraftPop] = useState('');
  const [draftPush, setDraftPush] = useState('');

  return (
    <Modal title={`Editar transições: ${fromLabel} → ${toLabel}`} onClose={onClose}>
      <div className="edit-transitions">
        {transitions.map((t) => (
          <div className="edit-transitions__row" key={t.id}>
            <select className="mono" value={t.input} onChange={(e) => onUpdate(t.id, { input: e.target.value })}>
              {symbolOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {isPda && (
              <>
                <select value={t.pop ?? ''} onChange={(e) => onUpdate(t.id, { pop: e.target.value })}>
                  <option value="">ε</option>
                  {(stackAlphabet ?? []).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <input
                  className="mono"
                  value={t.push ?? ''}
                  placeholder="ε"
                  onChange={(e) => onUpdate(t.id, { push: e.target.value })}
                />
              </>
            )}
            <button className="row-action row-action--danger" onClick={() => onRemove(t.id)} title="Remover">
              <span className="msy">close</span>
            </button>
          </div>
        ))}

        <div className="edit-transitions__row edit-transitions__row--new">
          <select className="mono" value={draftInput} onChange={(e) => setDraftInput(e.target.value)}>
            {symbolOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {isPda && (
            <>
              <select value={draftPop} onChange={(e) => setDraftPop(e.target.value)}>
                <option value="">ε</option>
                {(stackAlphabet ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input className="mono" value={draftPush} placeholder="ε" onChange={(e) => setDraftPush(e.target.value)} />
            </>
          )}
          <button
            className="row-action"
            title="Adicionar outra transição a este par"
            onClick={() => {
              const from = transitions[0].from;
              const to = transitions[0].to;
              onAdd({ from, to, input: draftInput, ...(isPda ? { pop: draftPop, push: draftPush } : {}) });
              setDraftPop('');
              setDraftPush('');
            }}
          >
            <span className="msy">add</span>
          </button>
        </div>
      </div>

      <div className="modal__actions">
        <button className="btn btn-primary" onClick={onClose}>
          Concluído
        </button>
      </div>
    </Modal>
  );
}
