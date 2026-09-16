import { BLANK, EPSILON, TAPE_MOVE_LABELS, type TapeMove } from '../types/automaton';

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

/** Typed aliases for the epsilon transition, since ε isn't on most keyboards. */
const EPSILON_ALIASES = new Set(['eps', 'epsilon', 'vazio']);

export function normalizeSymbol(raw: string): string {
  return EPSILON_ALIASES.has(raw.toLowerCase()) ? EPSILON : raw;
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

export interface PdaTriple {
  input: string;
  /** Symbol popped off the stack. '' means no pop. */
  pop: string;
  /** Symbols pushed, top-of-stack first. '' means nothing pushed. */
  push: string;
}

/** The canonical arrow a stack operation renders with. */
const STACK_ARROW = '→';

/**
 * Spellings accepted for that arrow while typing, since '→' isn't on any
 * keyboard — the same accommodation made for 'ε' and '␣'. Longest first, so
 * '->' isn't split as '-' followed by '>'.
 */
const STACK_ARROW_PATTERN = /->|→|>/;

export const PDA_SYNTAX_PLACEHOLDER = 'lê,desempilha>empilha';

/** The editable text for a group of transitions: `a,Z→AZ; b,A→ε`. */
export function formatPdaTransitions(transitions: PdaTriple[]): string {
  return transitions
    .map((t) => `${t.input || EPSILON},${t.pop || EPSILON}${STACK_ARROW}${t.push || EPSILON}`)
    .join('; ');
}

export type PdaParseResult = { ok: true; triples: PdaTriple[] } | { ok: false; error: string };

type ParseFailure = { ok: false; error: string };

function emptyPartError(entry: string): ParseFailure {
  return {
    ok: false,
    error: `Em "${entry}", nenhuma das partes pode ficar vazia — escreva ${EPSILON} onde não há símbolo.`,
  };
}

/** Splits `x→y` on its arrow, rejecting anything but exactly one arrow. */
function splitArrow(
  text: string,
  entry: string,
  placeholder: string,
): { ok: true; left: string; right: string } | ParseFailure {
  const sides = text.split(STACK_ARROW_PATTERN);
  if (sides.length !== 2) {
    return {
      ok: false,
      error: `"${entry}" precisa de uma seta separando o que sai e o que entra na pilha: ${placeholder}.`,
    };
  }
  return { ok: true, left: sides[0], right: sides[1] };
}

/**
 * One `desempilha→empilha` operation, shared by the one- and two-stack parsers
 * so they never disagree on what a stack action may look like.
 */
function parseStackOp(popRaw: string, pushRaw: string, entry: string): { ok: true; pop: string; push: string } | ParseFailure {
  const pop = normalizeSymbol(popRaw.trim());
  const push = normalizeSymbol(pushRaw.trim());

  if (!pop || !push) return emptyPartError(entry);

  // The engine pops a single symbol (`stack[0] === pop`) and pushes one per
  // character (`push.split('')`), so a longer pop could never match anything
  // that was pushed. Rejecting it here makes that limit visible instead of
  // producing a transition that silently never fires.
  if (pop !== EPSILON && pop.length !== 1) {
    return {
      ok: false,
      error: `"${pop}" não serve para desempilhar: sai um símbolo por vez da pilha.`,
    };
  }

  return { ok: true, pop: pop === EPSILON ? '' : pop, push: push === EPSILON ? '' : push };
}

/**
 * Parses what the user typed on a PDA transition label. Unlike the Turing
 * parser, repeating an input symbol is allowed: a PDA is non-deterministic, so
 * `a,Z→AZ; a,Z→ε` is a legitimate pair of choices. Only an exactly repeated
 * triple is rejected, since it would add nothing.
 */
export function parsePdaTransitions(text: string): PdaParseResult {
  const entries = text
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const triples: PdaTriple[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const arrow = splitArrow(entry, entry, PDA_SYNTAX_PLACEHOLDER);
    if (!arrow.ok) return arrow;

    const readParts = arrow.left.split(',').map((part) => part.trim());
    if (readParts.length !== 2) {
      return {
        ok: false,
        error: `Em "${entry}", antes da seta vêm duas partes separadas por vírgula: o símbolo lido e o desempilhado.`,
      };
    }

    const input = normalizeSymbol(readParts[0]);
    if (!input) return emptyPartError(entry);

    const op = parseStackOp(readParts[1], arrow.right, entry);
    if (!op.ok) return op;

    const triple: PdaTriple = { input, pop: op.pop, push: op.push };

    const key = `${triple.input}|${triple.pop}|${triple.push}`;
    if (seen.has(key)) {
      return { ok: false, error: `"${entry}" aparece duas vezes aqui.` };
    }
    seen.add(key);

    triples.push(triple);
  }

  return { ok: true, triples };
}

export interface TwoStackTriple {
  input: string;
  /** Symbol popped off the first stack. '' means no pop. */
  pop: string;
  /** Symbols pushed onto the first stack, top-of-stack first. '' means nothing pushed. */
  push: string;
  /** Symbol popped off the second stack. '' means no pop. */
  pop2: string;
  /** Symbols pushed onto the second stack, top-of-stack first. '' means nothing pushed. */
  push2: string;
}

/** What separates the two stacks' operations on a label. */
const STACK_SEPARATOR = '|';

export const TWO_STACK_SYNTAX_PLACEHOLDER = 'lê, desempilha>empilha | desempilha>empilha';

/** The editable text for a group of transitions: `a, Z→AZ | ε→B; b, A→ε | B→ε`. */
export function formatTwoStackTransitions(transitions: TwoStackTriple[]): string {
  return transitions
    .map(
      (t) =>
        `${t.input || EPSILON}, ${t.pop || EPSILON}${STACK_ARROW}${t.push || EPSILON}` +
        ` ${STACK_SEPARATOR} ${t.pop2 || EPSILON}${STACK_ARROW}${t.push2 || EPSILON}`,
    )
    .join('; ');
}

export type TwoStackParseResult = { ok: true; triples: TwoStackTriple[] } | { ok: false; error: string };

/**
 * Parses a two-stack label: the PDA syntax for the first stack, a bar, then
 * only the operation on the second stack. The symbol read appears once, before
 * the first arrow. Like the PDA, only an exactly repeated entry is rejected.
 */
export function parseTwoStackTransitions(text: string): TwoStackParseResult {
  const entries = text
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const triples: TwoStackTriple[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const stacks = entry.split(STACK_SEPARATOR);
    if (stacks.length < 2) {
      return {
        ok: false,
        error: `Em "${entry}" faltou a barra separando as duas pilhas: ${TWO_STACK_SYNTAX_PLACEHOLDER}.`,
      };
    }
    if (stacks.length > 2) {
      return { ok: false, error: `Em "${entry}" há mais de uma barra, mas só há duas pilhas.` };
    }

    const first = splitArrow(stacks[0].trim(), entry, TWO_STACK_SYNTAX_PLACEHOLDER);
    if (!first.ok) return first;

    const readParts = first.left.split(',').map((part) => part.trim());
    if (readParts.length !== 2) {
      return {
        ok: false,
        error: `Em "${entry}", antes da primeira seta vêm duas partes separadas por vírgula: o símbolo lido e o desempilhado da pilha 1.`,
      };
    }

    const input = normalizeSymbol(readParts[0]);
    if (!input) return emptyPartError(entry);

    const op1 = parseStackOp(readParts[1], first.right, entry);
    if (!op1.ok) return op1;

    const second = splitArrow(stacks[1].trim(), entry, TWO_STACK_SYNTAX_PLACEHOLDER);
    if (!second.ok) return second;
    if (second.left.includes(',')) {
      return {
        ok: false,
        error: `Em "${entry}", depois da barra vem só a operação da pilha 2: desempilha>empilha.`,
      };
    }

    const op2 = parseStackOp(second.left, second.right, entry);
    if (!op2.ok) return op2;

    const triple: TwoStackTriple = { input, pop: op1.pop, push: op1.push, pop2: op2.pop, push2: op2.push };

    const key = `${triple.input}|${triple.pop}|${triple.push}|${triple.pop2}|${triple.push2}`;
    if (seen.has(key)) {
      return { ok: false, error: `"${entry}" aparece duas vezes aqui.` };
    }
    seen.add(key);

    triples.push(triple);
  }

  return { ok: true, triples };
}
