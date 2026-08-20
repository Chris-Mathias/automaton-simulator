import { useState } from 'react';
import { activeDocument, useAutomatonStore } from '../../store/useAutomatonStore';
import { EPSILON } from '../../types/automaton';

export function TransitionList() {
  const automaton = useAutomatonStore((s) => activeDocument(s).automaton);
  const updateTransition = useAutomatonStore((s) => s.updateTransition);
  const removeTransition = useAutomatonStore((s) => s.removeTransition);
  const addTransition = useAutomatonStore((s) => s.addTransition);

  const symbolOptions = automaton.kind === 'DFA' ? automaton.alphabet : [...automaton.alphabet, EPSILON];
  const isPda = automaton.kind === 'PDA';

  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [draftInput, setDraftInput] = useState('');
  const [draftPop, setDraftPop] = useState('');
  const [draftPush, setDraftPush] = useState('');

  const canAdd = draftFrom && draftTo && draftInput;

  const stateLabel = (id: string) => automaton.states.find((s) => s.id === id)?.label ?? id;

  const handleAdd = () => {
    if (!canAdd) return;
    addTransition({
      from: draftFrom,
      to: draftTo,
      input: draftInput,
      ...(isPda ? { pop: draftPop, push: draftPush } : {}),
    });
    setDraftInput('');
    setDraftPop('');
    setDraftPush('');
  };

  if (automaton.states.length === 0) {
    return <p className="side-panel__empty">Crie estados primeiro para poder ligar transições entre eles.</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>De</th>
          <th>Para</th>
          <th>Símbolo</th>
          {isPda && <th>Pop</th>}
          {isPda && <th>Push</th>}
          <th />
        </tr>
      </thead>
      <tbody>
        {automaton.transitions.map((t) => (
          <tr key={t.id}>
            <td>{stateLabel(t.from)}</td>
            <td>{stateLabel(t.to)}</td>
            <td>
              <select
                className="mono"
                value={t.input}
                onChange={(e) => updateTransition(t.id, { input: e.target.value })}
              >
                {symbolOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </td>
            {isPda && (
              <td>
                <input
                  className="mono data-table__input data-table__input--narrow"
                  value={t.pop ?? ''}
                  placeholder="ε"
                  onChange={(e) => updateTransition(t.id, { pop: e.target.value })}
                />
              </td>
            )}
            {isPda && (
              <td>
                <input
                  className="mono data-table__input data-table__input--narrow"
                  value={t.push ?? ''}
                  placeholder="ε"
                  onChange={(e) => updateTransition(t.id, { push: e.target.value })}
                />
              </td>
            )}
            <td className="data-table__center">
              <button className="row-action row-action--danger" onClick={() => removeTransition(t.id)} title="Excluir">
                <span className="msy">delete</span>
              </button>
            </td>
          </tr>
        ))}

        <tr className="data-table__new-row">
          <td>
            <select value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)}>
              <option value="">—</option>
              {automaton.states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </td>
          <td>
            <select value={draftTo} onChange={(e) => setDraftTo(e.target.value)}>
              <option value="">—</option>
              {automaton.states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </td>
          <td>
            <select className="mono" value={draftInput} onChange={(e) => setDraftInput(e.target.value)}>
              <option value="">—</option>
              {symbolOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </td>
          {isPda && (
            <td>
              <input
                className="mono data-table__input data-table__input--narrow"
                value={draftPop}
                placeholder="ε"
                onChange={(e) => setDraftPop(e.target.value)}
              />
            </td>
          )}
          {isPda && (
            <td>
              <input
                className="mono data-table__input data-table__input--narrow"
                value={draftPush}
                placeholder="ε"
                onChange={(e) => setDraftPush(e.target.value)}
              />
            </td>
          )}
          <td className="data-table__center">
            <button className="row-action" disabled={!canAdd} onClick={handleAdd} title="Adicionar transição">
              <span className="msy">add</span>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
