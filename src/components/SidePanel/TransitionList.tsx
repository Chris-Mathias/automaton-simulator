import { useState } from 'react';
import { activeDocument, useAutomatonStore } from '../../store/useAutomatonStore';
import { EPSILON, TAPE_MOVE_LABELS, hasStack, type TapeMove } from '../../types/automaton';
import { MOVE_OPTIONS, tapeSymbolOptions } from './tapeOptions';

export function TransitionList() {
  const automaton = useAutomatonStore((s) => activeDocument(s).automaton);
  const updateTransition = useAutomatonStore((s) => s.updateTransition);
  const removeTransition = useAutomatonStore((s) => s.removeTransition);
  const addTransition = useAutomatonStore((s) => s.addTransition);

  const hasStacks = hasStack(automaton.kind);
  const isTwoStack = automaton.kind === '2PDA';
  const isTm = automaton.kind === 'TM';
  const symbolOptions = isTm
    ? tapeSymbolOptions(automaton.tapeAlphabet)
    : automaton.kind === 'DFA'
      ? automaton.alphabet
      : [...automaton.alphabet, EPSILON];

  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [draftInput, setDraftInput] = useState('');
  const [draftPop, setDraftPop] = useState('');
  const [draftPush, setDraftPush] = useState('');
  const [draftPop2, setDraftPop2] = useState('');
  const [draftPush2, setDraftPush2] = useState('');
  const [draftWrite, setDraftWrite] = useState('');
  const [draftMove, setDraftMove] = useState<TapeMove>('R');

  const canAdd = draftFrom && draftTo && draftInput;

  const stateLabel = (id: string) => automaton.states.find((s) => s.id === id)?.label ?? id;

  const handleAdd = () => {
    if (!canAdd) return;
    addTransition({
      from: draftFrom,
      to: draftTo,
      input: draftInput,
      ...(hasStacks ? { pop: draftPop, push: draftPush } : {}),
      ...(isTwoStack ? { pop2: draftPop2, push2: draftPush2 } : {}),
      ...(isTm ? { write: draftWrite || draftInput, move: draftMove } : {}),
    });
    setDraftInput('');
    setDraftPop('');
    setDraftPush('');
    setDraftPop2('');
    setDraftPush2('');
    setDraftWrite('');
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
          <th>{isTm ? 'Lê' : 'Símbolo'}</th>
          {hasStacks && <th>{isTwoStack ? 'Desempilha 1' : 'Pop'}</th>}
          {hasStacks && <th>{isTwoStack ? 'Empilha 1' : 'Push'}</th>}
          {isTwoStack && <th>Desempilha 2</th>}
          {isTwoStack && <th>Empilha 2</th>}
          {isTm && <th>Escreve</th>}
          {isTm && <th>Move</th>}
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
            {hasStacks && (
              <td>
                <input
                  className="mono data-table__input data-table__input--narrow"
                  value={t.pop ?? ''}
                  placeholder="ε"
                  onChange={(e) => updateTransition(t.id, { pop: e.target.value })}
                />
              </td>
            )}
            {hasStacks && (
              <td>
                <input
                  className="mono data-table__input data-table__input--narrow"
                  value={t.push ?? ''}
                  placeholder="ε"
                  onChange={(e) => updateTransition(t.id, { push: e.target.value })}
                />
              </td>
            )}
            {isTwoStack && (
              <td>
                <input
                  className="mono data-table__input data-table__input--narrow"
                  value={t.pop2 ?? ''}
                  placeholder="ε"
                  onChange={(e) => updateTransition(t.id, { pop2: e.target.value })}
                />
              </td>
            )}
            {isTwoStack && (
              <td>
                <input
                  className="mono data-table__input data-table__input--narrow"
                  value={t.push2 ?? ''}
                  placeholder="ε"
                  onChange={(e) => updateTransition(t.id, { push2: e.target.value })}
                />
              </td>
            )}
            {isTm && (
              <td>
                <select
                  className="mono"
                  value={t.write ?? t.input}
                  onChange={(e) => updateTransition(t.id, { write: e.target.value })}
                >
                  {symbolOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
            )}
            {isTm && (
              <td>
                <select
                  value={t.move ?? 'R'}
                  onChange={(e) => updateTransition(t.id, { move: e.target.value as TapeMove })}
                >
                  {MOVE_OPTIONS.map(([value]) => (
                    <option key={value} value={value}>
                      {TAPE_MOVE_LABELS[value]}
                    </option>
                  ))}
                </select>
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
          {hasStacks && (
            <td>
              <input
                className="mono data-table__input data-table__input--narrow"
                value={draftPop}
                placeholder="ε"
                onChange={(e) => setDraftPop(e.target.value)}
              />
            </td>
          )}
          {hasStacks && (
            <td>
              <input
                className="mono data-table__input data-table__input--narrow"
                value={draftPush}
                placeholder="ε"
                onChange={(e) => setDraftPush(e.target.value)}
              />
            </td>
          )}
          {isTwoStack && (
            <td>
              <input
                className="mono data-table__input data-table__input--narrow"
                value={draftPop2}
                placeholder="ε"
                onChange={(e) => setDraftPop2(e.target.value)}
              />
            </td>
          )}
          {isTwoStack && (
            <td>
              <input
                className="mono data-table__input data-table__input--narrow"
                value={draftPush2}
                placeholder="ε"
                onChange={(e) => setDraftPush2(e.target.value)}
              />
            </td>
          )}
          {isTm && (
            <td>
              <select className="mono" value={draftWrite} onChange={(e) => setDraftWrite(e.target.value)}>
                <option value="">(= lido)</option>
                {symbolOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </td>
          )}
          {isTm && (
            <td>
              <select value={draftMove} onChange={(e) => setDraftMove(e.target.value as TapeMove)}>
                {MOVE_OPTIONS.map(([value]) => (
                  <option key={value} value={value}>
                    {TAPE_MOVE_LABELS[value]}
                  </option>
                ))}
              </select>
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
