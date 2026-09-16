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

/** Even-length palindromes w wᴿ: guesses the middle with an ε-move, so every step branches. */
const palindromePda: Automaton = {
  schemaVersion: 1,
  id: 'pda-2',
  name: 'w wᴿ',
  kind: 'PDA',
  alphabet: ['a', 'b'],
  stackAlphabet: ['Z', 'a', 'b'],
  startStateId: 'q0',
  states: [
    { id: 'q0', label: 'q0', position: pos(0, 0), isStart: true, isAccept: false },
    { id: 'q1', label: 'q1', position: pos(100, 0), isStart: false, isAccept: false },
    { id: 'q2', label: 'q2', position: pos(200, 0), isStart: false, isAccept: false },
    { id: 'q3', label: 'q3', position: pos(300, 0), isStart: false, isAccept: true },
  ],
  transitions: [
    { id: 'p1', from: 'q0', to: 'q1', input: EPSILON, pop: '', push: 'Z' },
    { id: 'p2', from: 'q1', to: 'q1', input: 'a', pop: '', push: 'a' },
    { id: 'p3', from: 'q1', to: 'q1', input: 'b', pop: '', push: 'b' },
    { id: 'p4', from: 'q1', to: 'q2', input: EPSILON, pop: '', push: '' },
    { id: 'p5', from: 'q2', to: 'q2', input: 'a', pop: 'a', push: '' },
    { id: 'p6', from: 'q2', to: 'q2', input: 'b', pop: 'b', push: '' },
    { id: 'p7', from: 'q2', to: 'q3', input: EPSILON, pop: 'Z', push: '' },
  ],
};

describe('simulate - PDA branch lineage', () => {
  it('reports the configurations with no move on the symbol read as dead', () => {
    const { steps } = simulate(palindromePda, 'abba');
    expect(steps[0].deadBranches).toBeUndefined();
    expect(steps[1].deadBranches?.map((b) => b.key)).toEqual(['q0::', 'q2::Z', 'q3::']);
    expect(steps[2].deadBranches?.map((b) => b.key)).toEqual(['q2::aZ']);
    expect(steps[3].deadBranches).toEqual([]);
  });

  it('links every configuration to the one it came from, through ε-moves too', () => {
    const { steps, accepted } = simulate(palindromePda, 'abba');
    expect(accepted).toBe(true);
    expect(steps[0].branches.every((b) => b.parentKey === undefined)).toBe(true);
    // q1 pushes 'a' on reading it; q2 is reached from that by the ε guess, but still descends from q1::Z.
    expect(steps[1].branches.map((b) => [b.key, b.parentKey])).toEqual([
      ['q1::aZ', 'q1::Z'],
      ['q2::aZ', 'q1::Z'],
    ]);
    // The accepting branch popped its way down from q2::aZ.
    expect(steps[4].branches.find((b) => b.stateId === 'q3')?.parentKey).toBe('q2::aZ');
  });

  it('lists every surviving branch as dead when the whole run dies', () => {
    const { steps } = simulate(anbnPda, 'ba');
    const last = steps.at(-1)!;
    expect(last.branches).toEqual([]);
    expect(last.deadBranches?.map((b) => b.stateId).sort()).toEqual(['q0', 'q1', 'qf', 'qs']);
  });
});

/**
 * aⁿbⁿcⁿ (n ≥ 0): the a's pile up on stack 1, each b moves one over to stack 2,
 * each c takes one off stack 2. Not context-free, so a single stack couldn't do it.
 */
const anbncnTwoStack: Automaton = {
  schemaVersion: 1,
  id: '2pda-1',
  name: 'a^n b^n c^n',
  kind: '2PDA',
  alphabet: ['a', 'b', 'c'],
  stackAlphabet: ['Z', 'A', 'B'],
  startStateId: 'qs',
  states: [
    { id: 'qs', label: 'qs', position: pos(0, 0), isStart: true, isAccept: false },
    { id: 'q0', label: 'q0', position: pos(100, 0), isStart: false, isAccept: false },
    { id: 'q1', label: 'q1', position: pos(200, 0), isStart: false, isAccept: false },
    { id: 'q2', label: 'q2', position: pos(300, 0), isStart: false, isAccept: false },
    { id: 'qf', label: 'qf', position: pos(400, 0), isStart: false, isAccept: true },
  ],
  transitions: [
    { id: 's1', from: 'qs', to: 'q0', input: EPSILON, pop: '', push: 'Z', pop2: '', push2: 'Z' },
    { id: 's2', from: 'q0', to: 'q0', input: 'a', pop: '', push: 'A', pop2: '', push2: '' },
    { id: 's3', from: 'q0', to: 'q1', input: EPSILON, pop: '', push: '', pop2: '', push2: '' },
    { id: 's4', from: 'q1', to: 'q1', input: 'b', pop: 'A', push: '', pop2: '', push2: 'B' },
    { id: 's5', from: 'q1', to: 'q2', input: EPSILON, pop: '', push: '', pop2: '', push2: '' },
    { id: 's6', from: 'q2', to: 'q2', input: 'c', pop: '', push: '', pop2: 'B', push2: '' },
    { id: 's7', from: 'q2', to: 'qf', input: EPSILON, pop: 'Z', push: '', pop2: 'Z', push2: '' },
  ],
};

