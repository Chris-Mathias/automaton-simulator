import { useState } from 'react';
import { activeDocument, useAutomatonStore } from '../../store/useAutomatonStore';
import { StateList } from './StateList';
import { TransitionList } from './TransitionList';
import { SimulatePanel } from './SimulatePanel';
import { BulkTestPanel } from './BulkTestPanel';
import './SidePanel.css';

type Tab = 'simulate' | 'bulk' | 'table';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'simulate', label: 'Simular', icon: 'play_arrow' },
  { id: 'bulk', label: 'Lote', icon: 'checklist' },
  { id: 'table', label: 'Tabela', icon: 'table_chart' },
];

export function SidePanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<Tab>('simulate');
  const automaton = useAutomatonStore((s) => activeDocument(s).automaton);
  const setSimulationInput = useAutomatonStore((s) => s.setSimulationInput);
  const runSimulation = useAutomatonStore((s) => s.runSimulation);

  if (collapsed) {
    return (
      <button className="side-panel__reopen" onClick={() => setCollapsed(false)} title="Abrir painel">
        <span className="msy">chevron_right</span>
      </button>
    );
  }

  const inspectInSimulator = (input: string) => {
    setSimulationInput(input);
    runSimulation();
    setTab('simulate');
  };

  return (
    <aside className="side-panel">
      <div className="side-panel__logo">
        <span className="msy">hub</span> Simulador de Autômatos
      </div>
      <div className="side-panel__tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>
            <span className="msy" aria-hidden="true">{t.icon}</span> {t.label}
          </button>
        ))}
        <button className="side-panel__collapse" onClick={() => setCollapsed(true)} title="Recolher painel">
          <span className="msy">chevron_left</span>
        </button>
      </div>

      <div className="side-panel__content">
        {tab === 'simulate' && <SimulatePanel />}
        {tab === 'bulk' && <BulkTestPanel onInspect={inspectInSimulator} />}
        {tab === 'table' && (
          <div className="side-panel__table-tab">
            <section>
              <h3>
                Estados <span className="side-panel__count">{automaton.states.length}</span>
              </h3>
              <StateList />
            </section>
            <section>
              <h3>
                Transições <span className="side-panel__count">{automaton.transitions.length}</span>
              </h3>
              <TransitionList />
            </section>
          </div>
        )}
      </div>
    </aside>
  );
}
