import { BLANK, EPSILON, type Automaton, type Transition } from '../types/automaton';
import { parseTuringTransitions } from './transitionSyntax';

/** Typed aliases for the epsilon transition, since ε isn't on most keyboards. */
const EPSILON_ALIASES = new Set(['eps', 'epsilon', 'vazio']);

export function normalizeSymbol(raw: string): string {
  return EPSILON_ALIASES.has(raw.toLowerCase()) ? EPSILON : raw;
}

/** The change a committed transition label makes to the automaton. */
export interface TransitionEdit {
  remove: string[];
  update: { id: string; patch: Partial<Omit<Transition, 'id'>> }[];
  add: Omit<Transition, 'id'>[];
  /**
   * Symbols typed here that the relevant alphabet doesn't declare yet — the
   * input alphabet for a DFA/NFA, the tape alphabet for a TM. Keeping them in
   * sync means a symbol used on the canvas is never treated as foreign to the
   * automaton that uses it (AFN→AFD conversion only iterates declared symbols).
   */
  newSymbols: string[];
}

/** DFA/NFA: the label is a comma-separated list of input symbols. */
export function planSymbolEdit(automaton: Automaton, from: string, to: string, csv: string): TransitionEdit {
  const symbols = [
    ...new Set(
      csv
        .split(',')
        .map((s) => normalizeSymbol(s.trim()))
        .filter(Boolean),
    ),
  ].sort();

  const existing = automaton.transitions.filter((t) => t.from === from && t.to === to);
  const existingInputs = new Set(existing.map((t) => t.input));

  return {
    remove: existing.filter((t) => !symbols.includes(t.input)).map((t) => t.id),
    update: [],
    add: symbols.filter((s) => !existingInputs.has(s)).map((input) => ({ from, to, input })),
    newSymbols: symbols.filter((s) => s !== EPSILON && !automaton.alphabet.includes(s)),
  };
}

/**
 * TM: the label is a list of `read,write,move` triples. Returns null when the
 * text doesn't parse, so a malformed edit changes nothing at all.
 */
export function planTuringEdit(
  automaton: Automaton,
  from: string,
  to: string,
  text: string,
): TransitionEdit | null {
  const parsed = parseTuringTransitions(text);
  if (!parsed.ok) return null;

  const existing = automaton.transitions.filter((t) => t.from === from && t.to === to);
  const byInput = new Map(existing.map((t) => [t.input, t]));

  const edit: TransitionEdit = { remove: [], update: [], add: [], newSymbols: [] };
  const kept = new Set<string>();

  for (const { input, write, move } of parsed.triples) {
    kept.add(input);
    // Reconcile by the symbol read, so editing a triple's write or move keeps
    // the transition's identity instead of replacing it with a new one.
    const current = byInput.get(input);
    if (!current) edit.add.push({ from, to, input, write, move });
    else if (current.write !== write || current.move !== move) {
      edit.update.push({ id: current.id, patch: { write, move } });
    }
  }

  edit.remove = existing.filter((t) => !kept.has(t.input)).map((t) => t.id);

  const tapeAlphabet = automaton.tapeAlphabet ?? [];
  const used = new Set(parsed.triples.flatMap((t) => [t.input, t.write]));
  edit.newSymbols = [...used].filter((s) => s !== BLANK && !tapeAlphabet.includes(s));

  return edit;
}
