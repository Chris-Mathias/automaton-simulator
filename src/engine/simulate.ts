import type { Automaton } from '../types/automaton';
import { EPSILON } from '../types/automaton';

/** Guards against runaway exploration on cyclic ε-transitions / unbounded stack growth. */
const MAX_STEPS = 1000;
const MAX_BRANCHES_PER_STEP = 300;
const MAX_CLOSURE_EXPANSIONS = 2000;

export interface SimulationBranch {
  /** Stable key identifying this configuration within a step: stateId + stack contents. */
  key: string;
  stateId: string;
  /** Top of stack is stack[0]. Always empty for DFA/NFA. */
  stack: string[];
  /** Transitions traversed since the previous step (ε-chain, then the consuming transition, or just ε-chain for step 0). */
  viaTransitionIds: string[];
}

export interface SimulationStep {
  /** Symbol consumed to reach this step; null for the initial step (before any input is read). */
  symbolConsumed: string | null;
  branches: SimulationBranch[];
}

export interface SimulationResult {
  steps: SimulationStep[];
  accepted: boolean;
  /** True if exploration was cut off by a safety cap (cyclic ε-moves, exploding stack, etc). */
  truncated: boolean;
}

function branchKey(stateId: string, stack: string[]): string {
  return `${stateId}::${stack.join('')}`;
}

function popMatches(pop: string | undefined, stack: string[]): boolean {
  if (!pop) return true;
  return stack.length > 0 && stack[0] === pop;
}

function applyStackOp(stack: string[], pop: string | undefined, push: string | undefined): string[] {
  const rest = pop ? stack.slice(1) : stack.slice();
  const pushed = push ? push.split('') : [];
  return [...pushed, ...rest];
}

function epsilonClosure(
  automaton: Automaton,
  seed: SimulationBranch[],
): SimulationBranch[] {
  const visited = new Map<string, SimulationBranch>();
  const queue: SimulationBranch[] = [];

  for (const branch of seed) {
    if (!visited.has(branch.key)) {
      visited.set(branch.key, branch);
      queue.push(branch);
    }
  }

  let expansions = 0;
  while (queue.length > 0 && expansions < MAX_CLOSURE_EXPANSIONS) {
    const current = queue.shift()!;
    expansions += 1;
    for (const t of automaton.transitions) {
      if (t.from !== current.stateId || t.input !== EPSILON) continue;
      if (automaton.kind === 'PDA' && !popMatches(t.pop, current.stack)) continue;
      const newStack = automaton.kind === 'PDA' ? applyStackOp(current.stack, t.pop, t.push) : current.stack;
      const key = branchKey(t.to, newStack);
      if (visited.has(key)) continue;
      const next: SimulationBranch = {
        key,
        stateId: t.to,
        stack: newStack,
        viaTransitionIds: [...current.viaTransitionIds, t.id],
      };
      visited.set(key, next);
      queue.push(next);
    }
  }

  return [...visited.values()];
}

export function simulate(automaton: Automaton, input: string): SimulationResult {
  if (!automaton.startStateId) {
    return { steps: [], accepted: false, truncated: false };
  }

  const acceptStateIds = new Set(automaton.states.filter((s) => s.isAccept).map((s) => s.id));

  const initial: SimulationBranch = {
    key: branchKey(automaton.startStateId, []),
    stateId: automaton.startStateId,
    stack: [],
    viaTransitionIds: [],
  };

  let current = epsilonClosure(automaton, [initial]);
  const steps: SimulationStep[] = [{ symbolConsumed: null, branches: current }];
  let truncated = false;

  for (const symbol of input) {
    if (steps.length >= MAX_STEPS) {
      truncated = true;
      break;
    }

    const consumed: SimulationBranch[] = [];
    for (const branch of current) {
      for (const t of automaton.transitions) {
        if (t.from !== branch.stateId || t.input !== symbol) continue;
        if (automaton.kind === 'PDA' && !popMatches(t.pop, branch.stack)) continue;
        const newStack = automaton.kind === 'PDA' ? applyStackOp(branch.stack, t.pop, t.push) : branch.stack;
        consumed.push({
          key: branchKey(t.to, newStack),
          stateId: t.to,
          stack: newStack,
          viaTransitionIds: [t.id],
        });
      }
    }

    let next = epsilonClosure(automaton, consumed);
    if (next.length > MAX_BRANCHES_PER_STEP) {
      next = next.slice(0, MAX_BRANCHES_PER_STEP);
      truncated = true;
    }

    steps.push({ symbolConsumed: symbol, branches: next });
    current = next;
    if (current.length === 0) break;
  }

  const lastBranches = steps[steps.length - 1]?.branches ?? [];
  const consumedWholeInput = steps.length === input.length + 1;
  const accepted = consumedWholeInput && lastBranches.some((b) => acceptStateIds.has(b.stateId));

  return { steps, accepted, truncated };
}
