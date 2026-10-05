import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { TapeStrip } from './TapeStrip';
import { useAutomatonStore } from '../../store/useAutomatonStore';
import { BLANK, createEmptyAutomaton, type Automaton } from '../../types/automaton';

/** Rewrites every 'a' as 'b', moving right, then accepts on the trailing blank. */
function machine(): Automaton {
  return {
    ...createEmptyAutomaton('TM'),
    alphabet: ['a'],
    tapeAlphabet: ['a', 'b'],
    startStateId: 'q0',
    states: [
      { id: 'q0', label: 'q0', position: { x: 0, y: 0 }, isStart: true, isAccept: false },
      { id: 'acc', label: 'acc', position: { x: 100, y: 0 }, isStart: false, isAccept: true },
    ],
    transitions: [
      { id: 't1', from: 'q0', to: 'q0', input: 'a', write: 'b', move: 'R' },
      { id: 't2', from: 'q0', to: 'acc', input: BLANK, write: BLANK, move: 'S' },
    ],
  };
}

function runOn(automaton: Automaton, input: string) {
  const store = useAutomatonStore.getState();
  store.openTab(automaton);
  useAutomatonStore.getState().setSimulationInput(input);
  useAutomatonStore.getState().runSimulation();
}

function readStrip(container: HTMLElement) {
  const track = container.querySelector<HTMLElement>('.tape-strip__track');
  return {
    state: container.querySelector('.tape-strip__state')?.textContent,
    headSymbol: container.querySelector('.tape-strip__cell.is-head')?.textContent,
    transform: track?.style.transform,
    cells: [...container.querySelectorAll('.tape-strip__cell')].map((c) => c.textContent),
  };
}

afterEach(cleanup);

describe('TapeStrip', () => {
  it('renders nothing for automata that have no tape', () => {
    runOn({ ...createEmptyAutomaton('DFA'), startStateId: null }, 'aa');
    const { container } = render(<TapeStrip />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the start state over the first input symbol', () => {
    runOn(machine(), 'aa');
    const strip = readStrip(render(<TapeStrip />).container);
    expect(strip.state).toBe('q0');
    expect(strip.headSymbol).toBe('a');
  });

  it('pads the visited tape with blanks on both sides so it reads as infinite', () => {
    runOn(machine(), 'aa');
    const strip = readStrip(render(<TapeStrip />).container);
    // 2 visited cells at step 0, plus 20 padding cells on each side.
    expect(strip.cells).toHaveLength(42);
    expect(strip.cells[0]).toBe(BLANK);
    expect(strip.cells.at(-1)).toBe(BLANK);
  });

  it('slides the track by one cell per step, keeping the head centred', () => {
    runOn(machine(), 'aa');
    const { container } = render(<TapeStrip />);
    // PAD (20) cells sit left of tape index 0, at 42px each.
    expect(readStrip(container).transform).toBe('translateX(-840px)');

    act(() => useAutomatonStore.getState().stepForward());
    const afterStep = readStrip(container);
    expect(afterStep.transform).toBe('translateX(-882px)');
    // The first 'a' has been rewritten and the head moved onto the second one.
    expect(afterStep.headSymbol).toBe('a');
    expect(afterStep.cells[20]).toBe('b');
  });

  it('follows the head onto the blank the machine grows past the input', () => {
    runOn(machine(), 'a');
    const { container } = render(<TapeStrip />);
    act(() => useAutomatonStore.getState().stepForward());
    const strip = readStrip(container);
    expect(strip.headSymbol).toBe(BLANK);
    expect(strip.cells[20]).toBe('b');
  });
});
