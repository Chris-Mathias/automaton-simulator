import { describe, expect, it } from 'vitest';
import { simulate } from './simulate';
import { MAX_TM_STEPS } from './simulateTuring';
import { BLANK, type Automaton, type AutomatonState, type Transition } from '../types/automaton';

let seq = 0;

function state(id: string, opts: { start?: boolean; accept?: boolean } = {}): AutomatonState {
  return { id, label: id, position: { x: 0, y: 0 }, isStart: !!opts.start, isAccept: !!opts.accept };
}

/** `q0 a > b R q1` — from, read, write, move, to. */
function tr(from: string, input: string, write: string, move: 'L' | 'R' | 'S', to: string): Transition {
  seq += 1;
  return { id: `t${seq}`, from, to, input, write, move };
}

function tm(states: AutomatonState[], transitions: Transition[], tapeAlphabet: string[]): Automaton {
  return {
    schemaVersion: 1,
    id: `tm-${seq}`,
    name: 'MT',
    kind: 'TM',
    alphabet: ['a', 'b'],
    tapeAlphabet,
    startStateId: states.find((s) => s.isStart)?.id ?? null,
    states,
    transitions,
  };
}

function finalTape(automaton: Automaton, input: string) {
  const result = simulate(automaton, input);
  const last = result.steps[result.steps.length - 1].branches[0];
  return { result, tape: last.tape!.join(''), head: last.head! };
}

/** L = { aⁿbⁿ | n ≥ 0 }, marking matched pairs with X and Y. */
const anbn = tm(
  [state('q0', { start: true }), state('q1'), state('q2'), state('q3'), state('acc', { accept: true })],
  [
    tr('q0', 'a', 'X', 'R', 'q1'),
    tr('q0', 'Y', 'Y', 'R', 'q3'),
    tr('q0', BLANK, BLANK, 'S', 'acc'),
    tr('q1', 'a', 'a', 'R', 'q1'),
    tr('q1', 'Y', 'Y', 'R', 'q1'),
    tr('q1', 'b', 'Y', 'L', 'q2'),
    tr('q2', 'a', 'a', 'L', 'q2'),
    tr('q2', 'Y', 'Y', 'L', 'q2'),
    tr('q2', 'X', 'X', 'R', 'q0'),
    tr('q3', 'Y', 'Y', 'R', 'q3'),
    tr('q3', BLANK, BLANK, 'S', 'acc'),
  ],
  ['a', 'b', 'X', 'Y'],
);

/** Increments a binary number written on the tape, then rewinds past its left end. */
const increment = tm(
  [state('q0', { start: true }), state('q1'), state('q2'), state('acc', { accept: true })],
  [
    tr('q0', '0', '0', 'R', 'q0'),
    tr('q0', '1', '1', 'R', 'q0'),
    tr('q0', BLANK, BLANK, 'L', 'q1'),
    tr('q1', '1', '0', 'L', 'q1'),
    tr('q1', '0', '1', 'L', 'q2'),
    tr('q1', BLANK, '1', 'L', 'q2'),
    tr('q2', '0', '0', 'L', 'q2'),
    tr('q2', '1', '1', 'L', 'q2'),
    tr('q2', BLANK, BLANK, 'R', 'acc'),
  ],
  ['0', '1'],
);

describe('simulateTuring', () => {
  it('accepts strings in aⁿbⁿ', () => {
    for (const input of ['', 'ab', 'aabb', 'aaabbb']) {
      const result = simulate(anbn, input);
      expect(result.accepted, `esperava aceitar "${input}"`).toBe(true);
      expect(result.haltReason).toBe('accept');
      expect(result.truncated).toBe(false);
    }
  });

  it('rejects strings outside aⁿbⁿ by halting with no applicable transition', () => {
    for (const input of ['a', 'b', 'aab', 'abb', 'ba', 'aba']) {
      const result = simulate(anbn, input);
      expect(result.accepted, `esperava rejeitar "${input}"`).toBe(false);
      expect(result.haltReason).toBe('no-transition');
    }
  });

  it('writes to the tape and grows the window leftwards past the input', () => {
    const { result, tape, head } = finalTape(increment, '1011');
    expect(result.accepted).toBe(true);
    expect(tape).toBe(`${BLANK}1100${BLANK}`);
    // The head sits on the first digit, one cell right of the blank just prepended.
    expect(head).toBe(1);
  });

  it('grows the window rightwards when the head runs off the end', () => {
    const { tape } = finalTape(increment, '11');
    expect(tape).toBe(`${BLANK}100${BLANK}`);
  });

  it('treats an empty input as a single blank cell', () => {
    const step0 = simulate(anbn, '').steps[0].branches[0];
    expect(step0.tape).toEqual([BLANK]);
    expect(step0.head).toBe(0);
  });

  it('records one step per machine move, with the symbol read', () => {
    const result = simulate(anbn, 'ab');
    expect(result.steps[0].symbolConsumed).toBeNull();
    expect(result.steps[1].symbolConsumed).toBe('a');
    expect(result.steps[1].branches[0].viaTransitionIds).toHaveLength(1);
    // Every step carries exactly one configuration: the machine is deterministic.
    expect(result.steps.every((s) => s.branches.length === 1)).toBe(true);
  });

  it('halts on entering an accept state even when transitions out of it exist', () => {
    const machine = tm(
      [state('q0', { start: true, accept: true })],
      [tr('q0', BLANK, BLANK, 'R', 'q0')],
      [],
    );
    const result = simulate(machine, '');
    expect(result.accepted).toBe(true);
    expect(result.steps).toHaveLength(1);
  });

  it('truncates a machine that never halts instead of looping forever', () => {
    const looping = tm([state('q0', { start: true })], [tr('q0', BLANK, BLANK, 'R', 'q0')], []);
    const result = simulate(looping, '');
    expect(result.accepted).toBe(false);
    expect(result.truncated).toBe(true);
    expect(result.haltReason).toBe('step-limit');
    expect(result.steps.length).toBeLessThanOrEqual(MAX_TM_STEPS + 1);
  });

  it('returns an empty run when no start state is set', () => {
    const result = simulate({ ...anbn, startStateId: null }, 'ab');
    expect(result.steps).toEqual([]);
    expect(result.accepted).toBe(false);
  });
});
