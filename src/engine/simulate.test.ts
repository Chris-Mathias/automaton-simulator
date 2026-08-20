import { describe, expect, it } from 'vitest';
import { simulate } from './simulate';
import { EPSILON, type Automaton } from '../types/automaton';

function pos(x: number, y: number) {
  return { x, y };
}

/** Binary strings that end in '1'. */
const endsIn1Dfa: Automaton = {
  schemaVersion: 1,
  id: 'dfa-1',
  name: 'Termina em 1',
  kind: 'DFA',
  alphabet: ['0', '1'],
  startStateId: 'q0',
  states: [
    { id: 'q0', label: 'q0', position: pos(0, 0), isStart: true, isAccept: false },
    { id: 'q1', label: 'q1', position: pos(100, 0), isStart: false, isAccept: true },
  ],
  transitions: [
    { id: 't1', from: 'q0', to: 'q0', input: '0' },
    { id: 't2', from: 'q0', to: 'q1', input: '1' },
    { id: 't3', from: 'q1', to: 'q0', input: '0' },
    { id: 't4', from: 'q1', to: 'q1', input: '1' },
  ],
};

/**
 * NFA from the course's reference diagram: q1 -0-> q2, q2 -1-> q1, q2 -1-> q3,
 * q1 -0-> q3, q3 -1-> qf. Note q1 has two transitions on '0' (to q2 and q3),
 * which is only valid for an NFA.
 */
const referenceNfa: Automaton = {
  schemaVersion: 1,
  id: 'nfa-1',
  name: 'Diagrama de referência',
  kind: 'NFA',
  alphabet: ['0', '1'],
  startStateId: 'q1',
  states: [
    { id: 'q1', label: 'q1', position: pos(0, 0), isStart: true, isAccept: false },
    { id: 'q2', label: 'q2', position: pos(100, 0), isStart: false, isAccept: false },
    { id: 'q3', label: 'q3', position: pos(200, 0), isStart: false, isAccept: false },
    { id: 'qf', label: 'qf', position: pos(300, 0), isStart: false, isAccept: true },
  ],
  transitions: [
    { id: 't1', from: 'q1', to: 'q2', input: '0' },
    { id: 't2', from: 'q2', to: 'q1', input: '1' },
    { id: 't3', from: 'q2', to: 'q3', input: '1' },
    { id: 't4', from: 'q1', to: 'q3', input: '0' },
    { id: 't5', from: 'q3', to: 'qf', input: '1' },
  ],
};

/** a^n b^n (n >= 0), accept by final state, using a Z bottom-of-stack marker. */
const anbnPda: Automaton = {
  schemaVersion: 1,
  id: 'pda-1',
  name: 'a^n b^n',
  kind: 'PDA',
  alphabet: ['a', 'b'],
  stackAlphabet: ['Z', 'A'],
  startStateId: 'qs',
  states: [
    { id: 'qs', label: 'qs', position: pos(0, 0), isStart: true, isAccept: false },
    { id: 'q0', label: 'q0', position: pos(100, 0), isStart: false, isAccept: false },
    { id: 'q1', label: 'q1', position: pos(200, 0), isStart: false, isAccept: false },
    { id: 'qf', label: 'qf', position: pos(300, 0), isStart: false, isAccept: true },
  ],
  transitions: [
    { id: 't1', from: 'qs', to: 'q0', input: EPSILON, pop: '', push: 'Z' },
    { id: 't2', from: 'q0', to: 'q0', input: 'a', pop: '', push: 'A' },
    { id: 't3', from: 'q0', to: 'q1', input: EPSILON, pop: '', push: '' },
    { id: 't4', from: 'q1', to: 'q1', input: 'b', pop: 'A', push: '' },
    { id: 't5', from: 'q1', to: 'qf', input: EPSILON, pop: 'Z', push: '' },
  ],
};

describe('simulate - DFA', () => {
  it('accepts strings ending in 1', () => {
    expect(simulate(endsIn1Dfa, '1').accepted).toBe(true);
    expect(simulate(endsIn1Dfa, '101').accepted).toBe(true);
  });

  it('rejects strings ending in 0 or the empty string', () => {
    expect(simulate(endsIn1Dfa, '10').accepted).toBe(false);
    expect(simulate(endsIn1Dfa, '').accepted).toBe(false);
  });

  it('produces one step per input symbol plus the initial step', () => {
    const result = simulate(endsIn1Dfa, '101');
    expect(result.steps).toHaveLength(4);
    expect(result.steps[0].symbolConsumed).toBeNull();
    expect(result.steps[1].symbolConsumed).toBe('1');
  });
});

describe('simulate - NFA (reference diagram)', () => {
  it('rejects "0" (ends in q2/q3, neither accepting)', () => {
    expect(simulate(referenceNfa, '0').accepted).toBe(false);
  });

  it('accepts "01" via q1-0->q2-1->q3... no, via q1-0->q3 is a dead end but q1-0->q2-1->q1 branch reaches qf through the other path', () => {
    expect(simulate(referenceNfa, '01').accepted).toBe(true);
  });

  it('rejects "00" (no transitions on 0 from q2 or q3)', () => {
    expect(simulate(referenceNfa, '00').accepted).toBe(false);
  });
});

describe('simulate - PDA (a^n b^n)', () => {
  it('accepts the empty string', () => {
    expect(simulate(anbnPda, '').accepted).toBe(true);
  });

  it('accepts balanced strings', () => {
    expect(simulate(anbnPda, 'ab').accepted).toBe(true);
    expect(simulate(anbnPda, 'aabb').accepted).toBe(true);
    expect(simulate(anbnPda, 'aaabbb').accepted).toBe(true);
  });

  it('rejects unbalanced strings', () => {
    expect(simulate(anbnPda, 'aab').accepted).toBe(false);
    expect(simulate(anbnPda, 'aaab').accepted).toBe(false);
    expect(simulate(anbnPda, 'abb').accepted).toBe(false);
  });

  it('rejects out-of-order strings', () => {
    expect(simulate(anbnPda, 'ba').accepted).toBe(false);
  });
});

describe('simulate - edge cases', () => {
  it('returns an empty trace when there is no start state', () => {
    const noStart: Automaton = { ...endsIn1Dfa, startStateId: null };
    const result = simulate(noStart, '1');
    expect(result.steps).toHaveLength(0);
    expect(result.accepted).toBe(false);
  });
});
