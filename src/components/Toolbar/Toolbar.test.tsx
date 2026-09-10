import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Toolbar } from './Toolbar';
import { useAutomatonStore } from '../../store/useAutomatonStore';
import { createEmptyAutomaton } from '../../types/automaton';

afterEach(cleanup);

/** The alphabet fields hold a local draft, so they need an explicit resync
 *  when the canvas fills the alphabet in from a transition label. */
describe('Toolbar alphabet fields', () => {
  it('picks up an input alphabet filled in elsewhere', () => {
    act(() => useAutomatonStore.getState().openTab(createEmptyAutomaton('DFA')));
    render(<Toolbar />);
    const field = screen.getByLabelText('Alfabeto', { selector: 'input' }) as HTMLInputElement;
    expect(field.value).toBe('');

    act(() => useAutomatonStore.getState().setAlphabet(['a', 'b']));
    expect(field.value).toBe('a, b');
  });

  it('picks up a tape alphabet filled in elsewhere', () => {
    act(() => useAutomatonStore.getState().openTab(createEmptyAutomaton('TM')));
    render(<Toolbar />);
    const field = screen.getByLabelText('Alfabeto da fita', { selector: 'input' }) as HTMLInputElement;
    expect(field.value).toBe('');

    act(() => useAutomatonStore.getState().setTapeAlphabet(['X', 'a']));
    expect(field.value).toBe('X, a');
  });
});
