import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyAutomaton } from '../types/automaton';
import { loadWorkspace } from './storage';

const WORKSPACE_KEY = 'automaton-simulator:workspace';

describe('loadWorkspace', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the valid automatons when one of them is corrupted', () => {
    const good = createEmptyAutomaton('DFA', 'Bom');
    const broken = { ...createEmptyAutomaton('DFA', 'Quebrado'), states: [{ id: 'q0' }] };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ schemaVersion: 1, automatons: [good, broken], activeId: broken.id }));

    const workspace = loadWorkspace();

    expect(workspace?.automatons.map((a) => a.id)).toEqual([good.id]);
  });

  it('drops automatons that repeat an id already loaded', () => {
    const a = createEmptyAutomaton('DFA', 'Primeiro');
    const duplicate = { ...createEmptyAutomaton('NFA', 'Repetido'), id: a.id };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ schemaVersion: 1, automatons: [a, duplicate], activeId: a.id }));

    expect(loadWorkspace()?.automatons.map((x) => x.name)).toEqual(['Primeiro']);
  });

  it('returns null when no automaton survives validation', () => {
    const broken = { ...createEmptyAutomaton('DFA'), transitions: [{ id: 't' }] };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ schemaVersion: 1, automatons: [broken], activeId: broken.id }));

    expect(loadWorkspace()).toBeNull();
  });
});
