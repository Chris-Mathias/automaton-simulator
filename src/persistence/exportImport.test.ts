import { describe, expect, it } from 'vitest';
import { createEmptyAutomaton } from '../types/automaton';
import { ImportError, MAX_IMPORT_BYTES, importAutomatonFromFile } from './exportImport';

function jsonFile(content: string): File {
  return new File([content], 'automato.json', { type: 'application/json' });
}

describe('importAutomatonFromFile', () => {
  it('reads a valid automaton', async () => {
    const automaton = createEmptyAutomaton('NFA', 'Importado');
    await expect(importAutomatonFromFile(jsonFile(JSON.stringify(automaton)))).resolves.toEqual(automaton);
  });

  it('rejects a file larger than the import limit without reading it', async () => {
    expect(MAX_IMPORT_BYTES).toBeGreaterThan(0);
    const file = jsonFile(' '.repeat(MAX_IMPORT_BYTES + 1));
    await expect(importAutomatonFromFile(file)).rejects.toThrow(/grande/);
  });

  it('rejects a structurally broken automaton', async () => {
    const broken = { ...createEmptyAutomaton('DFA'), states: [{ id: 'q0' }] };
    await expect(importAutomatonFromFile(jsonFile(JSON.stringify(broken)))).rejects.toBeInstanceOf(ImportError);
  });
});
