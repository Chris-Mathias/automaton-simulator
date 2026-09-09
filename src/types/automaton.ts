export type AutomatonKind = 'DFA' | 'NFA' | 'PDA' | 'TM';

export const EPSILON = 'ε';

/** Turing machine blank symbol. Implicitly part of every tape alphabet. */
export const BLANK = '␣';

/** Turing machine head movement: left, right, or stay. */
export type TapeMove = 'L' | 'R' | 'S';

export const TAPE_MOVE_LABELS: Record<TapeMove, string> = { L: 'E', R: 'D', S: 'P' };

export interface AutomatonState {
  id: string;
  label: string;
  position: { x: number; y: number };
  isStart: boolean;
  isAccept: boolean;
}

export interface Transition {
  id: string;
  from: string;
  to: string;
  /** Alphabet symbol, or EPSILON for NFA/PDA epsilon-moves. For TM, the symbol read under the head. */
  input: string;
  /** PDA only: symbol popped off the stack. '' means no pop (epsilon on stack read). */
  pop?: string;
  /** PDA only: symbols pushed onto the stack, top-of-stack first. '' means nothing pushed. */
  push?: string;
  /** TM only: symbol written under the head. Undefined/'' keeps the symbol that was read. */
  write?: string;
  /** TM only: where the head moves after writing. */
  move?: TapeMove;
}

export interface Automaton {
  schemaVersion: 1;
  id: string;
  name: string;
  kind: AutomatonKind;
  alphabet: string[];
  /** PDA only. */
  stackAlphabet?: string[];
  /** TM only. Should contain the input alphabet; BLANK is always allowed on top of it. */
  tapeAlphabet?: string[];
  states: AutomatonState[];
  transitions: Transition[];
  startStateId: string | null;
}

export function createEmptyAutomaton(kind: AutomatonKind, name = 'Novo autômato'): Automaton {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name,
    kind,
    // Alphabets start empty and fill themselves in from the symbols typed on
    // transition labels, so a new automaton never carries symbols nobody asked
    // for. The PDA is the exception: its transitions are picked from dropdowns,
    // so it needs the conventional bottom-of-stack marker to start with.
    alphabet: [],
    stackAlphabet: kind === 'PDA' ? ['Z'] : undefined,
    tapeAlphabet: kind === 'TM' ? [] : undefined,
    states: [],
    transitions: [],
    startStateId: null,
  };
}

/** Caption for a single transition: `a` (AFD/AFN), `a, Z→AZ` (PDA), `a,A,D` (MT). */
export function formatTransitionLabel(kind: AutomatonKind, t: Transition): string {
  if (kind === 'PDA') return `${t.input}, ${t.pop || EPSILON}→${t.push || EPSILON}`;
  // On a TM the caption is exactly what you type into it, so editing a label
  // never means translating between two notations.
  if (kind === 'TM') {
    const move = t.move ? TAPE_MOVE_LABELS[t.move] : '?';
    return `${t.input},${t.write || t.input},${move}`;
  }
  return t.input;
}

/** Caption for every transition sharing a pair of states. */
export function formatTransitionLabels(kind: AutomatonKind, transitions: Transition[]): string {
  // TM captions already contain commas, so they're separated by semicolons.
  const separator = kind === 'TM' ? '; ' : ', ';
  return transitions.map((t) => formatTransitionLabel(kind, t)).join(separator);
}

export function isAutomaton(value: unknown): value is Automaton {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 1 &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    (v.kind === 'DFA' || v.kind === 'NFA' || v.kind === 'PDA' || v.kind === 'TM') &&
    Array.isArray(v.alphabet) &&
    Array.isArray(v.states) &&
    Array.isArray(v.transitions)
  );
}
