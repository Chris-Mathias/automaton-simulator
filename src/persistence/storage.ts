import { isAutomaton, type Automaton } from '../types/automaton';

const WORKSPACE_KEY = 'automaton-simulator:workspace';
/** Older, single-automaton format from before multi-tab support; migrated on first load. */
const LEGACY_SINGLE_KEY = 'automaton-simulator:autosave';

export interface PersistedWorkspace {
  schemaVersion: 1;
  automatons: Automaton[];
  activeId: string;
}

/**
 * Drops individual corrupted automatons instead of rejecting the whole
 * workspace, so one bad tab doesn't take the user's other work with it.
 */
function parseWorkspace(value: unknown): PersistedWorkspace | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== 1 || !Array.isArray(v.automatons) || typeof v.activeId !== 'string') return null;
  const automatons = v.automatons.filter(isAutomaton);
  if (automatons.length === 0) return null;
  return { schemaVersion: 1, automatons, activeId: v.activeId };
}

export function loadWorkspace(): PersistedWorkspace | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (raw) {
      const workspace = parseWorkspace(JSON.parse(raw));
      if (workspace) return workspace;
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

/** Raw saved workspace, unparsed, so it can still be backed up when it no longer loads. */
export function readRawWorkspace(): string | null {
  try {
    return localStorage.getItem(WORKSPACE_KEY) ?? localStorage.getItem(LEGACY_SINGLE_KEY);
  } catch {
    return null;
  }
}

export function clearWorkspace(): void {
  try {
    localStorage.removeItem(WORKSPACE_KEY);
    localStorage.removeItem(LEGACY_SINGLE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
