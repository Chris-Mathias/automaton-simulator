import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { activeDocument, useAutomatonStore } from '../../store/useAutomatonStore';
import { formatTransitionLabel, hasStack, type Automaton } from '../../types/automaton';
import type { SimulationBranch } from '../../engine/simulate';
import './StackStrip.css';

/** Must match `--input-cell` in StackStrip.css — the track is offset in pixels. */
const CELL = 34;
/** Live configurations drawn as cards; the rest collapse into a "+N" card. */
const MAX_CARDS = 6;
/** Dead configurations drawn per step. */
const MAX_DEAD = 3;
/** Blocks drawn per stack before the bottom collapses into a "+N" block. */
const MAX_DEPTH = 7;

/**
 * Splits a stack into what the move kept (a shared bottom), what it popped off
 * the parent's top and what it pushed on — which is what the card animates.
 */
function stackDiff(parent: string[] | undefined, stack: string[]) {
  if (!parent) return { popped: [] as string[], pushed: 0 };
  let kept = 0;
  while (
    kept < parent.length &&
    kept < stack.length &&
    parent[parent.length - 1 - kept] === stack[stack.length - 1 - kept]
  ) {
    kept += 1;
  }
  return { popped: parent.slice(0, parent.length - kept), pushed: stack.length - kept };
}

interface ColumnProps {
  stack: string[];
  /** The same stack on the configuration this one came from; drives the pop/push animation. */
  parent?: string[];
  animate: boolean;
  /** Shown above the column when the card holds more than one stack. */
  label?: string;
}

function StackColumn({ stack, parent, animate, label }: ColumnProps) {
  const { popped, pushed } = animate ? stackDiff(parent, stack) : { popped: [], pushed: 0 };

  const shown = stack.length > MAX_DEPTH ? stack.slice(0, MAX_DEPTH - 1) : stack;
  const hidden = stack.length - shown.length;

  return (
    <div className="stack-card__column">
      {label && <span className="stack-card__stack-label mono">{label}</span>}
      <div className="stack-card__stack">
        {popped.map((symbol, i) => (
          <span key={`p${i}`} className="stack-card__block mono is-popped">
            {symbol}
          </span>
        ))}
        {shown.map((symbol, i) => (
          <span
            key={`s${i}`}
            className={['stack-card__block', 'mono', i === 0 && 'is-top', i < pushed && 'is-pushed']
              .filter(Boolean)
              .join(' ')}
            style={i < pushed ? ({ '--push-order': pushed - 1 - i } as CSSProperties) : undefined}
          >
            {symbol}
          </span>
        ))}
        {hidden > 0 && <span className="stack-card__block stack-card__more mono">+{hidden}</span>}
        {stack.length === 0 && popped.length === 0 && <span className="stack-card__empty">vazia</span>}
      </div>
    </div>
  );
}

interface CardProps {
  automaton: Automaton;
  branch: SimulationBranch;
  parent?: SimulationBranch;
  variant: 'live' | 'accept' | 'dead';
}

function StackCard({ automaton, branch, parent, variant }: CardProps) {
  const label = automaton.states.find((s) => s.id === branch.stateId)?.label ?? '?';
  const twoStacks = automaton.kind === '2PDA';
  const animate = variant !== 'dead';

  const via =
    variant === 'dead'
      ? []
      : branch.viaTransitionIds
          .map((id) => automaton.transitions.find((t) => t.id === id))
          .filter((t) => t !== undefined)
          .map((t) => formatTransitionLabel(automaton.kind, t));

  return (
    <div className={`stack-card stack-card--${variant}`}>
      <span className="stack-card__state mono">{label}</span>

      <div className="stack-card__stacks">
        <StackColumn stack={branch.stack} parent={parent?.stack} animate={animate} label={twoStacks ? '1' : undefined} />
        {twoStacks && <StackColumn stack={branch.stack2 ?? []} parent={parent?.stack2} animate={animate} label="2" />}
      </div>

      {variant === 'dead' ? (
        <span className="stack-card__caption stack-card__caption--dead">✕ sem transição</span>
      ) : (
        via.length > 0 && (
          <span className="stack-card__caption mono">
            {via.map((v, i) => (
              <span key={i}>{v}</span>
            ))}
          </span>
        )
      )}
    </div>
  );
}

