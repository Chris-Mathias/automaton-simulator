import { describe, expect, it } from 'vitest';
import { createEmptyAutomaton } from '../types/automaton';
import { ImportError, MAX_IMPORT_BYTES, importAutomatonFromFile } from './exportImport';

function jsonFile(content: string): File {
  return new File([content], 'automato.json', { type: 'application/json' });
}

describe('importAutomatonFromFile', () => {
  it('reads a valid automaton', async () => {
    const automaton = createEmptyAutomaton('NFA', 'Importado');
    const imported = await importAutomatonFromFile(jsonFile(JSON.stringify(automaton)));
    expect({ ...imported, id: automaton.id }).toEqual(automaton);
  });

  it('gives each import a fresh id, so importing the same file twice opens two distinct tabs', async () => {
    const content = JSON.stringify(createEmptyAutomaton('DFA'));
    const first = await importAutomatonFromFile(jsonFile(content));
    const second = await importAutomatonFromFile(jsonFile(content));
    expect(first.id).not.toBe(second.id);
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
