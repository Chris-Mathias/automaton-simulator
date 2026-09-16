import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { StackStrip } from './StackStrip';
import { useAutomatonStore } from '../../store/useAutomatonStore';
import { EPSILON, createEmptyAutomaton, type Automaton } from '../../types/automaton';

/** Even-length palindromes w wᴿ — guesses the middle, so it holds several branches at once. */
function palindromes(): Automaton {
  return {
    ...createEmptyAutomaton('PDA'),
    alphabet: ['a', 'b'],
    stackAlphabet: ['Z', 'a', 'b'],
    startStateId: 'q0',
    states: [
      { id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
      { id: 'q1', label: 'q1', position: { x: 100, y: 0 }, isStart: false, isAccept: false },
      { id: 'q2', label: 'q2', position: { x: 200, y: 0 }, isStart: false, isAccept: false },
      { id: 'q3', label: 'q3', position: { x: 300, y: 0 }, isStart: false, isAccept: true },
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
}

function runOn(automaton: Automaton, input: string) {
  useAutomatonStore.getState().openTab(automaton);
  useAutomatonStore.getState().setSimulationInput(input);
  useAutomatonStore.getState().runSimulation();
}

function readCards(container: HTMLElement, selector: string) {
  return [...container.querySelectorAll<HTMLElement>(selector)].map((card) => ({
    state: card.querySelector('.stack-card__state')?.textContent,
    stack: [...card.querySelectorAll('.stack-card__block:not(.is-popped)')].map((b) => b.textContent),
    pushed: [...card.querySelectorAll('.stack-card__block.is-pushed')].map((b) => b.textContent),
    popped: [...card.querySelectorAll('.stack-card__block.is-popped')].map((b) => b.textContent),
  }));
}

function goTo(step: number) {
  act(() => {
    for (let i = 0; i < step; i += 1) useAutomatonStore.getState().stepForward();
  });
}

afterEach(cleanup);

describe('StackStrip', () => {
  it('renders nothing for automata without a stack', () => {
    runOn({ ...createEmptyAutomaton('DFA'), startStateId: null }, 'ab');
    expect(render(<StackStrip />).container.firstChild).toBeNull();
  });

  it('draws one card per configuration of the initial ε-closure', () => {
    runOn(palindromes(), 'abba');
    const { container } = render(<StackStrip />);
    const live = readCards(container, '.stack-card--live');
    expect(live.map((c) => [c.state, c.stack])).toEqual([
      ['q0', []],
      ['q1', ['Z']],
      ['q2', ['Z']],
      ['q3', []],
    ]);
    expect(container.querySelector('.stack-strip__cell.is-head')?.textContent).toBe('a');
  });

  it('keeps the branches that died greyed out beside the live ones', () => {
    runOn(palindromes(), 'abba');
    const { container } = render(<StackStrip />);
    goTo(1);
    expect(readCards(container, '.stack-card--live').map((c) => c.state)).toEqual(['q1', 'q2']);
    expect(readCards(container, '.stack-card--dead').map((c) => c.state)).toEqual(['q0', 'q2', 'q3']);
    expect(container.querySelector('.stack-strip__footer')?.textContent).toContain('3 morreram');
  });

  it('animates what each branch pushed and popped relative to the branch it came from', () => {
    runOn(palindromes(), 'abba');
    const { container } = render(<StackStrip />);
    goTo(1);
    // q1 read 'a' and pushed it on top of Z.
    expect(readCards(container, '.stack-card--live')[0]).toMatchObject({ stack: ['a', 'Z'], pushed: ['a'], popped: [] });

    goTo(2);
    // Step 3 read 'b': the q2 branch that matched it popped 'b' off b·a·Z.
    const popper = readCards(container, '.stack-card--live').find((c) => c.state === 'q2' && c.stack.length === 2);
    expect(popper).toMatchObject({ stack: ['a', 'Z'], popped: ['b'], pushed: [] });
  });

  it('marks the branches in an accept state once the whole input is read', () => {
    runOn(palindromes(), 'abba');
    const { container } = render(<StackStrip />);
    goTo(4);
    expect(readCards(container, '.stack-card--accept').map((c) => c.state)).toEqual(['q3']);
    expect(container.querySelector('.stack-strip__end')?.classList.contains('is-head')).toBe(true);
  });
});
