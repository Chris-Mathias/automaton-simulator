import { describe, expect, it } from 'vitest';
import {
  formatPdaTransitions,
  formatTuringTransitions,
  formatTwoStackTransitions,
  normalizeTapeSymbol,
  parsePdaTransitions,
  parseTuringTransitions,
  parseTwoStackTransitions,
} from './transitionSyntax';
import { BLANK, EPSILON } from '../types/automaton';

/** Unwraps a parse that is expected to succeed. */
function triples(text: string) {
  const parsed = parseTuringTransitions(text);
  if (!parsed.ok) throw new Error(`esperava sucesso, veio: ${parsed.error}`);
  return parsed.triples;
}

/** Unwraps a parse that is expected to fail. */
function error(text: string) {
  const parsed = parseTuringTransitions(text);
  if (parsed.ok) throw new Error(`esperava erro para "${text}"`);
  return parsed.error;
}

describe('parseTuringTransitions', () => {
  it('parses a single read,write,move triple', () => {
    expect(triples('a,A,D')).toEqual([{ input: 'a', write: 'A', move: 'R' }]);
  });

  it('parses multi-character symbols', () => {
    expect(triples('aa,bb,P')).toEqual([{ input: 'aa', write: 'bb', move: 'S' }]);
  });

  it('accepts typed aliases for the blank, which has no key on the keyboard', () => {
    expect(triples('_,beta,D')).toEqual([{ input: BLANK, write: BLANK, move: 'R' }]);
    expect(triples('β,branco,E')).toEqual([{ input: BLANK, write: BLANK, move: 'L' }]);
    expect(triples('BETA,Blank,P')).toEqual([{ input: BLANK, write: BLANK, move: 'S' }]);
  });

  it('leaves ordinary symbols alone', () => {
    expect(normalizeTapeSymbol('b')).toBe('b');
    expect(normalizeTapeSymbol('X')).toBe('X');
    expect(normalizeTapeSymbol(BLANK)).toBe(BLANK);
  });

  it('parses several triples separated by semicolons', () => {
    expect(triples('a,A,D; b,B,E')).toEqual([
      { input: 'a', write: 'A', move: 'R' },
      { input: 'b', write: 'B', move: 'L' },
    ]);
  });

  it('accepts the English move letters and any casing', () => {
    expect(triples('a,A,l')[0].move).toBe('L');
    expect(triples('a,A,R')[0].move).toBe('R');
    expect(triples('a,A,s')[0].move).toBe('S');
    expect(triples('a,A,e')[0].move).toBe('L');
  });

  it('ignores surrounding whitespace', () => {
    expect(triples('  a , A , D  ')).toEqual([{ input: 'a', write: 'A', move: 'R' }]);
  });

  it('treats empty text as "no transitions"', () => {
    expect(triples('')).toEqual([]);
    expect(triples('  ;  ')).toEqual([]);
  });

  it('rejects a triple with the wrong number of parts', () => {
    expect(error('a,A')).toContain('três partes');
    expect(error('a,A,D,E')).toContain('três partes');
    expect(error('a')).toContain('três partes');
  });

  it('rejects empty read or write symbols', () => {
    expect(error('a,,D')).toContain('não podem ficar vazios');
    expect(error(',A,D')).toContain('não podem ficar vazios');
  });

  it('rejects an unknown movement', () => {
    expect(error('a,A,X')).toContain('não é um movimento');
    expect(error('a,A,')).toContain('não é um movimento');
  });

  it('rejects the same symbol being read twice on one edge', () => {
    expect(error('a,A,D; a,B,E')).toContain('determinística');
  });
});

describe('formatTuringTransitions', () => {
  it('round-trips through the parser', () => {
    const text = 'a,A,D; b,B,E; c,C,P';
    expect(formatTuringTransitions(triples(text))).toBe(text);
  });

  it('renders a blank typed as an alias with its canonical glyph', () => {
    expect(formatTuringTransitions(triples('_,_,D'))).toBe(`${BLANK},${BLANK},D`);
  });
});

