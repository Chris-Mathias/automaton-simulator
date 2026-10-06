import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const WORKSPACE_KEY = 'automaton-simulator:workspace';

function Exploding(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders its children while nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>conteúdo</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('conteúdo')).toBeTruthy();
  });

  it('replaces a crashed tree with a recovery screen', () => {
    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: /backup/i })).toBeTruthy();
  });

  it('clears the saved workspace once the user confirms', () => {
    localStorage.setItem(WORKSPACE_KEY, '{"corrompido":true}');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload });

    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /limpar/i }));

    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull();
    expect(reload).toHaveBeenCalled();
  });

  it('keeps the saved workspace if the user cancels', () => {
    localStorage.setItem(WORKSPACE_KEY, '{"corrompido":true}');
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <ErrorBoundary>
        <Exploding />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /limpar/i }));

    expect(localStorage.getItem(WORKSPACE_KEY)).toBe('{"corrompido":true}');
  });
});
