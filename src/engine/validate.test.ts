import { describe, expect, it } from 'vitest';
import { validate } from './validate';
import { createEmptyAutomaton, EPSILON, type Automaton } from '../types/automaton';

describe('validate', () => {
  it('flags a missing start state and missing accept state on an empty automaton', () => {
    const automaton = createEmptyAutomaton('DFA');
    const issues = validate(automaton);
    expect(issues.some((i) => i.id === 'no-start')).toBe(true);
    expect(issues.some((i) => i.id === 'no-accept')).toBe(true);
  });

  it('flags unreachable states', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('DFA'),
      startStateId: 'q0',
      states: [
        { id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: true },
        { id: 'q1', label: 'q1', position: { x: 100, y: 0 }, isStart: false, isAccept: false },
      ],
      transitions: [],
    };
    const issues = validate(automaton);
    expect(issues.some((i) => i.id === 'unreachable-q1')).toBe(true);
  });

  it('flags DFA non-determinism (two transitions on the same symbol from a state)', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('DFA'),
      alphabet: ['0'],
      startStateId: 'q0',
      states: [
        { id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
        { id: 'q1', label: 'q1', position: { x: 100, y: 0 }, isStart: false, isAccept: true },
        { id: 'q2', label: 'q2', position: { x: 200, y: 0 }, isStart: false, isAccept: false },
      ],
      transitions: [
        { id: 't1', from: 'q0', to: 'q1', input: '0' },
        { id: 't2', from: 'q0', to: 'q2', input: '0' },
      ],
    };
    const issues = validate(automaton);
    expect(issues.some((i) => i.id === 'nondeterminism-q0-0')).toBe(true);
  });

  it('flags DFA incompleteness (missing a transition for a symbol)', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('DFA'),
      alphabet: ['0', '1'],
      startStateId: 'q0',
      states: [{ id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: true }],
      transitions: [{ id: 't1', from: 'q0', to: 'q0', input: '0' }],
    };
    const issues = validate(automaton);
    expect(issues.some((i) => i.id === 'incomplete-q0-1')).toBe(true);
  });

  it('flags a transition whose symbol is not in the declared alphabet', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('NFA'),
      alphabet: ['0', '1'],
      startStateId: 'q0',
      states: [
        { id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
        { id: 'q1', label: 'q1', position: { x: 100, y: 0 }, isStart: false, isAccept: true },
      ],
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: '2' }],
    };
    const issues = validate(automaton);
    expect(issues.some((i) => i.id === 'symbol-outside-alphabet-t1')).toBe(true);
  });

  it('does not flag epsilon transitions as outside the alphabet', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('NFA'),
      alphabet: ['0', '1'],
      startStateId: 'q0',
      states: [
        { id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
        { id: 'q1', label: 'q1', position: { x: 100, y: 0 }, isStart: false, isAccept: true },
      ],
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: EPSILON }],
    };
    const issues = validate(automaton);
    expect(issues.some((i) => i.id.startsWith('symbol-outside-alphabet'))).toBe(false);
  });

  it('returns no issues for a well-formed, complete DFA', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('DFA'),
      alphabet: ['0', '1'],
      startStateId: 'q0',
      states: [
        { id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
        { id: 'q1', label: 'q1', position: { x: 100, y: 0 }, isStart: false, isAccept: true },
      ],
      transitions: [
        { id: 't1', from: 'q0', to: 'q0', input: '0' },
        { id: 't2', from: 'q0', to: 'q1', input: '1' },
        { id: 't3', from: 'q1', to: 'q0', input: '0' },
        { id: 't4', from: 'q1', to: 'q1', input: '1' },
      ],
    };
    expect(validate(automaton)).toHaveLength(0);
  });
});
