import { describe, expect, it } from 'vitest';
import { formatTuringTransitions, normalizeTapeSymbol, parseTuringTransitions } from './transitionSyntax';
import { BLANK } from '../types/automaton';

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