/** One move that pops from both stacks; `setup` decides what each stack starts with. */
function bothStacksMachine(setup: { push: string; push2: string }): Automaton {
  return {
    schemaVersion: 1,
    id: '2pda-2',
    name: 'ambas',
    kind: '2PDA',
    alphabet: ['a'],
    stackAlphabet: ['A', 'B'],
    startStateId: 'qs',
    states: [
      { id: 'qs', label: 'qs', position: pos(0, 0), isStart: true, isAccept: false },
      { id: 'q0', label: 'q0', position: pos(100, 0), isStart: false, isAccept: false },
      { id: 'qf', label: 'qf', position: pos(200, 0), isStart: false, isAccept: true },
    ],
    transitions: [
      { id: 'b1', from: 'qs', to: 'q0', input: EPSILON, pop: '', push: setup.push, pop2: '', push2: setup.push2 },
      { id: 'b2', from: 'q0', to: 'qf', input: 'a', pop: 'A', push: '', pop2: 'B', push2: '' },
    ],
  };
}

describe('simulate - 2PDA (a^n b^n c^n)', () => {
  it('accepts the empty string and balanced strings', () => {
    expect(simulate(anbncnTwoStack, '').accepted).toBe(true);
    expect(simulate(anbncnTwoStack, 'abc').accepted).toBe(true);
    expect(simulate(anbncnTwoStack, 'aabbcc').accepted).toBe(true);
    expect(simulate(anbncnTwoStack, 'aaabbbccc').accepted).toBe(true);
  });

  it('rejects strings a single stack would let through', () => {
    expect(simulate(anbncnTwoStack, 'aabbc').accepted).toBe(false);
    expect(simulate(anbncnTwoStack, 'abcc').accepted).toBe(false);
    expect(simulate(anbncnTwoStack, 'aabbbccc').accepted).toBe(false);
  });

  it('rejects out-of-order strings', () => {
    expect(simulate(anbncnTwoStack, 'acb').accepted).toBe(false);
    expect(simulate(anbncnTwoStack, 'abbc').accepted).toBe(false);
  });

  it('carries both stacks on every branch and keys the branch by both', () => {
    const { steps } = simulate(anbncnTwoStack, 'ab');
    const q1 = steps[2].branches.find((b) => b.stateId === 'q1')!;
    expect(q1.stack).toEqual(['Z']);
    expect(q1.stack2).toEqual(['B', 'Z']);
    expect(q1.key).toBe('q1::Z::BZ');
  });
});

describe('simulate - 2PDA stack matching', () => {
  it('fires only when both pops match', () => {
    expect(simulate(bothStacksMachine({ push: 'A', push2: 'B' }), 'a').accepted).toBe(true);
  });

  it('dies when only the first stack matches, and reports the branch as dead', () => {
    const { accepted, steps } = simulate(bothStacksMachine({ push: 'A', push2: '' }), 'a');
    expect(accepted).toBe(false);
    expect(steps[1].branches).toEqual([]);
    expect(steps[1].deadBranches?.map((b) => b.stateId)).toEqual(['qs', 'q0']);
  });

  it('dies when only the second stack matches', () => {
    expect(simulate(bothStacksMachine({ push: '', push2: 'B' }), 'a').accepted).toBe(false);
  });

  it('keeps configurations apart when only the second stack differs', () => {
    const forked: Automaton = {
      ...bothStacksMachine({ push: '', push2: '' }),
      transitions: [
        { id: 'f1', from: 'qs', to: 'q0', input: EPSILON, pop: '', push: '', pop2: '', push2: 'X' },
        { id: 'f2', from: 'qs', to: 'q0', input: EPSILON, pop: '', push: '', pop2: '', push2: 'Y' },
      ],
    };
    const { steps } = simulate(forked, '');
    expect(steps[0].branches.map((b) => b.key)).toEqual(['qs::::', 'q0::::X', 'q0::::Y']);
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
