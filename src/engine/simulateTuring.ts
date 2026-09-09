import { BLANK, type Automaton, type Transition } from '../types/automaton';
import type { SimulationBranch, SimulationResult, SimulationStep } from './simulate';

/**
 * A Turing machine can run forever (the halting problem is not ours to solve),
 * so exploration is bounded: hitting either cap stops the run and reports it as
 * truncated rather than pretending the machine rejected.
 */
export const MAX_TM_STEPS = 2000;
const MAX_TAPE_LENGTH = 2000;

interface Config {
  stateId: string;
  tape: string[];
  head: number;
}

function configKey(c: Config): string {
  return `${c.stateId}::${c.head}::${c.tape.join('')}`;
}

function toBranch(c: Config, viaTransitionIds: string[]): SimulationBranch {
  return {
    key: configKey(c),
    stateId: c.stateId,
    stack: [],
    viaTransitionIds,
    tape: c.tape,
    head: c.head,
  };
}

/**
 * Applies a transition to a configuration. The tape window grows with blanks
 * whenever the head would step off either end, keeping `head` in bounds so
 * consumers never have to reason about negative indices.
 */
function step(config: Config, t: Transition, read: string): Config {
  const tape = config.tape.slice();
  tape[config.head] = t.write || read;

  let head = config.head + (t.move === 'L' ? -1 : t.move === 'R' ? 1 : 0);
  if (head < 0) {
    tape.unshift(BLANK);
    head = 0;
  } else if (head >= tape.length) {
    tape.push(BLANK);
  }

  return { stateId: t.to, tape, head };
}

/**
 * Deterministic single-tape Turing machine. Unlike the finite/pushdown
 * automata, a step is one machine move rather than one input symbol, and
 * acceptance is by halting in an accept state rather than by consuming the
 * whole input — but the result keeps the shared `SimulationResult` shape so
 * playback, canvas highlighting and bulk testing work unchanged.
 */
export function simulateTuring(automaton: Automaton, input: string): SimulationResult {
  if (!automaton.startStateId) {
    return { steps: [], accepted: false, truncated: false };
  }

  const acceptStateIds = new Set(automaton.states.filter((s) => s.isAccept).map((s) => s.id));

  let config: Config = {
    stateId: automaton.startStateId,
    tape: input.length > 0 ? [...input] : [BLANK],
    head: 0,
  };

  const steps: SimulationStep[] = [{ symbolConsumed: null, branches: [toBranch(config, [])] }];

  for (;;) {
    // An accept state is a halting state: the machine stops and accepts on
    // entering it, even if transitions out of it are defined.
    if (acceptStateIds.has(config.stateId)) {
      return { steps, accepted: true, truncated: false, haltReason: 'accept' };
    }

    if (steps.length > MAX_TM_STEPS || config.tape.length >= MAX_TAPE_LENGTH) {
      return { steps, accepted: false, truncated: true, haltReason: 'step-limit' };
    }

    const read = config.tape[config.head] ?? BLANK;
    const transition = automaton.transitions.find((t) => t.from === config.stateId && t.input === read);
    if (!transition) {
      return { steps, accepted: false, truncated: false, haltReason: 'no-transition' };
    }

    config = step(config, transition, read);
    steps.push({ symbolConsumed: read, branches: [toBranch(config, [transition.id])] });
  }
}
