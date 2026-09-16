import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  ControlButton,
  MiniMap,
  MarkerType,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type OnNodeDrag,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { activeDocument, useAutomatonStore } from '../../store/useAutomatonStore';
import { validate } from '../../engine/validate';
import { StateNode, type StateNodeType } from './StateNode';
import { TransitionEdge, type TransitionEdgeType } from './TransitionEdge';
import { TapeStrip } from './TapeStrip';
import { StackStrip } from './StackStrip';
import { GRID_SIZE, NODE_DIAMETER } from './floatingEdge';
import { exportAutomatonToPng } from '../../persistence/exportImage';
import { formatTransitionLabels, type Transition } from '../../types/automaton';
import {
  PDA_SYNTAX_PLACEHOLDER,
  TURING_SYNTAX_PLACEHOLDER,
  formatPdaTransitions,
  formatTuringTransitions,
  parsePdaTransitions,
  parseTuringTransitions,
} from '../../engine/transitionSyntax';
import { planPdaEdit, planSymbolEdit, planTuringEdit, type TransitionEdit } from '../../engine/labelEditing';
import './Canvas.css';

const nodeTypes = { stateNode: StateNode };
const edgeTypes = { transitionEdge: TransitionEdge };

const snapToGridSize = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

/**
 * Single source of truth for an edge's color, shared between the visible
 * path and its arrowhead marker (a separate SVG `<marker>` def that doesn't
 * automatically track the path's own color/hover state).
 */
function edgeColor({
  isArmed,
  isHovered,
  isActive,
  hasError,
}: {
  isArmed: boolean;
  isHovered: boolean;
  isActive: boolean;
  hasError: boolean;
}): string {
  if (isArmed) return 'var(--error)';
  if (isHovered) return 'var(--accent)';
  if (isActive) return 'var(--active)';
  if (hasError) return 'var(--error)';
  return 'var(--border-strong)';
}