/**
 * The pushdown automaton's counterpart to the Turing tape strip: the input
 * tape slides under a fixed head, and every configuration the nondeterministic
 * run holds at this step is drawn side by side as a card with its own stack,
 * or its two stacks in a 2PDA — new ones animate in with the symbols they
 * pushed, and the ones that had no move on the symbol just read stay behind
 * greyed out, so the branching is visible rather than summarised.
 */
export function StackStrip() {
  const automaton = useAutomatonStore((s) => activeDocument(s).automaton);
  const simulationResult = useAutomatonStore((s) => activeDocument(s).simulationResult);
  const simulationInput = useAutomatonStore((s) => activeDocument(s).simulationInput);
  const stepIndex = useAutomatonStore((s) => activeDocument(s).simulationStepIndex);

  // Sizing every stack to the deepest one of the whole run keeps the strip
  // from jumping in height while playing.
  const depth = useMemo(() => {
    const deepest = Math.max(
      1,
      ...(simulationResult?.steps.flatMap((s) => s.branches.flatMap((b) => [b.stack.length, b.stack2?.length ?? 0])) ?? []),
    );
    return Math.min(deepest, MAX_DEPTH);
  }, [simulationResult]);

  if (!hasStack(automaton.kind) || !simulationResult) return null;
  const step = simulationResult.steps[stepIndex];
  if (!step) return null;

  const input = [...simulationInput];
  const lastIndex = simulationResult.steps.length - 1;
  // Each PDA step consumes exactly one symbol, so the head sits on input[stepIndex].
  const head = stepIndex;
  const finished = stepIndex === lastIndex && stepIndex === input.length;

  const acceptIds = new Set(automaton.states.filter((s) => s.isAccept).map((s) => s.id));
  const parents = new Map(simulationResult.steps[stepIndex - 1]?.branches.map((b) => [b.key, b]));

  const live = step.branches.slice(0, MAX_CARDS);
  const overflow = step.branches.length - live.length;
  const dead = (step.deadBranches ?? []).slice(0, MAX_DEAD);
  const deadOverflow = (step.deadBranches?.length ?? 0) - dead.length;

  return (
    <div className="stack-strip" style={{ '--stack-depth': depth } as CSSProperties}>
      <div className="stack-strip__head" aria-hidden="true">
        <span className="stack-strip__caret" />
      </div>
      <div className="stack-strip__viewport">
        <div className="stack-strip__track" style={{ transform: `translateX(${-head * CELL}px)` }}>
          {input.map((symbol, i) => (
            <div
              key={i}
              className={['stack-strip__cell', 'mono', i < head && 'is-read', i === head && 'is-head']
                .filter(Boolean)
                .join(' ')}
            >
              {symbol}
            </div>
          ))}
          <div className={['stack-strip__cell', 'stack-strip__end', head >= input.length && 'is-head'].filter(Boolean).join(' ')}>
            fim
          </div>
        </div>
      </div>

      <div className="stack-strip__cards">
        {live.length === 0 && <div className="stack-strip__none">nenhuma configuração ativa</div>}
        {live.map((b) => (
          <StackCard
            // Keyed by step so every card replays its push/pop animation.
            key={`${stepIndex}:${b.key}`}
            automaton={automaton}
            branch={b}
            parent={b.parentKey ? parents.get(b.parentKey) : undefined}
            variant={finished && acceptIds.has(b.stateId) ? 'accept' : 'live'}
          />
        ))}
        {overflow > 0 && <div className="stack-strip__overflow mono">+{overflow}</div>}

        {dead.length > 0 && <span className="stack-strip__divider" aria-hidden="true" />}
        {dead.map((b) => (
          <StackCard key={`${stepIndex}:dead:${b.key}`} automaton={automaton} branch={b} variant="dead" />
        ))}
        {deadOverflow > 0 && <div className="stack-strip__overflow stack-strip__overflow--dead mono">+{deadOverflow}</div>}
      </div>

      <div className="stack-strip__footer mono">
        passo {stepIndex} / {lastIndex}
        {step.symbolConsumed !== null && <> · leu "{step.symbolConsumed}"</>}
        {' · '}
        {step.branches.length} {step.branches.length === 1 ? 'ativa' : 'ativas'}
        {(step.deadBranches?.length ?? 0) > 0 && (
          <>
            {' · '}
            {step.deadBranches!.length} {step.deadBranches!.length === 1 ? 'morreu' : 'morreram'}
          </>
        )}
      </div>
    </div>
  );
}
