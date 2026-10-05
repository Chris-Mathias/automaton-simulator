import { useState } from 'react';
import { useAutomatonStore } from '../../store/useAutomatonStore';
import { NewAutomatonDialog } from '../Dialogs/NewAutomatonDialog';
import './TabBar.css';

const KIND_BADGE: Record<string, string> = { DFA: 'AFD', NFA: 'AFN', PDA: 'PDA', '2PDA': 'AP2', TM: 'MT' };

export function TabBar() {
  const documents = useAutomatonStore((s) => s.documents);
  const activeId = useAutomatonStore((s) => s.activeId);
  const switchTab = useAutomatonStore((s) => s.switchTab);
  const closeTab = useAutomatonStore((s) => s.closeTab);
  const newTab = useAutomatonStore((s) => s.newTab);
  const renameAutomaton = useAutomatonStore((s) => s.renameAutomaton);
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <div className="tab-bar">
      {documents.map((doc) => (
        <button
          key={doc.id}
          className={`tab-bar__tab ${doc.id === activeId ? 'is-active' : ''}`}
          onClick={() => switchTab(doc.id)}
          title={doc.automaton.name}
        >
          <span className={`tab-bar__badge kind-badge kind-badge--${doc.automaton.kind}`}>
            {KIND_BADGE[doc.automaton.kind]}
          </span>
          <span className="tab-bar__name">{doc.automaton.name}</span>
          {documents.length > 1 && (
            <span
              className="tab-bar__close"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(doc.id);
              }}
              title="Fechar aba"
            >
              <span className="msy">close</span>
            </span>
          )}
        </button>
      ))}
      <button className="tab-bar__add" onClick={() => setShowNewDialog(true)} title="Novo autômato (nova aba)">
        <span className="msy">add</span>
      </button>

      {showNewDialog && (
        <NewAutomatonDialog
          onSubmit={(kind, name) => {
            newTab(kind);
            renameAutomaton(name);
          }}
          onClose={() => setShowNewDialog(false)}
        />
      )}
    </div>
  );
}
