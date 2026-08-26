import { create, type StoreApi } from 'zustand';
import {
  createEmptyAutomaton,
  type Automaton,
  type AutomatonKind,
  type AutomatonState,
  type Transition,
} from '../types/automaton';
import { simulate, type SimulationResult } from '../engine/simulate';
import { loadWorkspace, saveWorkspace } from '../persistence/storage';

const DEFAULT_SPEED_MS = 700;
const MAX_HISTORY = 100;
/** Edits fired in quick succession (e.g. every keystroke while typing) collapse
 *  into a single undo step instead of one step per keystroke. */
const HISTORY_COALESCE_MS = 500;

export interface AutomatonDocument {
  id: string;
  automaton: Automaton;
  /** Undo/redo history for this tab. Not persisted across reloads. */
  past: Automaton[];
  future: Automaton[];

  simulationInput: string;
  simulationResult: SimulationResult | null;
  simulationStepIndex: number;
  isPlaying: boolean;
  playbackSpeedMs: number;
}

interface StoreState {
  documents: AutomatonDocument[];
  activeId: string;
  theme: 'dark' | 'light';
  snapToGrid: boolean;

  toggleTheme: () => void;
  toggleSnapToGrid: () => void;

  openTab: (automaton: Automaton) => void;
  newTab: (kind: AutomatonKind) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;

  renameAutomaton: (name: string) => void;
  setAlphabet: (alphabet: string[]) => void;
  setStackAlphabet: (stackAlphabet: string[]) => void;

  addState: (position: { x: number; y: number }) => string;
  updateStatePosition: (id: string, position: { x: number; y: number }) => void;
  renameState: (id: string, label: string) => void;
  toggleAccept: (id: string) => void;
  setStart: (id: string) => void;
  removeState: (id: string) => void;

  addTransition: (transition: Omit<Transition, 'id'>) => void;
  updateTransition: (id: string, patch: Partial<Omit<Transition, 'id'>>) => void;
  removeTransition: (id: string) => void;

  undo: () => void;
  redo: () => void;

  setSimulationInput: (input: string) => void;
  runSimulation: () => void;
  stepForward: () => void;
  stepBack: () => void;
  restartPlayback: () => void;
  resetSimulation: () => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (ms: number) => void;
}

type SetFn = StoreApi<StoreState>['setState'];
type GetFn = StoreApi<StoreState>['getState'];

/** Selector helper: `useAutomatonStore((s) => activeDocument(s).automaton)`. */
export function activeDocument(state: StoreState): AutomatonDocument {
  return state.documents.find((d) => d.id === state.activeId) ?? state.documents[0];
}

function createDocument(automaton: Automaton): AutomatonDocument {
  return {
    id: automaton.id,
    automaton,
    past: [],
    future: [],
    simulationInput: '',
    simulationResult: null,
    simulationStepIndex: 0,
    isPlaying: false,
    playbackSpeedMs: DEFAULT_SPEED_MS,
  };
}

function persistAll(documents: AutomatonDocument[], activeId: string) {
  saveWorkspace({ schemaVersion: 1, automatons: documents.map((d) => d.automaton), activeId });
}

let lastHistoryPushAt = 0;

/** Call with the document's pre-mutation state, before applying the change. */
function withHistory(doc: AutomatonDocument): Pick<AutomatonDocument, 'past' | 'future'> {
  const now = Date.now();
  const shouldPush = now - lastHistoryPushAt > HISTORY_COALESCE_MS;
  lastHistoryPushAt = now;
  if (!shouldPush) return { past: doc.past, future: [] };
  return { past: [...doc.past, doc.automaton].slice(-MAX_HISTORY), future: [] };
}

/** Replaces the active document with `fn(activeDoc)`; no-ops if there is none. */
function applyToActiveDoc(set: SetFn, fn: (doc: AutomatonDocument) => AutomatonDocument) {
  set((state) => {
    const idx = state.documents.findIndex((d) => d.id === state.activeId);
    if (idx === -1) return {};
    const documents = state.documents.map((d, i) => (i === idx ? fn(d) : d));
    return { documents };
  });
}