/** Unwraps a PDA parse that is expected to succeed. */
function pdaTriples(text: string) {
  const parsed = parsePdaTransitions(text);
  if (!parsed.ok) throw new Error(`esperava sucesso, veio: ${parsed.error}`);
  return parsed.triples;
}

/** The error from a PDA parse that is expected to fail. */
function pdaError(text: string): string {
  const parsed = parsePdaTransitions(text);
  if (parsed.ok) throw new Error('esperava falha, veio sucesso');
  return parsed.error;
}

describe('parsePdaTransitions', () => {
  it('reads a read/pop/push triple', () => {
    expect(pdaTriples('a,Z>AZ')).toEqual([{ input: 'a', pop: 'Z', push: 'AZ' }]);
  });

  it('accepts every spelling of the arrow', () => {
    const expected = [{ input: 'a', pop: 'Z', push: 'A' }];
    expect(pdaTriples('a,Z>A')).toEqual(expected);
    expect(pdaTriples('a,Z->A')).toEqual(expected);
    expect(pdaTriples('a,Z→A')).toEqual(expected);
  });

  it('reads several triples separated by semicolons, ignoring spacing', () => {
    expect(pdaTriples(' a,Z>AZ ;  b,A>ε ')).toEqual([
      { input: 'a', pop: 'Z', push: 'AZ' },
      { input: 'b', pop: 'A', push: '' },
    ]);
  });

  it('turns epsilon into the absence of a stack operation', () => {
    expect(pdaTriples('a,ε>ε')).toEqual([{ input: 'a', pop: '', push: '' }]);
  });

  it('expands typed aliases for epsilon in all three parts', () => {
    expect(pdaTriples('eps,vazio>epsilon')).toEqual([{ input: EPSILON, pop: '', push: '' }]);
  });

  it('allows one input symbol to take different stack actions, since a PDA is non-deterministic', () => {
    expect(pdaTriples('a,Z>AZ; a,Z>ε')).toEqual([
      { input: 'a', pop: 'Z', push: 'AZ' },
      { input: 'a', pop: 'Z', push: '' },
    ]);
  });

  it('rejects a triple repeated exactly', () => {
    expect(pdaError('a,Z>A; a,Z>A')).toContain('duas vezes');
  });

  it('rejects a pop of more than one symbol, which could never match the stack', () => {
    expect(pdaError('a,AB>C')).toContain('um símbolo por vez');
  });

  it('rejects an entry with no arrow', () => {
    expect(pdaError('a,Z,AZ')).toContain('seta');
  });

  it('rejects an entry missing the popped symbol', () => {
    expect(pdaError('a>AZ')).toContain('duas partes');
  });

  it('rejects an empty part instead of guessing it meant epsilon', () => {
    expect(pdaError('a,>Z')).toContain('vazia');
  });

  it('reads an empty label as no transitions at all', () => {
    expect(pdaTriples('')).toEqual([]);
  });
});

describe('formatPdaTransitions', () => {
  it('round-trips what was parsed', () => {
    expect(formatPdaTransitions(pdaTriples('a,Z>AZ; b,A>ε'))).toBe('a,Z→AZ; b,A→ε');
  });

  it('renders an absent stack operation as epsilon', () => {
    expect(formatPdaTransitions([{ input: 'a', pop: '', push: '' }])).toBe(`a,${EPSILON}→${EPSILON}`);
  });

  it('renders aliases and the typed arrow with their canonical glyphs', () => {
    expect(formatPdaTransitions(pdaTriples('eps,Z->A'))).toBe(`${EPSILON},Z→A`);
  });
});

function twoStackTriples(text: string) {
  const parsed = parseTwoStackTransitions(text);
  if (!parsed.ok) throw new Error(`esperava sucesso, veio: ${parsed.error}`);
  return parsed.triples;
}

function twoStackError(text: string) {
  const parsed = parseTwoStackTransitions(text);
  if (parsed.ok) throw new Error('esperava erro, mas o texto foi aceito');
  return parsed.error;
}

