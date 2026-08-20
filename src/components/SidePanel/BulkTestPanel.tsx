import { useMemo, useState } from 'react';
import { activeDocument, useAutomatonStore } from '../../store/useAutomatonStore';
import { simulate } from '../../engine/simulate';

interface BulkResult {
  input: string;
  accepted: boolean;
  truncated: boolean;
}

function parseLines(raw: string): string[] {
  if (raw === '') return [];
  const lines = raw.split('\n').map((l) => l.replace(/\r$/, ''));
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function BulkTestPanel({ onInspect }: { onInspect: (input: string) => void }) {
  const automaton = useAutomatonStore((s) => activeDocument(s).automaton);
  const [raw, setRaw] = useState('');
  const [results, setResults] = useState<BulkResult[] | null>(null);

  const lineCount = useMemo(() => parseLines(raw).length, [raw]);

  const run = () => {
    const inputs = parseLines(raw);
    setResults(inputs.map((input) => {
      const r = simulate(automaton, input);
      return { input, accepted: r.accepted, truncated: r.truncated };
    }));
  };

  const acceptedCount = results?.filter((r) => r.accepted).length ?? 0;

  return (
    <div className="bulk-test">
      <div className="field">
        <label>Strings de teste (uma por linha)</label>
        <textarea
          className="mono bulk-test__textarea"
          rows={12}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={'01\n001\n111\n\n(linha em branco = ε)'}
        />
      </div>

      <button className="btn btn-primary" onClick={run} disabled={!automaton.startStateId || lineCount === 0}>
        <span className="msy">play_arrow</span> Rodar {lineCount > 0 ? `${lineCount} string${lineCount > 1 ? 's' : ''}` : 'todos'}
      </button>

      {results && (
        <>
          <div className="bulk-test__summary">
            <span className="bulk-test__summary-chip is-accept">{acceptedCount} aceitas</span>
            <span className="bulk-test__summary-chip is-reject">{results.length - acceptedCount} rejeitadas</span>
            <span className="bulk-test__summary-total">de {results.length}</span>
          </div>

          <ul className="bulk-test__list">
            {results.map((r, i) => (
              <li
                key={i}
                className={`bulk-test__row ${r.accepted ? 'is-accept' : 'is-reject'}`}
                onClick={() => onInspect(r.input)}
                title="Ver passo a passo no simulador"
              >
                <span className="mono bulk-test__input">{r.input === '' ? 'ε' : r.input}</span>
                {r.truncated && (
                  <span className="msy bulk-test__flag" title="Execução truncada por limite de passos">
                    warning
                  </span>
                )}
                <span className="bulk-test__badge">
                  <span className="msy">{r.accepted ? 'check' : 'close'}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
