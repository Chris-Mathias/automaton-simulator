import { activeDocument, useAutomatonStore } from '../../store/useAutomatonStore';

export function StateList() {
  const states = useAutomatonStore((s) => activeDocument(s).automaton.states);
  const renameState = useAutomatonStore((s) => s.renameState);
  const toggleAccept = useAutomatonStore((s) => s.toggleAccept);
  const setStart = useAutomatonStore((s) => s.setStart);
  const removeState = useAutomatonStore((s) => s.removeState);

  if (states.length === 0) {
    return <p className="side-panel__empty">Nenhum estado ainda. Clique no canvas para criar um.</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Estado</th>
          <th title="Estado inicial">Inicial</th>
          <th title="Estado de aceitação">Aceita</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {states.map((s) => (
          <tr key={s.id}>
            <td>
              <input
                className="mono data-table__input"
                value={s.label}
                onChange={(e) => renameState(s.id, e.target.value)}
              />
            </td>
            <td className="data-table__center">
              <input type="radio" checked={s.isStart} onChange={() => setStart(s.id)} />
            </td>
            <td className="data-table__center">
              <input type="checkbox" checked={s.isAccept} onChange={() => toggleAccept(s.id)} />
            </td>
            <td className="data-table__center">
              <button className="row-action row-action--danger" onClick={() => removeState(s.id)} title="Excluir">
                <span className="msy">delete</span>
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
