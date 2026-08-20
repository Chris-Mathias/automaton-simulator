import { useEffect } from 'react';
import { useAutomatonStore } from './store/useAutomatonStore';
import { Toolbar } from './components/Toolbar/Toolbar';
import { TabBar } from './components/TabBar/TabBar';
import { Canvas } from './components/Canvas/Canvas';
import { SidePanel } from './components/SidePanel/SidePanel';
import { ValidationBar } from './components/SidePanel/ValidationBar';
import './App.css';

function isEditableElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

export default function App() {
  const theme = useAutomatonStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isEditableElement(event.target)) return;
      const key = event.key.toLowerCase();
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = (key === 'z' && event.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) return;
      event.preventDefault();
      const { undo, redo } = useAutomatonStore.getState();
      if (isRedo) redo();
      else undo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <div className="app-body">
        <SidePanel />
        <div className="canvas-column">
          <Toolbar />
          <TabBar />
          <Canvas />
        </div>
      </div>
      <ValidationBar />
    </div>
  );
}
