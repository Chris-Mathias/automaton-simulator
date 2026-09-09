import { BLANK, TAPE_MOVE_LABELS, type TapeMove } from '../types/automaton';

export interface TuringTriple {
  input: string;
  write: string;
  move: TapeMove;
}

/**
 * Accepted spellings for a head movement. The Portuguese initials are the
 * canonical ones (they're what the label renders), with the English/textbook
 * letters kept as aliases since most course material mixes both.
 */
const MOVE_ALIASES: Record<string, TapeMove> = {
  e: 'L', l: 'L', esquerda: 'L', left: 'L',
  d: 'R', r: 'R', direita: 'R', right: 'R',
  p: 'S', s: 'S', parado: 'S', stay: 'S', '-': 'S', '—': 'S',
};

/**
 * Typed aliases for the blank, since '␣' isn't on any keyboard — the same
 * accommodation the DFA/NFA labels make for 'ε'. Beta is what the Brazilian
 * textbooks write, underscore is the quickest to reach.
 *
 * Anything listed here can no longer be used as a tape symbol in its own right.
 */
const BLANK_ALIASES = new Set(['_', 'beta', 'β', 'branco', 'blank']);

export function normalizeTapeSymbol(raw: string): string {
  return BLANK_ALIASES.has(raw.toLowerCase()) ? BLANK : raw;
}

export const TURING_SYNTAX_PLACEHOLDER = 'lê,escreve,move';


/** The editable text for a group of transitions: `a,A,D; b,B,E`. */
export function formatTuringTransitions(transitions: TuringTriple[]): string {
  return transitions
    .map((t) => `${t.input},${t.write || t.input},${TAPE_MOVE_LABELS[t.move]}`)
    .join('; ');
}

export type TuringParseResult = { ok: true; triples: TuringTriple[] } | { ok: false; error: string };

/**
 * Parses what the user typed on a transition label. Anything that isn't a
 * well-formed list of triples is rejected outright rather than half-applied,
 * so a typo can never silently produce a transition that doesn't do what it
 * looks like it does.
 */
export function parseTuringTransitions(text: string): TuringParseResult {
  const entries = text
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const triples: TuringTriple[] = [];
  const seenInputs = new Set<string>();

  for (const entry of entries) {
    const parts = entry.split(',').map((part) => part.trim());
    if (parts.length !== 3) {
      return {
        ok: false,
        error: `"${entry}" precisa ter três partes separadas por vírgula: lê,escreve,move.`,
      };
    }

    const [rawInput, rawWrite, rawMove] = parts;
    const input = normalizeTapeSymbol(rawInput);
    const write = normalizeTapeSymbol(rawWrite);
    if (!input || !write) {
      return { ok: false, error: `Em "${entry}", o símbolo lido e o escrito não podem ficar vazios.` };
    }

    const move = MOVE_ALIASES[rawMove.toLowerCase()];
    if (!move) {
      return { ok: false, error: `"${rawMove}" não é um movimento — use E (esquerda), D (direita) ou P (parado).` };
    }

    if (seenInputs.has(input)) {
      return { ok: false, error: `"${input}" é lido duas vezes aqui; a máquina é determinística.` };
    }
    seenInputs.add(input);

    triples.push({ input, write, move });
  }

  return { ok: true, triples };
}
