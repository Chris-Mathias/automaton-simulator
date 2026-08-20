import { describe, expect, it } from 'vitest';
import { convertNfaToDfa } from './convertNfaToDfa';
import { simulate } from './simulate';
import { EPSILON, type Automaton } from '../types/automaton';

const referenceNfa: Automaton = {
  schemaVersion: 1,
  id: 'nfa-1',
  name: 'Diagrama de referência',
  kind: 'NFA',
  alphabet: ['0', '1'],
  startStateId: 'q1',
  states: [
    { id: 'q1', label: 'q1', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
    { id: 'q2', label: 'q2', position: { x: 100, y: 0 }, isStart: false, isAccept: false },
    { id: 'q3', label: 'q3', position: { x: 200, y: 0 }, isStart: false, isAccept: false },
    { id: 'qf', label: 'qf', position: { x: 300, y: 0 }, isStart: false, isAccept: true },
  ],
  transitions: [
    { id: 't1', from: 'q1', to: 'q2', input: '0' },
    { id: 't2', from: 'q2', to: 'q1', input: '1' },
    { id: 't3', from: 'q2', to: 'q3', input: '1' },
    { id: 't4', from: 'q1', to: 'q3', input: '0' },
    { id: 't5', from: 'q3', to: 'qf', input: '1' },
  ],
};

const nfaWithEpsilon: Automaton = {
  schemaVersion: 1,
  id: 'nfa-eps',
  name: 'a ou b, com epsilon',
  kind: 'NFA',
  alphabet: ['a', 'b'],
  startStateId: 'q0',
  states: [
    { id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
    { id: 'q1', label: 'q1', position: { x: 100, y: 0 }, isStart: false, isAccept: false },
    { id: 'q2', label: 'q2', position: { x: 200, y: 0 }, isStart: false, isAccept: true },
  ],
  transitions: [
    { id: 't1', from: 'q0', to: 'q1', input: EPSILON },
    { id: 't2', from: 'q1', to: 'q2', input: 'a' },
    { id: 't3', from: 'q0', to: 'q2', input: 'b' },
  ],
};

describe('convertNfaToDfa', () => {
  it('throws when given a non-NFA automaton', () => {
    expect(() => convertNfaToDfa({ ...referenceNfa, kind: 'DFA' })).toThrow();
  });

  it('throws when the NFA has no start state', () => {
    expect(() => convertNfaToDfa({ ...referenceNfa, startStateId: null })).toThrow();
  });

  it('produces a DFA with no non-determinism or ε-transitions', () => {
    const dfa = convertNfaToDfa(referenceNfa);
    expect(dfa.kind).toBe('DFA');
    expect(dfa.transitions.every((t) => t.input !== EPSILON)).toBe(true);
    for (const state of dfa.states) {
      const symbols = dfa.transitions.filter((t) => t.from === state.id).map((t) => t.input);
      expect(new Set(symbols).size).toBe(symbols.length);
    }
  });

  it('is language-equivalent to the source NFA across sample strings', () => {
    const dfa = convertNfaToDfa(referenceNfa);
    for (const input of ['', '0', '01', '00', '001', '011', '0101']) {
      expect(simulate(dfa, input).accepted).toBe(simulate(referenceNfa, input).accepted);
    }
  });

  it('handles ε-transitions correctly (subset construction with ε-closure)', () => {
    const dfa = convertNfaToDfa(nfaWithEpsilon);
    for (const input of ['a', 'b', 'ab', 'ba', '']) {
      expect(simulate(dfa, input).accepted).toBe(simulate(nfaWithEpsilon, input).accepted);
    }
  });
});
