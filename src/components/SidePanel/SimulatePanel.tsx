import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { activeDocument, useAutomatonStore } from '../../store/useAutomatonStore';
import { BLANK, hasStack } from '../../types/automaton';
import type { SimulationResult } from '../../engine/simulate';

const SPEED_MIN = 150;
const SPEED_MAX = 1800;

/**
 * A Turing machine doesn't reject by running out of input — it rejects by
 * halting with no move available, and may not halt at all. The banner names
 * which of those happened instead of just "rejeitada".
 */
function turingOutcome(
  result: SimulationResult,
  stateLabel: string,
  read: string,
): { tone: 'accept' | 'reject' | 'warning'; icon: string; label: string; note?: string } {
  if (result.haltReason === 'accept') {
    return { tone: 'accept', icon: 'check_circle', label: 'Aceita', note: `parou em ${stateLabel}` };
  }
  if (result.haltReason === 'step-limit') {
    return {
      tone: 'warning',
      icon: 'hourglass_disabled',
      label: 'Não parou',
      note: 'limite de passos atingido — a máquina pode estar em laço infinito',
    };
  }
  return {
    tone: 'reject',
    icon: 'cancel',
    label: 'Rejeitada',
    note: `parou em ${stateLabel}: nenhuma transição lendo "${read}"`,
  };
}

