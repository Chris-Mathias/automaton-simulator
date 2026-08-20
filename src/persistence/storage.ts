import { isAutomaton, type Automaton } from '../types/automaton';

const WORKSPACE_KEY = 'automaton-simulator:workspace';
/** Older, single-automaton format from before multi-tab support; migrated on first load. */
const LEGACY_SINGLE_KEY = 'automaton-simulator:autosave';

export interface PersistedWorkspace {
  schemaVersion: 1;
  automatons: Automaton[];
  activeId: string;
}

function isPersistedWorkspace(value: unknown): value is PersistedWorkspace {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 1 &&
    Array.isArray(v.automatons) &&
    v.automatons.length > 0 &&
    v.automatons.every(isAutomaton) &&
    typeof v.activeId === 'string'
  );
}

export function loadWorkspace(): PersistedWorkspace | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isPersistedWorkspace(parsed)) return parsed;
    }
  } catch {
    // fall through to legacy migration below
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_SINGLE_KEY);
    if (!legacyRaw) return null;
    const legacy = JSON.parse(legacyRaw);
    if (!isAutomaton(legacy)) return null;
    localStorage.removeItem(LEGACY_SINGLE_KEY);
    return { schemaVersion: 1, automatons: [legacy], activeId: legacy.id };
  } catch {
    return null;
  }
}

export function saveWorkspace(workspace: PersistedWorkspace): void {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  } catch {
    // Storage full or unavailable (e.g. private browsing) - autosave is best-effort.
  }
}
