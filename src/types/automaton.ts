export type AutomatonKind = 'DFA' | 'NFA' | 'PDA';

export const EPSILON = 'ε';

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
  /** Alphabet symbol, or EPSILON for NFA/PDA epsilon-moves. */
  input: string;
  /** PDA only: symbol popped off the stack. '' means no pop (epsilon on stack read). */
  pop?: string;
  /** PDA only: symbols pushed onto the stack, top-of-stack first. '' means nothing pushed. */
  push?: string;
}

export interface Automaton {
  schemaVersion: 1;
  id: string;
  name: string;
  kind: AutomatonKind;
  alphabet: string[];
  /** PDA only. */
  stackAlphabet?: string[];
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
    alphabet: ['0', '1'],
    stackAlphabet: kind === 'PDA' ? ['Z'] : undefined,
    states: [],
    transitions: [],
    startStateId: null,
  };
}

export function isAutomaton(value: unknown): value is Automaton {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 1 &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    (v.kind === 'DFA' || v.kind === 'NFA' || v.kind === 'PDA') &&
    Array.isArray(v.alphabet) &&
    Array.isArray(v.states) &&
    Array.isArray(v.transitions)
  );
}
