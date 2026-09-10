import { describe, expect, it } from 'vitest';
import { planSymbolEdit, planTuringEdit } from './labelEditing';
import { BLANK, EPSILON, createEmptyAutomaton, type Automaton } from '../types/automaton';

function withStates(kind: 'DFA' | 'NFA' | 'TM'): Automaton {
  return {
    ...createEmptyAutomaton(kind),
    startStateId: 'q0',
    states: [
      { id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
      { id: 'q1', label: 'q1', position: { x: 100, y: 0 }, isStart: false, isAccept: true },
    ],
  };
}

describe('planSymbolEdit', () => {
  it('adds symbols typed on a label to an empty input alphabet', () => {
    const edit = planSymbolEdit(withStates('DFA'), 'q0', 'q1', 'a,b');
    expect(edit.add).toEqual([
      { from: 'q0', to: 'q1', input: 'a' },
      { from: 'q0', to: 'q1', input: 'b' },
    ]);
    expect(edit.newSymbols).toEqual(['a', 'b']);
  });

  it('only reports symbols the alphabet is missing', () => {
    const automaton = { ...withStates('DFA'), alphabet: ['a'] };
    expect(planSymbolEdit(automaton, 'q0', 'q1', 'a,b').newSymbols).toEqual(['b']);
  });

  it('never adds epsilon to the alphabet', () => {
    const edit = planSymbolEdit(withStates('NFA'), 'q0', 'q1', `a,${EPSILON}`);
    expect(edit.newSymbols).toEqual(['a']);
  });

  it('expands typed aliases for epsilon', () => {
    const edit = planSymbolEdit(withStates('NFA'), 'q0', 'q1', 'eps');
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: EPSILON }]);
    expect(edit.newSymbols).toEqual([]);
  });

  it('removes the transitions whose symbols were deleted from the label', () => {
    const automaton: Automaton = {
      ...withStates('DFA'),
      alphabet: ['a', 'b'],
      transitions: [
        { id: 't1', from: 'q0', to: 'q1', input: 'a' },
        { id: 't2', from: 'q0', to: 'q1', input: 'b' },
      ],
    };
    const edit = planSymbolEdit(automaton, 'q0', 'q1', 'a');
    expect(edit.remove).toEqual(['t2']);
    expect(edit.add).toEqual([]);
  });
});

describe('planTuringEdit', () => {
  it('adds read and write symbols to an empty tape alphabet', () => {
    const edit = planTuringEdit(withStates('TM'), 'q0', 'q1', 'a,X,D')!;
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: 'a', write: 'X', move: 'R' }]);
    expect(edit.newSymbols).toEqual(['a', 'X']);
  });

  it('never adds the blank to the tape alphabet, since it is implicit', () => {
    const edit = planTuringEdit(withStates('TM'), 'q0', 'q1', '_,_,D')!;
    expect(edit.newSymbols).toEqual([]);
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: BLANK, write: BLANK, move: 'R' }]);
  });

  it('leaves the input alphabet alone — it cannot tell markers from input symbols', () => {
    const automaton = withStates('TM');
    planTuringEdit(automaton, 'q0', 'q1', 'a,X,D');
    expect(automaton.alphabet).toEqual([]);
  });

  it('keeps a transition identity when only its write or move changes', () => {
    const automaton: Automaton = {
      ...withStates('TM'),
      tapeAlphabet: ['a', 'X'],
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: 'a', write: 'X', move: 'R' }],
    };
    const edit = planTuringEdit(automaton, 'q0', 'q1', 'a,a,E')!;
    expect(edit.update).toEqual([{ id: 't1', patch: { write: 'a', move: 'L' } }]);
    expect(edit.add).toEqual([]);
    expect(edit.remove).toEqual([]);
  });

  it('changes nothing at all when the text does not parse', () => {
    expect(planTuringEdit(withStates('TM'), 'q0', 'q1', 'a,X')).toBeNull();
  });
});