function CanvasInner() {
  const automaton = useAutomatonStore((s) => activeDocument(s).automaton);
  const addState = useAutomatonStore((s) => s.addState);
  const updateStatePosition = useAutomatonStore((s) => s.updateStatePosition);
  const renameState = useAutomatonStore((s) => s.renameState);
  const toggleAccept = useAutomatonStore((s) => s.toggleAccept);
  const setStart = useAutomatonStore((s) => s.setStart);
  const removeState = useAutomatonStore((s) => s.removeState);
  const addTransition = useAutomatonStore((s) => s.addTransition);
  const autoLayout = useAutomatonStore((s) => s.autoLayout);
  const updateTransition = useAutomatonStore((s) => s.updateTransition);
  const removeTransition = useAutomatonStore((s) => s.removeTransition);
  const setAlphabet = useAutomatonStore((s) => s.setAlphabet);
  const setTapeAlphabet = useAutomatonStore((s) => s.setTapeAlphabet);
  const setStackAlphabet = useAutomatonStore((s) => s.setStackAlphabet);
  const simulationResult = useAutomatonStore((s) => activeDocument(s).simulationResult);
  const simulationStepIndex = useAutomatonStore((s) => activeDocument(s).simulationStepIndex);
  const snapToGrid = useAutomatonStore((s) => s.snapToGrid);
  const toggleSnapToGrid = useAutomatonStore((s) => s.toggleSnapToGrid);

  const { screenToFlowPosition, fitView } = useReactFlow();
  const [autoFocusKey, setAutoFocusKey] = useState<string | null>(null);
  const [draftEdge, setDraftEdge] = useState<{ source: string; target: string } | null>(null);
  /** Clicking a transition once arms it (red); clicking it again deletes it. */
  const [armedEdgeKey, setArmedEdgeKey] = useState<string | null>(null);
  const [hoveredEdgeKey, setHoveredEdgeKey] = useState<string | null>(null);

  const activeStateIds = useMemo(() => {
    if (!simulationResult) return new Set<string>();
    const step = simulationResult.steps[simulationStepIndex];
    return new Set(step?.branches.map((b) => b.stateId) ?? []);
  }, [simulationResult, simulationStepIndex]);

  const activeTransitionIds = useMemo(() => {
    if (!simulationResult) return new Set<string>();
    const step = simulationResult.steps[simulationStepIndex];
    return new Set(step?.branches.flatMap((b) => b.viaTransitionIds) ?? []);
  }, [simulationResult, simulationStepIndex]);

  const issues = useMemo(() => validate(automaton), [automaton]);
  const errorStateIds = useMemo(
    () => new Set(issues.filter((i) => i.severity === 'error' && i.stateId).map((i) => i.stateId!)),
    [issues],
  );
  const errorTransitionIds = useMemo(
    () => new Set(issues.filter((i) => i.severity === 'error' && i.transitionId).map((i) => i.transitionId!)),
    [issues],
  );

  const storeNodes = useMemo<StateNodeType[]>(
    () =>
      automaton.states.map((s) => ({
        id: s.id,
        type: 'stateNode',
        position: s.position,
        data: {
          label: s.label,
          isStart: s.isStart,
          isAccept: s.isAccept,
          isActive: activeStateIds.has(s.id),
          hasError: errorStateIds.has(s.id),
          onRename: renameState,
          onToggleAccept: toggleAccept,
          onSetStart: setStart,
          onDelete: removeState,
        },
      })),
    [automaton.states, activeStateIds, errorStateIds, renameState, toggleAccept, setStart, removeState],
  );

  const applyTransitionEdit = useCallback(
    (edit: TransitionEdit) => {
      for (const id of edit.remove) removeTransition(id);
      for (const { id, patch } of edit.update) updateTransition(id, patch);
      for (const transition of edit.add) addTransition(transition);
      setAutoFocusKey(null);
    },
    [addTransition, updateTransition, removeTransition],
  );

  const handleCommitSymbols = useCallback(
    (from: string, to: string, csv: string) => {
      const edit = planSymbolEdit(automaton, from, to, csv);
      applyTransitionEdit(edit);
      if (edit.newInputSymbols.length > 0) setAlphabet([...automaton.alphabet, ...edit.newInputSymbols].sort());
    },
    [automaton, applyTransitionEdit, setAlphabet],
  );

  const handleCommitTuring = useCallback(
    (from: string, to: string, text: string) => {
      const edit = planTuringEdit(automaton, from, to, text);
      if (!edit) return;
      applyTransitionEdit(edit);
      if (edit.newTapeSymbols.length > 0) {
        setTapeAlphabet([...(automaton.tapeAlphabet ?? []), ...edit.newTapeSymbols].sort());
      }
      if (edit.newInputSymbols.length > 0) {
        setAlphabet([...automaton.alphabet, ...edit.newInputSymbols].sort());
      }
    },
    [automaton, applyTransitionEdit, setAlphabet, setTapeAlphabet],
  );

  const handleCommitPda = useCallback(
    (from: string, to: string, text: string) => {
      const edit = planPdaEdit(automaton, from, to, text);
      if (!edit) return;
      applyTransitionEdit(edit);
      if (edit.newStackSymbols.length > 0) {
        setStackAlphabet([...(automaton.stackAlphabet ?? []), ...edit.newStackSymbols].sort());
      }
      if (edit.newInputSymbols.length > 0) {
        setAlphabet([...automaton.alphabet, ...edit.newInputSymbols].sort());
      }
    },
    [automaton, applyTransitionEdit, setAlphabet, setStackAlphabet],
  );

  const validateTuringText = useCallback((text: string) => {
    const parsed = parseTuringTransitions(text);
    return parsed.ok ? null : parsed.error;
  }, []);

  const validatePdaText = useCallback((text: string) => {
    const parsed = parsePdaTransitions(text);
    return parsed.ok ? null : parsed.error;
  }, []);

  /**
   * How a transition label is typed and read back, which is the only thing that
   * differs between kinds: a symbol list, a read/write/move triple, or a
   * read/pop/push one.
   */
  const labelEditor = useMemo(() => {
    if (automaton.kind === 'TM') {
      return {
        placeholder: TURING_SYNTAX_PLACEHOLDER,
        validateText: validateTuringText,
        format: (transitions: Transition[]) =>
          formatTuringTransitions(
            transitions.map((t) => ({ input: t.input, write: t.write || t.input, move: t.move ?? 'R' })),
          ),
        commit: handleCommitTuring,
      };
    }
    if (automaton.kind === 'PDA') {
      return {
        placeholder: PDA_SYNTAX_PLACEHOLDER,
        validateText: validatePdaText,
        format: (transitions: Transition[]) =>
          formatPdaTransitions(transitions.map((t) => ({ input: t.input, pop: t.pop ?? '', push: t.push ?? '' }))),
        commit: handleCommitPda,
      };
    }
    return {
      placeholder: undefined,
      validateText: undefined,
      format: (transitions: Transition[]) => transitions.map((t) => t.input).join(','),
      commit: handleCommitSymbols,
    };
  }, [
    automaton.kind,
    validateTuringText,
    validatePdaText,
    handleCommitTuring,
    handleCommitPda,
    handleCommitSymbols,
  ]);

  const storeEdges = useMemo<TransitionEdgeType[]>(() => {
    const groups = new Map<string, Transition[]>();
    for (const t of automaton.transitions) {
      const key = `${t.from}=>${t.to}`;
      const list = groups.get(key) ?? [];
      list.push(t);
      groups.set(key, list);
    }
    const result: TransitionEdgeType[] = [...groups.entries()].map(([key, unsortedTransitions]) => {
      const transitions = [...unsortedTransitions].sort((a, b) => a.input.localeCompare(b.input));
      const from = transitions[0].from;
      const to = transitions[0].to;
      const isActive = transitions.some((t) => activeTransitionIds.has(t.id));
      const hasError = transitions.some((t) => errorTransitionIds.has(t.id));
      const isArmed = key === armedEdgeKey;
      const isHovered = key === hoveredEdgeKey;
      const color = edgeColor({ isArmed, isHovered, isActive, hasError });
      const curved = from !== to && groups.has(`${to}=>${from}`);
      return {
        id: key,
        source: from,
        target: to,
        type: 'transitionEdge',
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        data: {
          label: formatTransitionLabels(automaton.kind, transitions),
          color,
          isActive,
          isArmed,
          curved,
          transitionIds: transitions.map((t) => t.id),
          editable: true,
          editText: labelEditor.format(transitions),
          placeholder: labelEditor.placeholder,
          validateText: labelEditor.validateText,
          autoFocus: key === autoFocusKey,
          onCommitText: (text: string) => labelEditor.commit(from, to, text),
        },
      };
    });

    // A freshly dragged connection with no symbols yet: renders as an empty,
    // editable label with no underlying transitions until something is typed.
    if (draftEdge && !groups.has(`${draftEdge.source}=>${draftEdge.target}`)) {
      result.push({
        id: `${draftEdge.source}=>${draftEdge.target}`,
        source: draftEdge.source,
        target: draftEdge.target,
        type: 'transitionEdge',
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border-strong)', width: 16, height: 16 },
        data: {
          label: '',
          color: 'var(--border-strong)',
          isActive: false,
          isArmed: false,
          curved: draftEdge.source !== draftEdge.target && groups.has(`${draftEdge.target}=>${draftEdge.source}`),
          transitionIds: [],
          editable: true,
          editText: '',
          placeholder: labelEditor.placeholder,
          validateText: labelEditor.validateText,
          autoFocus: true,
          onCommitText: (text: string) => {
            labelEditor.commit(draftEdge.source, draftEdge.target, text);
            setDraftEdge(null);
          },
          onCancel: () => setDraftEdge(null),
        },
      });
    }

    return result;
  }, [
    automaton.transitions,
    automaton.kind,
    activeTransitionIds,
    errorTransitionIds,
    autoFocusKey,
    labelEditor,
    draftEdge,
    armedEdgeKey,
    hoveredEdgeKey,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);

  useEffect(() => setNodes(storeNodes), [storeNodes, setNodes]);
  useEffect(() => setEdges(storeEdges), [storeEdges, setEdges]);

  // Re-frame the view when switching to a different automaton tab, since its
  // states can live anywhere on the (shared, unbounded) canvas coordinate space.
  useEffect(() => {
    fitView({ padding: 0.35, maxZoom: 1, duration: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automaton.id]);

  const [layoutRun, setLayoutRun] = useState(0);
  // Re-frame after an auto-layout pass, once the repositioned nodes have
  // actually reached ReactFlow's internal store (the `nodes` prop effect above
  // runs first, in the same commit, since it's declared earlier).
  useEffect(() => {
    if (layoutRun === 0) return;
    fitView({ padding: 0.35, maxZoom: 1, duration: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutRun]);

  const handleExportPng = useCallback(() => {
    exportAutomatonToPng(automaton);
  }, [automaton]);

  const handleAutoLayout = useCallback(() => {
    autoLayout();
    setLayoutRun((n) => n + 1);
  }, [autoLayout]);

  const handlePaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      // Only create a state when the background itself was double-clicked,
      // not a node/edge/label bubbling up through it.
      const target = event.target as HTMLElement;
      if (!target.classList.contains('react-flow__pane')) return;
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      let position = { x: flowPos.x - NODE_DIAMETER / 2, y: flowPos.y - NODE_DIAMETER / 2 };
      if (snapToGrid) position = { x: snapToGridSize(position.x), y: snapToGridSize(position.y) };
      addState(position);
    },
    [addState, screenToFlowPosition, snapToGrid],
  );

  const handleNodeDragStop: OnNodeDrag<StateNodeType> = useCallback(
    (_event, node) => updateStatePosition(node.id, node.position),
    [updateStatePosition],
  );

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return;
      const alreadyExists = automaton.transitions.some(
        (t) => t.from === connection.source && t.to === connection.target,
      );
      if (alreadyExists) {
        setAutoFocusKey(`${connection.source}=>${connection.target}`);
      } else {
        setDraftEdge({ source: connection.source, target: connection.target });
      }
    },
    [automaton.transitions],
  );

  const handleEdgesDelete = useCallback(
    (deleted: TransitionEdgeType[]) => {
      for (const edge of deleted) {
        const ids = (edge.data?.transitionIds as string[] | undefined) ?? [];
        for (const id of ids) removeTransition(id);
      }
    },
    [removeTransition],
  );

  const handleNodesDelete = useCallback(
    (deleted: StateNodeType[]) => {
      for (const node of deleted) removeState(node.id);
    },
    [removeState],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: TransitionEdgeType) => {
      // Clicking the line (not the label, which edits the transitions inline)
      // arms it for deletion; clicking the same, already-armed line again
      // deletes it. Undo (Ctrl+Z) covers accidental deletes.
      if (armedEdgeKey === edge.id) {
        const ids = (edge.data?.transitionIds as string[] | undefined) ?? [];
        for (const id of ids) removeTransition(id);
        setArmedEdgeKey(null);
      } else {
        setArmedEdgeKey(edge.id);
      }
    },
    [armedEdgeKey, removeTransition],
  );

  return (
    <div className="canvas-wrap">
      {automaton.states.length === 0 && (
        <div className="canvas-hint">Dê um duplo clique em qualquer lugar do canvas para criar o primeiro estado.</div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={() => setArmedEdgeKey(null)}
        onDoubleClick={handlePaneDoubleClick}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        onEdgeMouseEnter={(_event, edge) => setHoveredEdgeKey(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdgeKey(null)}
        onEdgesDelete={handleEdgesDelete}
        onNodesDelete={handleNodesDelete}
        deleteKeyCode={['Backspace', 'Delete']}
        connectionMode={ConnectionMode.Loose}
        // Covers the whole node circle (radius ~34px, ~48px to a far corner)
        // so a transition can be dropped anywhere on the receiving node, not
        // just on its small left/right connect handles.
        connectionRadius={55}
        zoomOnDoubleClick={false}
        snapToGrid={snapToGrid}
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        fitView
        fitViewOptions={{ padding: 0.35, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--border)" />
        <Controls showInteractive={false}>
          <ControlButton onClick={toggleSnapToGrid} title="Alinhar ao grid">
            <span className="msy">{snapToGrid ? 'grid_on' : 'grid_off'}</span>
          </ControlButton>
          <ControlButton
            onClick={handleAutoLayout}
            disabled={automaton.states.length === 0 || !automaton.startStateId}
            title="Reorganizar automaticamente"
          >
            <span className="msy">schema</span>
          </ControlButton>
          <ControlButton onClick={handleExportPng} disabled={automaton.states.length === 0} title="Exportar como PNG">
            <span className="msy">download</span>
          </ControlButton>
        </Controls>
        <MiniMap pannable zoomable className="canvas-minimap" />
      </ReactFlow>

      <TapeStrip />
      <StackStrip />
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
