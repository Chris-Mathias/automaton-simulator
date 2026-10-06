import { describe, expect, it } from 'vitest';
import {
  EPSILON,
  createEmptyAutomaton,
  formatTransitionLabel,
  formatTransitionLabels,
  hasStack,
  isAutomaton,
  type Transition,
} from './automaton';

function twoStack(overrides: Partial<Transition>): Transition {
  return { id: 't', from: 'q0', to: 'q1', input: 'a', pop: '', push: '', pop2: '', push2: '', ...overrides };
}

describe('2PDA model', () => {
  it('starts with an empty shared stack alphabet and no tape', () => {
    const automaton = createEmptyAutomaton('2PDA');
    expect(automaton.stackAlphabet).toEqual([]);
    expect(automaton.tapeAlphabet).toBeUndefined();
  });

  it('counts as a stack automaton alongside the PDA', () => {
    expect(hasStack('PDA')).toBe(true);
    expect(hasStack('2PDA')).toBe(true);
    expect(hasStack('DFA')).toBe(false);
    expect(hasStack('NFA')).toBe(false);
    expect(hasStack('TM')).toBe(false);
  });

  it('is accepted by the import guard', () => {
    expect(isAutomaton(createEmptyAutomaton('2PDA'))).toBe(true);
  });
});

describe('formatTransitionLabel - 2PDA', () => {
  it('renders both stack operations separated by a bar', () => {
    const t = twoStack({ pop: 'Z', push: 'AZ', push2: 'B' });
    expect(formatTransitionLabel('2PDA', t)).toBe(`a, Z→AZ | ${EPSILON}→B`);
  });

  it('renders an absent operation on both stacks as epsilon', () => {
    expect(formatTransitionLabel('2PDA', twoStack({}))).toBe(`a, ${EPSILON}→${EPSILON} | ${EPSILON}→${EPSILON}`);
  });

  it('separates the transitions of one edge with semicolons, since each already has commas', () => {
    const a = twoStack({ id: 'a', pop: 'Z', push: 'AZ' });
    const b = twoStack({ id: 'b', input: 'b', pop2: 'B' });
    expect(formatTransitionLabels('2PDA', [a, b])).toBe(
      `a, Z→AZ | ${EPSILON}→${EPSILON}; b, ${EPSILON}→${EPSILON} | B→${EPSILON}`,
    );
  });
});

describe('isAutomaton - structural validation', () => {
  function valid(): Record<string, unknown> {
    return {
      schemaVersion: 1,
      id: 'a',
      name: 'Teste',
      kind: 'PDA',
      alphabet: ['a', 'b'],
      stackAlphabet: ['Z'],
      states: [
        { id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
        { id: 'q1', label: 'q1', position: { x: 100, y: 50 }, isStart: false, isAccept: true },
      ],
      transitions: [{ id: 't0', from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ' }],
      startStateId: 'q0',
    };
  }

  it('accepts a well-formed automaton', () => {
    expect(isAutomaton(valid())).toBe(true);
  });

  it('accepts a Turing machine transition with write and move', () => {
    const tm = {
      ...valid(),
      kind: 'TM',
      stackAlphabet: undefined,
      tapeAlphabet: ['a'],
      transitions: [{ id: 't0', from: 'q0', to: 'q1', input: 'a', write: 'b', move: 'R' }],
    };
    expect(isAutomaton(tm)).toBe(true);
  });

  it('rejects a state without a numeric position', () => {
    const a = valid();
    (a.states as Record<string, unknown>[])[0].position = { x: '0', y: 0 };
    expect(isAutomaton(a)).toBe(false);
  });

  it('rejects a state with a non-finite coordinate', () => {
    const a = valid();
    (a.states as Record<string, unknown>[])[0].position = { x: 0, y: Infinity };
    expect(isAutomaton(a)).toBe(false);
  });

  it('rejects a state missing its flags', () => {
    const a = valid();
    delete (a.states as Record<string, unknown>[])[1].isAccept;
    expect(isAutomaton(a)).toBe(false);
  });

  it('rejects duplicated state ids', () => {
    const a = valid();
    (a.states as Record<string, unknown>[])[1].id = 'q0';
    expect(isAutomaton(a)).toBe(false);
  });

  it('rejects a transition pointing to a state that does not exist', () => {
    const a = valid();
    (a.transitions as Record<string, unknown>[])[0].to = 'q9';
    expect(isAutomaton(a)).toBe(false);
  });

  it('rejects a transition with a non-string stack operation', () => {
    const a = valid();
    (a.transitions as Record<string, unknown>[])[0].push = 42;
    expect(isAutomaton(a)).toBe(false);
  });

  it('rejects an unknown head movement', () => {
    const a = valid();
    (a.transitions as Record<string, unknown>[])[0].move = 'X';
    expect(isAutomaton(a)).toBe(false);
  });

  it('rejects a start state id that does not exist', () => {
    expect(isAutomaton({ ...valid(), startStateId: 'q9' })).toBe(false);
  });

  it('rejects alphabets with non-string symbols', () => {
    expect(isAutomaton({ ...valid(), alphabet: ['a', 1] })).toBe(false);
    expect(isAutomaton({ ...valid(), stackAlphabet: [null] })).toBe(false);
  });
});