export function SimulatePanel() {
  const automaton = useAutomatonStore((s) => activeDocument(s).automaton);
  const simulationInput = useAutomatonStore((s) => activeDocument(s).simulationInput);
  const setSimulationInput = useAutomatonStore((s) => s.setSimulationInput);
  const simulationResult = useAutomatonStore((s) => activeDocument(s).simulationResult);
  const simulationStepIndex = useAutomatonStore((s) => activeDocument(s).simulationStepIndex);
  const isPlaying = useAutomatonStore((s) => activeDocument(s).isPlaying);
  const playbackSpeedMs = useAutomatonStore((s) => activeDocument(s).playbackSpeedMs);
  const runSimulation = useAutomatonStore((s) => s.runSimulation);
  const stepForward = useAutomatonStore((s) => s.stepForward);
  const stepBack = useAutomatonStore((s) => s.stepBack);
  const restartPlayback = useAutomatonStore((s) => s.restartPlayback);
  const resetSimulation = useAutomatonStore((s) => s.resetSimulation);
  const setPlaying = useAutomatonStore((s) => s.setPlaying);
  const setPlaybackSpeed = useAutomatonStore((s) => s.setPlaybackSpeed);

  const steps = simulationResult?.steps ?? [];
  const atEnd = simulationResult ? simulationStepIndex >= steps.length - 1 : true;

  useEffect(() => {
    if (!isPlaying || atEnd) return;
    const timer = setTimeout(stepForward, playbackSpeedMs);
    return () => clearTimeout(timer);
  }, [isPlaying, atEnd, playbackSpeedMs, simulationStepIndex, stepForward]);

  const currentStep = steps[simulationStepIndex];
  const stateById = new Map(automaton.states.map((s) => [s.id, s]));

  const isTm = automaton.kind === 'TM';
  const tmConfig = isTm ? currentStep?.branches[0] : undefined;
  const tmRead = tmConfig?.tape?.[tmConfig.head ?? 0] ?? BLANK;
  const tmStateLabel = tmConfig ? (stateById.get(tmConfig.stateId)?.label ?? tmConfig.stateId) : '?';

  const speedSliderValue = 1950 - playbackSpeedMs;
  const speedFillPct = ((speedSliderValue - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100;

  return (
    <div className="simulate-panel">
      <div className="field">
        <label>String de entrada</label>
        <input
          className="mono"
          value={simulationInput}
          onChange={(e) => setSimulationInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSimulation()}
          placeholder={automaton.alphabet.length > 0 ? `Ex.: ${automaton.alphabet.join('')}` : undefined}
        />
      </div>

      {!simulationResult ? (
        <button className="btn btn-primary" onClick={runSimulation} disabled={!automaton.startStateId}>
          <span className="msy">play_arrow</span> Simular
        </button>
      ) : (
        <>
          <div className="simulate-panel__controls">
            <button className="btn" onClick={stepBack} disabled={simulationStepIndex === 0} title="Passo anterior">
              <span className="msy">skip_previous</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => (atEnd ? restartPlayback() : setPlaying(!isPlaying))}
              title={atEnd ? 'Reproduzir novamente' : isPlaying ? 'Pausar' : 'Reproduzir automaticamente'}
            >
              <span className="msy">{atEnd ? 'replay' : isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>
            <button className="btn" onClick={stepForward} disabled={atEnd} title="Próximo passo">
              <span className="msy">skip_next</span>
            </button>
            <button className="btn" onClick={resetSimulation} title="Reiniciar">
              <span className="msy">restart_alt</span>
            </button>
          </div>

          <div className="field">
            <div className="simulate-panel__speed-label">
              <label>Velocidade</label>
              <span className="mono simulate-panel__speed-value">{playbackSpeedMs}ms/passo</span>
            </div>
            <div className="simulate-panel__speed-row">
              <span className="msy" aria-hidden="true">hourglass_bottom</span>
              <input
                type="range"
                min={SPEED_MIN}
                max={SPEED_MAX}
                step={50}
                value={speedSliderValue}
                onChange={(e) => setPlaybackSpeed(1950 - Number(e.target.value))}
                style={{ '--range-fill': `${speedFillPct}%` } as CSSProperties}
                aria-label="Velocidade de reprodução"
              />
              <span className="msy" aria-hidden="true">bolt</span>
            </div>
          </div>

          <div className="simulate-panel__progress mono">
            passo {simulationStepIndex} / {steps.length - 1}
            {!isTm && currentStep?.symbolConsumed !== null && currentStep && (
              <span> · lendo "{currentStep.symbolConsumed}"</span>
            )}
          </div>

          <div className="simulate-panel__branches">
            {isTm ? (
              tmConfig && (
                <div className={`branch-chip ${stateById.get(tmConfig.stateId)?.isAccept ? 'branch-chip--accept' : ''}`}>
                  <span className="mono">{tmStateLabel}</span>
                  <span className="branch-chip__stack mono">lê "{tmRead}"</span>
                </div>
              )
            ) : (
              <>
                {currentStep?.branches.length === 0 && (
                  <div className="branch-chip branch-chip--dead">sem configurações ativas (rejeitado)</div>
                )}
                {currentStep?.branches.map((b) => (
                  <div key={b.key} className={`branch-chip ${stateById.get(b.stateId)?.isAccept ? 'branch-chip--accept' : ''}`}>
                    <span className="mono">{stateById.get(b.stateId)?.label ?? b.stateId}</span>
                    {hasStack(automaton.kind) && (
                      <span className="branch-chip__stack mono">[{b.stack.join(' ') || 'vazia'}]</span>
                    )}
                    {automaton.kind === '2PDA' && (
                      <span className="branch-chip__stack mono">[{(b.stack2 ?? []).join(' ') || 'vazia'}]</span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {atEnd &&
            (isTm ? (
              (() => {
                const outcome = turingOutcome(simulationResult, tmStateLabel, tmRead);
                return (
                  <div className={`result-banner result-banner--${outcome.tone}`}>
                    <span className="result-banner__label">
                      <span className="msy">{outcome.icon}</span>
                      {outcome.label}
                    </span>
                    {outcome.note && <span className="result-banner__note">{outcome.note}</span>}
                  </div>
                );
              })()
            ) : (
              <div className={`result-banner ${simulationResult.accepted ? 'result-banner--accept' : 'result-banner--reject'}`}>
                <span className="result-banner__label">
                  <span className="msy">{simulationResult.accepted ? 'check_circle' : 'cancel'}</span>
                  {simulationResult.accepted ? 'Aceita' : 'Rejeitada'}
                </span>
                {simulationResult.truncated && <span className="result-banner__note">(execução truncada por limite de passos)</span>}
              </div>
            ))}
        </>
      )}
    </div>
  );
}
