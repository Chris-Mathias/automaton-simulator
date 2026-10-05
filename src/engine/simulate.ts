import type { Automaton, Transition } from '../types/automaton';
import { EPSILON } from '../types/automaton';
import { simulateTuring } from './simulateTuring';

/** Guards against runaway exploration on cyclic ε-transitions / unbounded stack growth. */
const MAX_STEPS = 1000;
const MAX_BRANCHES_PER_STEP = 300;
const MAX_CLOSURE_EXPANSIONS = 2000;

export interface SimulationBranch {
  /** Stable key identifying this configuration within a step: stateId + stack (or tape + head) contents. */
  key: string;
  stateId: string;
  /** Top of stack is stack[0]. Always empty for DFA/NFA/TM. */
  stack: string[];
  /** 2PDA only: the second stack, top at stack2[0]. */
  stack2?: string[];
  /** Transitions traversed since the previous step (ε-chain, then the consuming transition, or just ε-chain for step 0). */
  viaTransitionIds: string[];
  /** NFA/PDA: key of the previous step's configuration this one descends from. Undefined on step 0.
   *  When two configurations reach the same one, the first to get there is kept. */
  parentKey?: string;
  /** TM only: the finite window of the tape that has been visited. Cells outside it are blank. */
  tape?: string[];
  /** TM only: head index into `tape`. Always within bounds — the window grows before the head leaves it. */
  head?: number;
}

export interface SimulationStep {
  /** Symbol consumed to reach this step; null for the initial step (before any input is read).
   *  For a TM this is the symbol read by the transition that produced this configuration. */
  symbolConsumed: string | null;
  branches: SimulationBranch[];
  /** NFA/PDA: configurations of the previous step with no move on `symbolConsumed` — the branches that died here. */
  deadBranches?: SimulationBranch[];
}

/** TM only: why the machine stopped running. */
export type HaltReason = 'accept' | 'no-transition' | 'step-limit';

export interface SimulationResult {
  steps: SimulationStep[];
  accepted: boolean;
  /** True if exploration was cut off by a safety cap (cyclic ε-moves, exploding stack, TM step limit, etc). */
  truncated: boolean;
  /** TM only. */
  haltReason?: HaltReason;
}

function branchKey(stateId: string, stack: string[], stack2?: string[]): string {
  const base = `${stateId}::${stack.join('')}`;
  return stack2 ? `${base}::${stack2.join('')}` : base;
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

/** Whether every stack the transition pops from has that symbol on top. */
function stackOpsMatch(automaton: Automaton, t: Transition, branch: SimulationBranch): boolean {
  if (automaton.kind === 'PDA') return popMatches(t.pop, branch.stack);
  if (automaton.kind === '2PDA') return popMatches(t.pop, branch.stack) && popMatches(t.pop2, branch.stack2 ?? []);
  return true;
}

/** The stacks the transition leaves behind; untouched on automata without one. */
function applyStackOps(
  automaton: Automaton,
  t: Transition,
  branch: SimulationBranch,
): Pick<SimulationBranch, 'stack' | 'stack2'> {
  if (automaton.kind === 'PDA') return { stack: applyStackOp(branch.stack, t.pop, t.push) };
  if (automaton.kind === '2PDA') {
    return {
      stack: applyStackOp(branch.stack, t.pop, t.push),
      stack2: applyStackOp(branch.stack2 ?? [], t.pop2, t.push2),
    };
  }
  return { stack: branch.stack };
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
      if (!stackOpsMatch(automaton, t, current)) continue;
      const stacks = applyStackOps(automaton, t, current);
      const key = branchKey(t.to, stacks.stack, stacks.stack2);
      if (visited.has(key)) continue;
      const next: SimulationBranch = {
        key,
        stateId: t.to,
        ...stacks,
        viaTransitionIds: [...current.viaTransitionIds, t.id],
        parentKey: current.parentKey,
      };
      visited.set(key, next);
      queue.push(next);
    }
  }

  return [...visited.values()];
}

export function simulate(automaton: Automaton, input: string): SimulationResult {
  if (automaton.kind === 'TM') return simulateTuring(automaton, input);

  if (!automaton.startStateId) {
    return { steps: [], accepted: false, truncated: false };
  }

  const acceptStateIds = new Set(automaton.states.filter((s) => s.isAccept).map((s) => s.id));

  const emptyStacks: Pick<SimulationBranch, 'stack' | 'stack2'> =
    automaton.kind === '2PDA' ? { stack: [], stack2: [] } : { stack: [] };
  const initial: SimulationBranch = {
    key: branchKey(automaton.startStateId, emptyStacks.stack, emptyStacks.stack2),
    stateId: automaton.startStateId,
    ...emptyStacks,
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
    const dead: SimulationBranch[] = [];
    for (const branch of current) {
      const before = consumed.length;
      for (const t of automaton.transitions) {
        if (t.from !== branch.stateId || t.input !== symbol) continue;
        if (!stackOpsMatch(automaton, t, branch)) continue;
        const stacks = applyStackOps(automaton, t, branch);
        consumed.push({
          key: branchKey(t.to, stacks.stack, stacks.stack2),
          stateId: t.to,
          ...stacks,
          viaTransitionIds: [t.id],
          parentKey: branch.key,
        });
      }
      if (consumed.length === before) dead.push(branch);
    }

    let next = epsilonClosure(automaton, consumed);
    if (next.length > MAX_BRANCHES_PER_STEP) {
      next = next.slice(0, MAX_BRANCHES_PER_STEP);
      truncated = true;
    }

    steps.push({ symbolConsumed: symbol, branches: next, deadBranches: dead });
    current = next;
    if (current.length === 0) break;
  }

  const lastBranches = steps[steps.length - 1]?.branches ?? [];
  const consumedWholeInput = steps.length === input.length + 1;
  const accepted = consumedWholeInput && lastBranches.some((b) => acceptStateIds.has(b.stateId));

  return { steps, accepted, truncated };
}
