import { describe, expect, it } from 'vitest';
import { validate } from './validate';
import { BLANK, createEmptyAutomaton, EPSILON, type Automaton } from '../types/automaton';

describe('createEmptyAutomaton', () => {
  it('starts every alphabet empty, to be filled in from the transitions typed', () => {
    expect(createEmptyAutomaton('DFA').alphabet).toEqual([]);
    expect(createEmptyAutomaton('TM').alphabet).toEqual([]);
    expect(createEmptyAutomaton('TM').tapeAlphabet).toEqual([]);
    expect(createEmptyAutomaton('PDA').stackAlphabet).toEqual([]);
  });
});

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

  describe('Turing machine', () => {
    const base: Automaton = {
      ...createEmptyAutomaton('TM'),
      alphabet: ['a'],
      tapeAlphabet: ['a', 'X'],
      startStateId: 'q0',
      states: [
        { id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
        { id: 'acc', label: 'acc', position: { x: 100, y: 0 }, isStart: false, isAccept: true },
      ],
      transitions: [{ id: 't1', from: 'q0', to: 'acc', input: 'a', write: 'X', move: 'R' }],
    };

    it('accepts a well-formed machine', () => {
      expect(validate(base)).toHaveLength(0);
    });

    it('does not warn about states without a transition for every symbol', () => {
      // Unlike a DFA, a missing move is a legitimate halt (and rejection).
      expect(validate(base).some((i) => i.id.startsWith('incomplete-'))).toBe(false);
    });

    it('allows reading and writing the blank without declaring it', () => {
      const automaton: Automaton = {
        ...base,
        transitions: [{ id: 't1', from: 'q0', to: 'acc', input: BLANK, write: BLANK, move: 'S' }],
      };
      expect(validate(automaton)).toHaveLength(0);
    });

    it('flags symbols outside the tape alphabet', () => {
      const automaton: Automaton = {
        ...base,
        transitions: [{ id: 't1', from: 'q0', to: 'acc', input: 'z', write: 'y', move: 'R' }],
      };
      const issues = validate(automaton);
      expect(issues.some((i) => i.id === 'tm-read-outside-tape-t1')).toBe(true);
      expect(issues.some((i) => i.id === 'tm-write-outside-tape-t1')).toBe(true);
      // The input-alphabet message is written in AFN→AFD terms and doesn't apply here.
      expect(issues.some((i) => i.id.startsWith('symbol-outside-alphabet'))).toBe(false);
    });

    it('flags an epsilon transition', () => {
      const automaton: Automaton = {
        ...base,
        transitions: [{ id: 't1', from: 'q0', to: 'acc', input: EPSILON, write: 'X', move: 'R' }],
      };
      expect(validate(automaton).some((i) => i.id === 'tm-epsilon-t1')).toBe(true);
    });

    it('flags a transition with no head movement', () => {
      const automaton: Automaton = {
        ...base,
        transitions: [{ id: 't1', from: 'q0', to: 'acc', input: 'a', write: 'X' }],
      };
      expect(validate(automaton).some((i) => i.id === 'tm-no-move-t1')).toBe(true);
    });

    it('flags two transitions leaving the same state on the same symbol', () => {
      const automaton: Automaton = {
        ...base,
        transitions: [
          { id: 't1', from: 'q0', to: 'acc', input: 'a', write: 'X', move: 'R' },
          { id: 't2', from: 'q0', to: 'q0', input: 'a', write: 'a', move: 'L' },
        ],
      };
      expect(validate(automaton).some((i) => i.id === 'tm-nondeterminism-q0-a')).toBe(true);
    });

    it('warns when an input symbol is missing from the tape alphabet', () => {
      const automaton: Automaton = { ...base, alphabet: ['a', 'b'] };
      expect(validate(automaton).some((i) => i.id === 'input-not-on-tape-b')).toBe(true);
    });

    it('warns when the blank is declared as an input symbol', () => {
      const automaton: Automaton = { ...base, alphabet: ['a', BLANK] };
      expect(validate(automaton).some((i) => i.id === 'blank-in-input-alphabet')).toBe(true);
    });
  });
});
