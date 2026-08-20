import { useMemo, useState } from 'react';
import { activeDocument, useAutomatonStore } from '../../store/useAutomatonStore';
import { validate } from '../../engine/validate';
import './ValidationBar.css';

export function ValidationBar() {
  const automaton = useAutomatonStore((s) => activeDocument(s).automaton);
  const [open, setOpen] = useState(false);
  const issues = useMemo(() => validate(automaton), [automaton]);
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  if (issues.length === 0) {
    return (
      <div className="validation-bar validation-bar--ok">
        <span className="msy">check_circle</span>
        <span>Autômato válido, sem pendências</span>
      </div>
    );
  }

  return (
    <div className={`validation-bar ${open ? 'is-open' : ''}`}>
      <button className="validation-bar__summary" onClick={() => setOpen((v) => !v)}>
        {errorCount > 0 && <span className="validation-bar__count validation-bar__count--error">{errorCount} erro(s)</span>}
        {warningCount > 0 && (
          <span className="validation-bar__count validation-bar__count--warning">{warningCount} aviso(s)</span>
        )}
        <span className="msy validation-bar__chevron">{open ? 'expand_more' : 'expand_less'}</span>
      </button>
      {open && (
        <ul className="validation-bar__list">
          {issues.map((issue) => (
            <li key={issue.id} className={`validation-bar__item validation-bar__item--${issue.severity}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
