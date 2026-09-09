import { activeDocument, useAutomatonStore } from '../../store/useAutomatonStore';
import { BLANK } from '../../types/automaton';
import './TapeStrip.css';

/** Must match `--tape-cell` in TapeStrip.css — the track is offset in pixels. */
const CELL = 42;
/** Blank cells rendered beyond each end of the visited tape, so the strip never runs out. */
const PAD = 20;

/**
 * The Turing machine tape, as a strip floating over the canvas: the head stays
 * fixed at the centre and the tape slides underneath it, which is both the
 * classic depiction and the one that reads clearly during autoplay.
 */
export function TapeStrip() {
  const automaton = useAutomatonStore((s) => activeDocument(s).automaton);
  const simulationResult = useAutomatonStore((s) => activeDocument(s).simulationResult);
  const stepIndex = useAutomatonStore((s) => activeDocument(s).simulationStepIndex);

  if (automaton.kind !== 'TM' || !simulationResult) return null;

  const step = simulationResult.steps[stepIndex];
  const config = step?.branches[0];
  if (!config?.tape || config.head === undefined) return null;

  const { tape, head } = config;
  const stateLabel = automaton.states.find((s) => s.id === config.stateId)?.label ?? '?';
  const lastIndex = simulationResult.steps.length - 1;

  // Indices run from -PAD to tape.length + PAD; anything outside the visited
  // window is an implicit blank, which is what makes the tape read as infinite.
  const cells = [];
  for (let i = -PAD; i < tape.length + PAD; i += 1) {
    const symbol = tape[i] ?? BLANK;
    const isHead = i === head;
    cells.push(
      <div
        key={i}
        className={[
          'tape-strip__cell',
          'mono',
          isHead && 'is-head',
          symbol === BLANK && 'is-blank',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {symbol}
      </div>,
    );
  }

  return (
    <div className="tape-strip">
      <div className="tape-strip__head">
        <span className="tape-strip__state mono">{stateLabel}</span>
        <span className="tape-strip__caret" aria-hidden="true" />
      </div>

      <div className="tape-strip__viewport">
        <div
          className="tape-strip__track"
          style={{ transform: `translateX(${-(head + PAD) * CELL}px)` }}
        >
          {cells}
        </div>
      </div>

      <div className="tape-strip__footer mono">
        passo {stepIndex} / {lastIndex}
      </div>
    </div>
  );
}