/** Mutates the active tab's automaton, recording undo history and persisting the workspace. */
function mutateAutomaton(set: SetFn, get: GetFn, updater: (automaton: Automaton) => Automaton) {
  applyToActiveDoc(set, (doc) => {
    const automaton = updater(doc.automaton);
    const { past, future } = withHistory(doc);
    return { ...doc, automaton, past, future };
  });
  const state = get();
  persistAll(state.documents, state.activeId);
}

const persisted = loadWorkspace();
const initialDocuments = (persisted?.automatons.length ? persisted.automatons : [createEmptyAutomaton('DFA', 'Meu autômato')]).map(
  createDocument,
);
const initialActiveId =
  persisted?.activeId && initialDocuments.some((d) => d.id === persisted.activeId)
    ? persisted.activeId
    : initialDocuments[0].id;
const initialTheme = (localStorage.getItem('automaton-simulator:theme') as 'dark' | 'light' | null) ?? 'dark';
const initialSnapToGrid = localStorage.getItem('automaton-simulator:snap-to-grid') === 'true';

export const useAutomatonStore = create<StoreState>((set, get) => ({
  documents: initialDocuments,
  activeId: initialActiveId,
  theme: initialTheme,
  snapToGrid: initialSnapToGrid,

  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('automaton-simulator:theme', theme);
      return { theme };
    }),

  toggleSnapToGrid: () =>
    set((state) => {
      const snapToGrid = !state.snapToGrid;
      localStorage.setItem('automaton-simulator:snap-to-grid', String(snapToGrid));
      return { snapToGrid };
    }),

  openTab: (automaton) =>
    set((state) => {
      const doc = createDocument(automaton);
      const documents = [...state.documents, doc];
      persistAll(documents, doc.id);
      return { documents, activeId: doc.id };
    }),

  newTab: (kind) => get().openTab(createEmptyAutomaton(kind, 'Novo autômato')),

  closeTab: (id) =>
    set((state) => {
      const idx = state.documents.findIndex((d) => d.id === id);
      if (idx === -1) return {};
      let documents = state.documents.filter((d) => d.id !== id);
      if (documents.length === 0) {
        documents = [createDocument(createEmptyAutomaton('DFA', 'Meu autômato'))];
      }
      const activeId =
        state.activeId === id ? documents[Math.min(idx, documents.length - 1)].id : state.activeId;
      persistAll(documents, activeId);
      return { documents, activeId };
    }),

  switchTab: (id) =>
    set((state) => {
      if (!state.documents.some((d) => d.id === id)) return {};
      persistAll(state.documents, id);
      return { activeId: id };
    }),

  renameAutomaton: (name) => mutateAutomaton(set, get, (automaton) => ({ ...automaton, name })),

  setAlphabet: (alphabet) => mutateAutomaton(set, get, (automaton) => ({ ...automaton, alphabet })),

  setStackAlphabet: (stackAlphabet) => mutateAutomaton(set, get, (automaton) => ({ ...automaton, stackAlphabet })),

  addState: (position) => {
    const id = crypto.randomUUID();
    mutateAutomaton(set, get, (automaton) => {
      const isFirst = automaton.states.length === 0;
      const newState: AutomatonState = {
        id,
        label: `q${automaton.states.length}`,
        position,
        isStart: isFirst,
        isAccept: false,
      };
      return {
        ...automaton,
        states: [...automaton.states, newState],
        startStateId: isFirst ? id : automaton.startStateId,
      };
    });
    return id;
  },

  updateStatePosition: (id, position) =>
    mutateAutomaton(set, get, (automaton) => ({
      ...automaton,
      states: automaton.states.map((s) => (s.id === id ? { ...s, position } : s)),
    })),

  renameState: (id, label) =>
    mutateAutomaton(set, get, (automaton) => ({
      ...automaton,
      states: automaton.states.map((s) => (s.id === id ? { ...s, label } : s)),
    })),

  toggleAccept: (id) =>
    mutateAutomaton(set, get, (automaton) => ({
      ...automaton,
      states: automaton.states.map((s) => (s.id === id ? { ...s, isAccept: !s.isAccept } : s)),
    })),

  setStart: (id) =>
    mutateAutomaton(set, get, (automaton) => ({
      ...automaton,
      startStateId: id,
      states: automaton.states.map((s) => ({ ...s, isStart: s.id === id })),
    })),

  removeState: (id) =>
    mutateAutomaton(set, get, (automaton) => ({
      ...automaton,
      states: automaton.states.filter((s) => s.id !== id),
      transitions: automaton.transitions.filter((t) => t.from !== id && t.to !== id),
      startStateId: automaton.startStateId === id ? null : automaton.startStateId,
    })),

  addTransition: (transition) =>
    mutateAutomaton(set, get, (automaton) => ({
      ...automaton,
      transitions: [...automaton.transitions, { ...transition, id: crypto.randomUUID() }],
    })),

  updateTransition: (id, patch) =>
    mutateAutomaton(set, get, (automaton) => ({
      ...automaton,
      transitions: automaton.transitions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  removeTransition: (id) =>
    mutateAutomaton(set, get, (automaton) => ({
      ...automaton,
      transitions: automaton.transitions.filter((t) => t.id !== id),
    })),

  undo: () => {
    applyToActiveDoc(set, (doc) => {
      if (doc.past.length === 0) return doc;
      lastHistoryPushAt = Date.now();
      return {
        ...doc,
        automaton: doc.past[doc.past.length - 1],
        past: doc.past.slice(0, -1),
        future: [doc.automaton, ...doc.future],
      };
    });
    const state = get();
    persistAll(state.documents, state.activeId);
  },

  redo: () => {
    applyToActiveDoc(set, (doc) => {
      if (doc.future.length === 0) return doc;
      lastHistoryPushAt = Date.now();
      return {
        ...doc,
        automaton: doc.future[0],
        past: [...doc.past, doc.automaton],
        future: doc.future.slice(1),
      };
    });
    const state = get();
    persistAll(state.documents, state.activeId);
  },

  // Editing the input always invalidates the current run instead of requiring
  // an explicit "reset" click first — the step trace and result banner
  // wouldn't reflect the new string anyway.
  setSimulationInput: (input) =>
    applyToActiveDoc(set, (doc) => ({
      ...doc,
      simulationInput: input,
      simulationResult: null,
      simulationStepIndex: 0,
      isPlaying: false,
    })),

  runSimulation: () => {
    const doc = activeDocument(get());
    const result = simulate(doc.automaton, doc.simulationInput);
    applyToActiveDoc(set, (d) => ({ ...d, simulationResult: result, simulationStepIndex: 0, isPlaying: false }));
  },

  stepForward: () =>
    applyToActiveDoc(set, (doc) => {
      if (!doc.simulationResult) return doc;
      const max = doc.simulationResult.steps.length - 1;
      const next = Math.min(doc.simulationStepIndex + 1, max);
      return { ...doc, simulationStepIndex: next, isPlaying: next === max ? false : doc.isPlaying };
    }),

  stepBack: () =>
    applyToActiveDoc(set, (doc) => ({ ...doc, simulationStepIndex: Math.max(doc.simulationStepIndex - 1, 0), isPlaying: false })),

  // Rewinds to the first step and starts playing again — lets the play
  // button double as "play again" once a run has reached its end, without
  // requiring a separate reset click first.
  restartPlayback: () => applyToActiveDoc(set, (doc) => ({ ...doc, simulationStepIndex: 0, isPlaying: true })),

  resetSimulation: () =>
    applyToActiveDoc(set, (doc) => ({ ...doc, simulationResult: null, simulationStepIndex: 0, isPlaying: false })),

  setPlaying: (playing) => applyToActiveDoc(set, (doc) => ({ ...doc, isPlaying: playing })),

  setPlaybackSpeed: (ms) => applyToActiveDoc(set, (doc) => ({ ...doc, playbackSpeedMs: ms })),
}));
