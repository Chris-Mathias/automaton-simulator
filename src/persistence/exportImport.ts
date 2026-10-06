import { isAutomaton, type Automaton } from '../types/automaton';

export function exportAutomatonToFile(automaton: Automaton): void {
  const blob = new Blob([JSON.stringify(automaton, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${automaton.name.trim().replace(/\s+/g, '-') || 'automato'}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export class ImportError extends Error {}

/** Real automatons are a few KB; anything this big is a mistake or an attempt to freeze the tab. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export function importAutomatonFromFile(file: File): Promise<Automaton> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMPORT_BYTES) {
      reject(new ImportError('O arquivo é grande demais para ser um autômato (limite de 2 MB).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new ImportError('Não foi possível ler o arquivo.'));
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!isAutomaton(parsed)) {
          reject(new ImportError('O arquivo não tem o formato esperado de um autômato.'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new ImportError('O arquivo não é um JSON válido.'));
      }
    };
    reader.readAsText(file);
  });
}