describe('parseTwoStackTransitions', () => {
  it('reads one operation per stack, separated by a bar', () => {
    expect(twoStackTriples('a, Z>AZ | Z>BZ')).toEqual([{ input: 'a', pop: 'Z', push: 'AZ', pop2: 'Z', push2: 'BZ' }]);
  });

  it('accepts every spelling of the arrow on either side', () => {
    const expected = [{ input: 'a', pop: 'Z', push: 'A', pop2: 'B', push2: '' }];
    expect(twoStackTriples('a,Z>A|B>ε')).toEqual(expected);
    expect(twoStackTriples('a,Z->A|B->ε')).toEqual(expected);
    expect(twoStackTriples('a,Z→A|B→ε')).toEqual(expected);
  });

  it('expands typed aliases for epsilon in all five parts', () => {
    expect(twoStackTriples('eps, vazio>epsilon | eps>vazio')).toEqual([
      { input: EPSILON, pop: '', push: '', pop2: '', push2: '' },
    ]);
  });

  it('reads several entries separated by semicolons, ignoring spacing', () => {
    expect(twoStackTriples(' a,ε>A|ε>ε ;  b,A>ε|ε>B ')).toEqual([
      { input: 'a', pop: '', push: 'A', pop2: '', push2: '' },
      { input: 'b', pop: 'A', push: '', pop2: '', push2: 'B' },
    ]);
  });

  it('allows one input symbol to take different stack actions', () => {
    expect(twoStackTriples('a,Z>AZ|ε>ε; a,Z>ε|ε>ε')).toHaveLength(2);
  });

  it('rejects an entry repeated exactly', () => {
    expect(twoStackError('a,Z>A|ε>ε; a,Z>A|ε>ε')).toContain('duas vezes');
  });

  it('rejects an entry with no bar', () => {
    expect(twoStackError('a,Z>AZ')).toContain('barra');
  });

  it('rejects more than one bar, since there are only two stacks', () => {
    expect(twoStackError('a,Z>A|Z>B|Z>C')).toContain('duas pilhas');
  });

  it('rejects a side with no arrow', () => {
    expect(twoStackError('a,Z,AZ|Z>B')).toContain('seta');
    expect(twoStackError('a,Z>AZ|Z,B')).toContain('seta');
  });

  it('rejects a read symbol after the bar, which belongs before the first arrow', () => {
    expect(twoStackError('a,Z>AZ|b,Z>B')).toContain('depois da barra');
  });

  it('rejects a first side missing the popped symbol', () => {
    expect(twoStackError('a>AZ|Z>B')).toContain('duas partes');
  });

  it('rejects an empty part instead of guessing it meant epsilon', () => {
    expect(twoStackError('a,>A|Z>B')).toContain('vazia');
    expect(twoStackError('a,Z>A|>B')).toContain('vazia');
    expect(twoStackError(',Z>A|Z>B')).toContain('vazia');
  });

  it('rejects a pop of more than one symbol on either stack', () => {
    expect(twoStackError('a,AB>C|ε>ε')).toContain('um símbolo por vez');
    expect(twoStackError('a,ε>ε|AB>C')).toContain('um símbolo por vez');
  });

  it('reads an empty label as no transitions at all', () => {
    expect(twoStackTriples('')).toEqual([]);
  });
});

describe('formatTwoStackTransitions', () => {
  it('round-trips what was parsed with canonical glyphs and spacing', () => {
    expect(formatTwoStackTransitions(twoStackTriples('a,Z->AZ|eps>B; b,A>ε|B>ε'))).toBe(
      `a, Z→AZ | ${EPSILON}→B; b, A→${EPSILON} | B→${EPSILON}`,
    );
  });

  it('renders absent operations on both stacks as epsilon', () => {
    expect(formatTwoStackTransitions([{ input: 'a', pop: '', push: '', pop2: '', push2: '' }])).toBe(
      `a, ${EPSILON}→${EPSILON} | ${EPSILON}→${EPSILON}`,
    );
  });
});
