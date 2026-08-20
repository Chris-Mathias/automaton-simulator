import type { Automaton, AutomatonState, Transition } from '../types/automaton';
import { EPSILON } from '../types/automaton';

function epsilonClosure(nfa: Automaton, ids: Set<string>): Set<string> {
  const stack = [...ids];
  const result = new Set(ids);
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const t of nfa.transitions) {
      if (t.from === current && t.input === EPSILON && !result.has(t.to)) {
        result.add(t.to);
        stack.push(t.to);
      }
    }
  }
  return result;
}

function subsetKey(ids: Set<string>): string {
  return [...ids].sort().join(',');
}

/** Subset construction: converts an NFA (with optional ε-transitions) into an equivalent DFA. */
export function convertNfaToDfa(nfa: Automaton): Automaton {
  if (nfa.kind !== 'NFA') {
    throw new Error('convertNfaToDfa espera um autômato do tipo AFN.');
  }
  if (!nfa.startStateId) {
    throw new Error('O AFN precisa ter um estado inicial definido para ser convertido.');
  }

  const byId = new Map(nfa.states.map((s) => [s.id, s]));
  const labelFor = (ids: Set<string>) =>
    '{' + [...ids].map((id) => byId.get(id)?.label ?? id).sort().join(',') + '}';

  const startSet = epsilonClosure(nfa, new Set([nfa.startStateId]));
  const startKey = subsetKey(startSet);

  const subsets = new Map<string, Set<string>>([[startKey, startSet]]);
  const queue = [startKey];
  const processed = new Set<string>();
  const dfaTransitions: Transition[] = [];

  while (queue.length > 0) {
    const currentKey = queue.shift()!;
    if (processed.has(currentKey)) continue;
    processed.add(currentKey);
    const currentIds = subsets.get(currentKey)!;

    for (const symbol of nfa.alphabet) {
      const moveSet = new Set<string>();
      for (const id of currentIds) {
        for (const t of nfa.transitions) {
          if (t.from === id && t.input === symbol) moveSet.add(t.to);
        }
      }
      if (moveSet.size === 0) continue;

      const closure = epsilonClosure(nfa, moveSet);
      const key = subsetKey(closure);
      if (!subsets.has(key)) {
        subsets.set(key, closure);
        queue.push(key);
      }
      dfaTransitions.push({ id: crypto.randomUUID(), from: currentKey, to: key, input: symbol });
    }
  }

  const keys = [...subsets.keys()];
  const dfaStates: AutomatonState[] = keys.map((key, index) => {
    const ids = subsets.get(key)!;
    return {
      id: key,
      label: labelFor(ids),
      position: { x: (index % 5) * 220 + 40, y: Math.floor(index / 5) * 160 + 40 },
      isStart: key === startKey,
      isAccept: [...ids].some((id) => byId.get(id)?.isAccept),
    };
  });

  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: `${nfa.name} (AFD)`,
    kind: 'DFA',
    alphabet: [...nfa.alphabet],
    states: dfaStates,
    transitions: dfaTransitions,
    startStateId: startKey,
  };
}
