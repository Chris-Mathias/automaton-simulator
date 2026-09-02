import { useEffect, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps, type InternalNode, type Node } from '@xyflow/react';
import { NODE_DIAMETER, buildCurvedPath, buildLoopPath, buildStraightPath, getFloatingEdgeParams } from './floatingEdge';
import type { StateNodeData } from './StateNode';
import './TransitionEdge.css';

export interface TransitionEdgeData extends Record<string, unknown> {
  label: string;
  /** Resolved by the canvas (armed > hovered > active > error > default) — shared with the arrowhead marker. */
  color: string;
  isActive: boolean;
  /** Armed for deletion: this transition was already clicked once; clicking it again deletes it. */
  isArmed: boolean;
  /** True when a transition also exists in the opposite direction (A->B and B->A); curves so the two don't overlap. */
  curved: boolean;
  /** DFA/NFA only: lets the label itself be edited as a comma-separated symbol list. */
  editable?: boolean;
  symbolsCsv?: string;
  autoFocus?: boolean;
  onCommitSymbols?: (csv: string) => void;
  /** Draft (not-yet-created) edges disappear instead of reverting when Escape is pressed. */
  onCancel?: () => void;
}

export type TransitionEdgeType = Edge<TransitionEdgeData, 'transitionEdge'>;

const CURVATURE = 38;

/**
 * Accept states get an extra box-shadow "double circle" ring (~8px past the
 * border) and selected states get a dashed outline (~6px past the border).
 * Neither changes the node's actual layout size, so without this the arrow
 * endpoint (computed from the plain 34px radius) lands underneath those
 * rings instead of just outside them.
 */
function extraRadiusFor(node: InternalNode<Node>): number {
  const data = node.data as Partial<StateNodeData> | undefined;
  if (data?.isAccept) return 9;
  if (node.selected) return 9;
  return 2;
}

export function TransitionEdge({ id, source, target, data, markerEnd }: EdgeProps<TransitionEdgeType>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (data?.autoFocus) {
      setDraft(data.symbolsCsv ?? '');
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.autoFocus]);

  if (!sourceNode || !targetNode || !data) return null;

  const isSelfLoop = source === target;
  let path: string;
  let labelX: number;
  let labelY: number;

  if (isSelfLoop) {
    const w = sourceNode.measured.width ?? NODE_DIAMETER;
    const center = {
      x: sourceNode.internals.positionAbsolute.x + w / 2,
      y: sourceNode.internals.positionAbsolute.y + w / 2,
    };
    ({ path, labelX, labelY } = buildLoopPath(center, w / 2 + extraRadiusFor(sourceNode)));
  } else {
    const { sourcePoint, targetPoint } = getFloatingEdgeParams(
      sourceNode,
      targetNode,
      extraRadiusFor(sourceNode),
      extraRadiusFor(targetNode),
    );
    ({ path, labelX, labelY } = data.curved
      ? buildCurvedPath(sourcePoint, targetPoint, CURVATURE)
      : buildStraightPath(sourcePoint, targetPoint));
  }

  const commit = () => {
    setEditing(false);
    data.onCommitSymbols?.(draft);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: data.color,
          strokeWidth: data.isActive || data.isArmed ? 2.75 : 1.75,
          strokeDasharray: data.isArmed ? '5 4' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="transition-edge__label-wrap nodrag nopan"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {editing ? (
            <input
              autoFocus
              className="transition-edge__input mono"
              value={draft}
              style={{ width: `calc(${Math.max(1, draft.length)}ch + 22px)` }}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') {
                  setEditing(false);
                  data.onCancel?.();
                }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className={[
                'transition-edge__label',
                'mono',
                data.isActive && 'is-active',
                data.isArmed && 'is-armed',
                data.editable && 'is-editable',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={
                data.editable
                  ? (e) => {
                      e.stopPropagation();
                      setDraft(data.symbolsCsv ?? '');
                      setEditing(true);
                    }
                  : undefined
              }
            >
              {data.label || '?'}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
