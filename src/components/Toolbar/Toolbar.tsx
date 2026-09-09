import { useEffect, useRef, useState } from 'react';
import { activeDocument, useAutomatonStore } from '../../store/useAutomatonStore';
import { convertNfaToDfa } from '../../engine/convertNfaToDfa';
import { exportAutomatonToFile, importAutomatonFromFile } from '../../persistence/exportImport';
import { BLANK } from '../../types/automaton';
import { normalizeTapeSymbol } from '../../engine/transitionSyntax';
import './Toolbar.css';

function parseSymbols(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen].sort();
}

/** The blank is always implicit on the tape, so declaring it — under any of
 *  its typed aliases — is a no-op rather than a second, literal symbol that
 *  would then shadow the alias on every transition label. */
function parseTapeSymbols(raw: string): string[] {
  return [...new Set(parseSymbols(raw).map(normalizeTapeSymbol))].filter((s) => s !== BLANK);
}

export function Toolbar() {
  const automaton = useAutomatonStore((s) => activeDocument(s).automaton);
  const theme = useAutomatonStore((s) => s.theme);
  const toggleTheme = useAutomatonStore((s) => s.toggleTheme);
  const renameAutomaton = useAutomatonStore((s) => s.renameAutomaton);
  const setAlphabet = useAutomatonStore((s) => s.setAlphabet);
  const setStackAlphabet = useAutomatonStore((s) => s.setStackAlphabet);
  const setTapeAlphabet = useAutomatonStore((s) => s.setTapeAlphabet);
  const openTab = useAutomatonStore((s) => s.openTab);
  const undo = useAutomatonStore((s) => s.undo);
  const redo = useAutomatonStore((s) => s.redo);
  const canUndo = useAutomatonStore((s) => activeDocument(s).past.length > 0);
  const canRedo = useAutomatonStore((s) => activeDocument(s).future.length > 0);

  const [alphabetDraft, setAlphabetDraft] = useState(automaton.alphabet.join(', '));
  const [stackDraft, setStackDraft] = useState((automaton.stackAlphabet ?? []).join(', '));
  const [tapeDraft, setTapeDraft] = useState((automaton.tapeAlphabet ?? []).join(', '));
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const alphabetKey = automaton.alphabet.join(',');
  const stackAlphabetKey = (automaton.stackAlphabet ?? []).join(',');
  const tapeAlphabetKey = (automaton.tapeAlphabet ?? []).join(',');

  useEffect(() => {
    setAlphabetDraft(automaton.alphabet.join(', '));
    setStackDraft((automaton.stackAlphabet ?? []).join(', '));
    setTapeDraft((automaton.tapeAlphabet ?? []).join(', '));
    // Resyncs whenever the underlying alphabet changes for any reason — tab
    // switch, blur-commit here, or the canvas auto-adding a typed symbol —
    // not just when switching automatons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automaton.id, alphabetKey, stackAlphabetKey, tapeAlphabetKey]);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = await importAutomatonFromFile(file);
      openTab(imported);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Falha ao importar.');
    }
  };

  const handleConvert = () => {
    try {
      const dfa = convertNfaToDfa(automaton);
      openTab(dfa);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Falha ao converter.');
    }
  };

  return (
    <header className="toolbar">
      <div className="toolbar__group">
        <input
          className="toolbar__name mono"
          value={automaton.name}
          onChange={(e) => renameAutomaton(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </div>

      <div className="toolbar__group toolbar__group--grow">
        <label className="toolbar__field">
          <span>Alfabeto</span>
          <input
            className="mono"
            value={alphabetDraft}
            onChange={(e) => setAlphabetDraft(e.target.value)}
            onBlur={() => setAlphabet(parseSymbols(alphabetDraft))}
          />
        </label>
        {automaton.kind === 'PDA' && (
          <label className="toolbar__field">
            <span>Alfabeto da pilha</span>
            <input
              className="mono"
              value={stackDraft}
              onChange={(e) => setStackDraft(e.target.value)}
              onBlur={() => setStackAlphabet(parseSymbols(stackDraft))}
              placeholder="Z, A"
            />
          </label>
        )}
        {automaton.kind === 'TM' && (
          <label className="toolbar__field">
            <span>Alfabeto da fita</span>
            <input
              className="mono"
              value={tapeDraft}
              onChange={(e) => setTapeDraft(e.target.value)}
              onBlur={() => setTapeAlphabet(parseTapeSymbols(tapeDraft))}
            />
          </label>
        )}
      </div>

      <div className="toolbar__group">
        <button className="btn btn-icon" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
          <span className="msy">undo</span>
        </button>
        <button className="btn btn-icon" onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)">
          <span className="msy">redo</span>
        </button>
        {automaton.kind === 'NFA' && (
          <button
            className="btn"
            onClick={handleConvert}
            title="Gera um novo AFD equivalente por construção de subconjuntos, em uma nova aba"
          >
            <span className="msy">bolt</span> Converter AFN → AFD
          </button>
        )}
        <button className="btn" onClick={handleImportClick}>
          <span className="msy">upload_file</span> Importar
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChange} />
        <button className="btn" onClick={() => exportAutomatonToFile(automaton)}>
          <span className="msy">download</span> Exportar
        </button>
        <button className="btn btn-icon" onClick={toggleTheme} title="Alternar tema">
          <span className="msy">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </div>

      {importError && (
        <div className="toolbar__error" onClick={() => setImportError(null)}>
          {importError}
        </div>
      )}
    </header>
  );
}
