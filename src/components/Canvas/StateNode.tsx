import { useState } from 'react';
import { Handle, Position, useConnection, type NodeProps, type Node } from '@xyflow/react';
import './StateNode.css';

export interface StateNodeData extends Record<string, unknown> {
  label: string;
  isStart: boolean;
  isAccept: boolean;
  isActive: boolean;
  hasError: boolean;
  onRename: (id: string, label: string) => void;
  onToggleAccept: (id: string) => void;
  onSetStart: (id: string) => void;
  onDelete: (id: string) => void;
}

export type StateNodeType = Node<StateNodeData, 'stateNode'>;

/**
 * Both handles are typed "source" (paired with connectionMode="loose" on
 * <ReactFlow>) instead of the usual one-source-one-target split. With a
 * fixed left=target/right=source split, dragging from the edge nearest to
 * another node — the natural gesture for a "return" transition — starts on
 * a target handle, and React Flow's direction is decided by which type you
 * started on: dragging from a target handle and dropping on the other
 * node's target handle silently reconnects source->target the same way as
 * before instead of reversing it, so back-and-forth transitions between two
 * states never went both ways. Making both handles the same type means
 * direction always simply follows drag order: {source: dragStartNode,
 * target: dragEndNode}.
 *
 * The two handles are small circular hotspots at the left/right edge of the
 * circle (not full-height strips) — a connection can only start there;
 * dragging anywhere else on the node body moves the state instead. They
 * still occupy disjoint regions rather than overlapping — React Flow
 * resolves a drop target with a real DOM hit-test (`elementFromPoint`), so
 * an exact overlap would always resolve to the topmost element and a node
 * could never connect to itself.
 */
const HANDLE_SIZE = 18;

const leftHandleStyle = {
  opacity: 0,
  top: '50%',
  left: -HANDLE_SIZE / 2,
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  transform: 'translateY(-50%)',
  borderRadius: '50%',
  border: 'none',
};

const rightHandleStyle = {
  opacity: 0,
  top: '50%',
  right: -HANDLE_SIZE / 2,
  left: 'auto',
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  transform: 'translateY(-50%)',
  borderRadius: '50%',
  border: 'none',
};

export function StateNode({ id, data, selected }: NodeProps<StateNodeType>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  // Hides the hover toolbar while a connection is being dragged, so hovering
  // the receiving node to drop a transition doesn't pop the action buttons up.
  const isConnecting = useConnection((c) => c.inProgress);

  const commitRename = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== data.label) data.onRename(id, trimmed);
    else setDraft(data.label);
  };

  return (
    <div
      className={[
        'state-node',
        data.isAccept && 'is-accept',
        data.isStart && 'is-start',
        data.isActive && 'is-active',
        data.hasError && 'has-error',
        selected && 'is-selected',
        isConnecting && 'is-connect-dragging',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Handle type="source" position={Position.Left} id="left" style={leftHandleStyle} className="state-node__handle" />
      <Handle type="source" position={Position.Right} id="right" style={rightHandleStyle} className="state-node__handle" />

      {data.isStart && <span className="state-node__start-arrow" aria-hidden="true" />}

      <div className="state-node__circle" onDoubleClick={() => data.onToggleAccept(id)}>
        {editing ? (
          <input
            className="state-node__input mono"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setDraft(data.label);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="state-node__label mono">{data.label}</span>
        )}
      </div>

      <div className="state-node__toolbar nodrag">
        <button title="Definir como inicial" onClick={() => data.onSetStart(id)}>
          ▶
        </button>
        <button title="Alternar aceitação" onClick={() => data.onToggleAccept(id)}>
          ◎
        </button>
        <button title="Renomear" onClick={() => setEditing(true)}>
          ✎
        </button>
        <button title="Excluir estado" className="danger" onClick={() => data.onDelete(id)}>
          ✕
        </button>
      </div>
    </div>
  );
}
