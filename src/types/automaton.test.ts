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
