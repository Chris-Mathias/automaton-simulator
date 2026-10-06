export type AutomatonKind = 'DFA' | 'NFA' | 'PDA' | '2PDA' | 'TM';

export const EPSILON = 'ε';

/** Turing machine blank symbol. Implicitly part of every tape alphabet. */
export const BLANK = '␣';

/** Turing machine head movement: left, right, or stay. */
export type TapeMove = 'L' | 'R' | 'S';

export const TAPE_MOVE_LABELS: Record<TapeMove, string> = { L: 'E', R: 'D', S: 'P' };

/** Kinds whose configurations carry a stack: the one-stack PDA and the two-stack 2PDA. */
export function hasStack(kind: AutomatonKind): boolean {
  return kind === 'PDA' || kind === '2PDA';
}

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
  /** 2PDA only: symbol popped off the second stack. '' means no pop. */
  pop2?: string;
  /** 2PDA only: symbols pushed onto the second stack, top-of-stack first. '' means nothing pushed. */
  push2?: string;
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
    // for.
    alphabet: [],
    stackAlphabet: hasStack(kind) ? [] : undefined,
    tapeAlphabet: kind === 'TM' ? [] : undefined,
    states: [],
    transitions: [],
    startStateId: null,
  };
}

/** Caption for a single transition: `a` (AFD/AFN), `a, Z→AZ` (PDA), `a,A,D` (MT). */
export function formatTransitionLabel(kind: AutomatonKind, t: Transition): string {
  if (kind === 'PDA') return `${t.input}, ${t.pop || EPSILON}→${t.push || EPSILON}`;
  if (kind === '2PDA') {
    return `${t.input}, ${t.pop || EPSILON}→${t.push || EPSILON} | ${t.pop2 || EPSILON}→${t.push2 || EPSILON}`;
  }
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
  // TM and PDA captions already contain commas, so they're separated by
  // semicolons — `a, Z→AZ, b, A→ε` gives no way to tell where one ends.
  const separator = kind === 'TM' || hasStack(kind) ? '; ' : ', ';
  return transitions.map((t) => formatTransitionLabel(kind, t)).join(separator);
}

/**
 * Generous ceilings no hand-built automaton gets near, but low enough that a
 * crafted file can't freeze the tab in validation, layout or simulation.
 */
export const AUTOMATON_LIMITS = {
  states: 1000,
  transitions: 10000,
  symbols: 500,
  textLength: 500,
  coordinate: 10_000_000,
} as const;

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= AUTOMATON_LIMITS.textLength;
}

function isCoordinate(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= AUTOMATON_LIMITS.coordinate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSymbolList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= AUTOMATON_LIMITS.symbols && value.every(isText);
}

function isOptionalText(value: unknown): boolean {
  return value === undefined || isText(value);
}

function isState(value: unknown): value is AutomatonState {
  if (!isRecord(value) || !isRecord(value.position)) return false;
  return (
    isText(value.id) &&
    isText(value.label) &&
    isCoordinate(value.position.x) &&
    isCoordinate(value.position.y) &&
    typeof value.isStart === 'boolean' &&
    typeof value.isAccept === 'boolean'
  );
}

function isTransition(value: unknown, stateIds: Set<string>): value is Transition {
  if (!isRecord(value)) return false;
  return (
    isText(value.id) &&
    typeof value.from === 'string' &&
    typeof value.to === 'string' &&
    stateIds.has(value.from) &&
    stateIds.has(value.to) &&
    isText(value.input) &&
    isOptionalText(value.pop) &&
    isOptionalText(value.push) &&
    isOptionalText(value.pop2) &&
    isOptionalText(value.push2) &&
    isOptionalText(value.write) &&
    (value.move === undefined || value.move === 'L' || value.move === 'R' || value.move === 'S')
  );
}

/**
 * Validates the whole structure, not just the top level: imported files and
 * the persisted workspace are untrusted, and a malformed state or dangling
 * transition would otherwise crash rendering on every reload.
 */
export function isAutomaton(value: unknown): value is Automaton {
  if (!isRecord(value)) return false;
  if (
    value.schemaVersion !== 1 ||
    !isText(value.id) ||
    !isText(value.name) ||
    !(value.kind === 'DFA' || value.kind === 'NFA' || value.kind === 'PDA' || value.kind === '2PDA' || value.kind === 'TM') ||
    !isSymbolList(value.alphabet) ||
    (value.stackAlphabet !== undefined && !isSymbolList(value.stackAlphabet)) ||
    (value.tapeAlphabet !== undefined && !isSymbolList(value.tapeAlphabet)) ||
    !Array.isArray(value.states) ||
    !Array.isArray(value.transitions) ||
    value.states.length > AUTOMATON_LIMITS.states ||
    value.transitions.length > AUTOMATON_LIMITS.transitions ||
    !value.states.every(isState)
  ) {
    return false;
  }
  const stateIds = new Set(value.states.map((s) => s.id));
  if (stateIds.size !== value.states.length) return false;
  if (value.startStateId !== null && !(typeof value.startStateId === 'string' && stateIds.has(value.startStateId))) return false;
  return value.transitions.every((t) => isTransition(t, stateIds));
}
