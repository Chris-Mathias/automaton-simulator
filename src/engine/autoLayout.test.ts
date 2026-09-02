import { describe, expect, it } from 'vitest';
import { computeAutoLayout, computeLayers } from './autoLayout';
import { createEmptyAutomaton, type Automaton } from '../types/automaton';

function state(id: string, isStart = false, isAccept = false): Automaton['states'][number] {
  return { id, label: id, position: { x: 0, y: 0 }, isStart, isAccept };
}

describe('computeLayers', () => {
  it('assigns shortest-hop distance from the start state, ignoring self-loops', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('DFA'),
      startStateId: 'q0',
      states: [state('q0', true), state('q1'), state('q2')],
      transitions: [
        { id: 't1', from: 'q0', to: 'q1', input: '0' },
        { id: 't2', from: 'q1', to: 'q2', input: '1' },
        { id: 't3', from: 'q2', to: 'q2', input: '0' }, // self-loop
      ],
    };
    const layers = computeLayers(automaton, 'q0');
    expect(layers.get('q0')).toBe(0);
    expect(layers.get('q1')).toBe(1);
    expect(layers.get('q2')).toBe(2);
  });

  it('omits states unreachable from the start', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('DFA'),
      startStateId: 'q0',
      states: [state('q0', true), state('dead')],
      transitions: [],
    };
    expect(computeLayers(automaton, 'q0').has('dead')).toBe(false);
  });

  it('takes the shortest of multiple paths to the same state', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('DFA'),
      startStateId: 'q0',
      states: [state('q0', true), state('q1'), state('q2'), state('q3')],
      transitions: [
        { id: 't1', from: 'q0', to: 'q1', input: '0' },
        { id: 't2', from: 'q1', to: 'q2', input: '0' },
        { id: 't3', from: 'q2', to: 'q3', input: '0' },
        { id: 't4', from: 'q0', to: 'q3', input: '1' }, // direct shortcut
      ],
    };
    expect(computeLayers(automaton, 'q0').get('q3')).toBe(1);
  });
});

describe('computeAutoLayout', () => {
  it('returns nothing for an automaton with no states', () => {
    expect(computeAutoLayout(createEmptyAutomaton('DFA')).size).toBe(0);
  });

  it('always places the start state in the leftmost column, even with a back-edge into it', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('DFA'),
      startStateId: 'q0',
      states: [state('q0', true), state('q1'), state('q2')],
      transitions: [
        { id: 't1', from: 'q0', to: 'q1', input: '0' },
        { id: 't2', from: 'q1', to: 'q2', input: '1' },
        { id: 't3', from: 'q2', to: 'q0', input: '0' }, // back-edge into the start state
      ],
    };
    const positions = computeAutoLayout(automaton);
    const startX = positions.get('q0')!.x;
    for (const s of automaton.states) {
      if (s.id === 'q0') continue;
      expect(positions.get(s.id)!.x).toBeGreaterThan(startX);
    }
  });

  it('never overlaps two states, including ones unreachable from the start', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('DFA'),
      startStateId: 'q0',
      states: [state('q0', true), state('q1'), state('dead')],
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: '0' }],
    };
    const positions = computeAutoLayout(automaton);
    const seen = new Set<string>();
    for (const [, pos] of positions) {
      const key = `${pos.x},${pos.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    // The unreachable state still lands to the right of the start state, never before it.
    expect(positions.get('dead')!.x).toBeGreaterThan(positions.get('q0')!.x);
  });

  it('snaps every position to the grid', () => {
    const automaton: Automaton = {
      ...createEmptyAutomaton('DFA'),
      startStateId: 'q0',
      states: [state('q0', true), state('q1'), state('q2')],
      transitions: [
        { id: 't1', from: 'q0', to: 'q1', input: '0' },
        { id: 't2', from: 'q0', to: 'q2', input: '1' },
      ],
    };
    for (const [, pos] of computeAutoLayout(automaton)) {
      expect(Math.abs(pos.x % 22)).toBe(0);
      expect(Math.abs(pos.y % 22)).toBe(0);
    }
  });

  it('widens column spacing to fit a long multi-symbol label', () => {
    const narrow: Automaton = {
      ...createEmptyAutomaton('DFA'),
      startStateId: 'q0',
      states: [state('q0', true), state('q1')],
      transitions: [{ id: 't1', from: 'q0', to: 'q1', input: '0' }],
    };
    const wide: Automaton = {
      ...narrow,
      transitions: [
        { id: 't1', from: 'q0', to: 'q1', input: '0' },
        { id: 't2', from: 'q0', to: 'q1', input: '1' },
        { id: 't3', from: 'q0', to: 'q1', input: '2' },
        { id: 't4', from: 'q0', to: 'q1', input: '3' },
        { id: 't5', from: 'q0', to: 'q1', input: '4' },
        { id: 't6', from: 'q0', to: 'q1', input: '5' },
      ],
    };
    const narrowGap = computeAutoLayout(narrow).get('q1')!.x - computeAutoLayout(narrow).get('q0')!.x;
    const wideGap = computeAutoLayout(wide).get('q1')!.x - computeAutoLayout(wide).get('q0')!.x;
    expect(wideGap).toBeGreaterThan(narrowGap);
  });
});
