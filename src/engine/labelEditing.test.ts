import { describe, expect, it } from 'vitest';
import { planPdaEdit, planSymbolEdit, planTuringEdit } from './labelEditing';
import { BLANK, EPSILON, createEmptyAutomaton, type Automaton } from '../types/automaton';

function withStates(kind: 'DFA' | 'NFA' | 'PDA' | 'TM'): Automaton {
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
    expect(edit.newInputSymbols).toEqual(['a', 'b']);
  });

  it('only reports symbols the alphabet is missing', () => {
    const automaton = { ...withStates('DFA'), alphabet: ['a'] };
    expect(planSymbolEdit(automaton, 'q0', 'q1', 'a,b').newInputSymbols).toEqual(['b']);
  });

  it('never adds epsilon to the alphabet', () => {
    const edit = planSymbolEdit(withStates('NFA'), 'q0', 'q1', `a,${EPSILON}`);
    expect(edit.newInputSymbols).toEqual(['a']);
  });

  it('expands typed aliases for epsilon', () => {
    const edit = planSymbolEdit(withStates('NFA'), 'q0', 'q1', 'eps');
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: EPSILON }]);
    expect(edit.newInputSymbols).toEqual([]);
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
    expect(edit.newTapeSymbols).toEqual(['a', 'X']);
  });

  it('fills the input alphabet from the symbols read, but not the ones written', () => {
    const edit = planTuringEdit(withStates('TM'), 'q0', 'q1', 'a,X,D; b,Y,E')!;
    expect(edit.newInputSymbols).toEqual(['a', 'b']);
  });

  it('never adds the blank to the tape alphabet, since it is implicit', () => {
    const edit = planTuringEdit(withStates('TM'), 'q0', 'q1', '_,_,D')!;
    expect(edit.newTapeSymbols).toEqual([]);
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: BLANK, write: BLANK, move: 'R' }]);
  });

  it('leaves written-only markers out of the input alphabet', () => {
    // Nothing reads A or B yet, so they stay on the tape alphabet alone.
    const edit = planTuringEdit(withStates('TM'), 'q0', 'q1', 'a,A,D; b,B,E')!;
    expect(edit.newInputSymbols).toEqual(['a', 'b']);
    expect(edit.newTapeSymbols).toEqual(['a', 'A', 'b', 'B']);
  });

  it('picks a marker up once some transition reads it back', () => {
    // The moment the machine scans back over what it wrote, that marker is a
    // symbol read — indistinguishable, here, from real input.
    const automaton = { ...withStates('TM'), alphabet: ['a', 'b'], tapeAlphabet: ['A', 'B', 'a', 'b'] };
    const edit = planTuringEdit(automaton, 'q1', 'q1', 'A,A,D')!;
    expect(edit.newInputSymbols).toEqual(['A']);
  });

  it('keeps the blank out of the input alphabet, which must not contain it', () => {
    expect(planTuringEdit(withStates('TM'), 'q0', 'q1', '_,a,D')!.newInputSymbols).toEqual([]);
  });

  it('only reports symbols the alphabets are missing', () => {
    const automaton = { ...withStates('TM'), alphabet: ['a'], tapeAlphabet: ['a', 'X'] };
    const edit = planTuringEdit(automaton, 'q0', 'q1', 'a,X,D; b,Y,E')!;
    expect(edit.newInputSymbols).toEqual(['b']);
    expect(edit.newTapeSymbols).toEqual(['b', 'Y']);
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

describe('planPdaEdit', () => {
  it('adds a typed triple and declares the symbols it uses', () => {
    const edit = planPdaEdit(withStates('PDA'), 'q0', 'q1', 'a,Z>AZ')!;
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ' }]);
    expect(edit.newInputSymbols).toEqual(['a']);
    expect(edit.newStackSymbols).toEqual(['Z', 'A']);
  });

  it('treats every pushed character as its own stack symbol', () => {
    expect(planPdaEdit(withStates('PDA'), 'q0', 'q1', 'a,ε>ABC')!.newStackSymbols).toEqual(['A', 'B', 'C']);
  });

  it('never declares epsilon as a symbol of either alphabet', () => {
    const edit = planPdaEdit(withStates('PDA'), 'q0', 'q1', 'eps,ε>ε')!;
    expect(edit.newInputSymbols).toEqual([]);
    expect(edit.newStackSymbols).toEqual([]);
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: EPSILON, pop: '', push: '' }]);
  });

  it('only reports symbols the alphabets are missing', () => {
    const automaton = { ...withStates('PDA'), alphabet: ['a'], stackAlphabet: ['Z'] };
    const edit = planPdaEdit(automaton, 'q0', 'q1', 'a,Z>AZ')!;
    expect(edit.newInputSymbols).toEqual([]);
    expect(edit.newStackSymbols).toEqual(['A']);
  });

  it('leaves an unchanged triple alone', () => {
    const automaton: Automaton = {
      ...withStates('PDA'),
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ' }],
    };
    const edit = planPdaEdit(automaton, 'q0', 'q1', 'a,Z>AZ')!;
    expect(edit.add).toEqual([]);
    expect(edit.remove).toEqual([]);
  });

  it('removes a triple dropped from the label', () => {
    const automaton: Automaton = {
      ...withStates('PDA'),
      transitions: [
        { id: 't1', from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ' },
        { id: 't2', from: 'q0', to: 'q1', input: 'b', pop: 'A', push: '' },
      ],
    };
    const edit = planPdaEdit(automaton, 'q0', 'q1', 'a,Z>AZ')!;
    expect(edit.remove).toEqual(['t2']);
    expect(edit.add).toEqual([]);
  });

  it('replaces rather than patches when a stack action changes, since the symbol alone is not an identity', () => {
    const automaton: Automaton = {
      ...withStates('PDA'),
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ' }],
    };
    const edit = planPdaEdit(automaton, 'q0', 'q1', 'a,Z>BZ')!;
    expect(edit.update).toEqual([]);
    expect(edit.remove).toEqual(['t1']);
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'BZ' }]);
  });

  it('keeps both branches when one symbol takes two different stack actions', () => {
    const automaton: Automaton = {
      ...withStates('PDA'),
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ' }],
    };
    const edit = planPdaEdit(automaton, 'q0', 'q1', 'a,Z>AZ; a,Z>ε')!;
    expect(edit.remove).toEqual([]);
    expect(edit.add).toEqual([{ from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: '' }]);
  });

  it('changes nothing at all when the text does not parse', () => {
    expect(planPdaEdit(withStates('PDA'), 'q0', 'q1', 'a,Z')).toBeNull();
  });

  it('clears every transition when the label is emptied', () => {
    const automaton: Automaton = {
      ...withStates('PDA'),
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: 'a', pop: 'Z', push: 'AZ' }],
    };
    expect(planPdaEdit(automaton, 'q0', 'q1', '')!.remove).toEqual(['t1']);
  });
});
