import type { InternalNode, Node } from '@xyflow/react';

export const NODE_DIAMETER = 68;

interface Point {
  x: number;
  y: number;
}

function nodeCenter(node: InternalNode<Node>): Point {
  const w = node.measured.width ?? NODE_DIAMETER;
  const h = node.measured.height ?? NODE_DIAMETER;
  return { x: node.internals.positionAbsolute.x + w / 2, y: node.internals.positionAbsolute.y + h / 2 };
}

function nodeRadius(node: InternalNode<Node>, extra: number): number {
  return (node.measured.width ?? NODE_DIAMETER) / 2 + extra;
}

function pointOnCircle(from: Point, towards: Point, radius: number): Point {
  const dx = towards.x - from.x;
  const dy = towards.y - from.y;
  const dist = Math.max(Math.hypot(dx, dy), 1);
  return { x: from.x + (dx / dist) * radius, y: from.y + (dy / dist) * radius };
}

/**
 * Computes where a straight line between two circular nodes crosses each
 * node's boundary. `sourceExtra`/`targetExtra` push the crossing point
 * further out — used so arrowheads land outside the accept "double circle"
 * ring or the dashed selection outline instead of being swallowed by them.
 */
export function getFloatingEdgeParams(
  sourceNode: InternalNode<Node>,
  targetNode: InternalNode<Node>,
  sourceExtra = 0,
  targetExtra = 0,
) {
  const sourceCenter = nodeCenter(sourceNode);
  const targetCenter = nodeCenter(targetNode);
  const sourcePoint = pointOnCircle(sourceCenter, targetCenter, nodeRadius(sourceNode, sourceExtra));
  const targetPoint = pointOnCircle(targetCenter, sourceCenter, nodeRadius(targetNode, targetExtra));
  return { sourcePoint, targetPoint, sourceCenter, targetCenter };
}

/**
 * Quadratic bezier between two points, bowed sideways by `curvature` pixels.
 * Consistently rotating the offset 90° CCW relative to travel direction means
 * A->B and B->A edges between the same pair automatically bow to opposite
 * sides instead of overlapping.
 */
export function buildCurvedPath(source: Point, target: Point, curvature: number) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const len = Math.max(Math.hypot(dx, dy), 1);
  const nx = -dy / len;
  const ny = dx / len;
  const mx = (source.x + target.x) / 2 + nx * curvature;
  const my = (source.y + target.y) / 2 + ny * curvature;

  const path = `M ${source.x},${source.y} Q ${mx},${my} ${target.x},${target.y}`;
  const labelX = 0.25 * source.x + 0.5 * mx + 0.25 * target.x;
  const labelY = 0.25 * source.y + 0.5 * my + 0.25 * target.y;
  return { path, labelX, labelY };
}

/** Straight line between two points, used when there's no reverse edge to bow away from. */
export function buildStraightPath(source: Point, target: Point) {
  const path = `M ${source.x},${source.y} L ${target.x},${target.y}`;
  const labelX = (source.x + target.x) / 2;
  const labelY = (source.y + target.y) / 2;
  return { path, labelX, labelY };
}

/** Loop path for a self-transition, bulging above the node. */
export function buildLoopPath(center: Point, radius: number) {
  const left = { x: center.x - radius * 0.55, y: center.y - radius * 0.86 };
  const right = { x: center.x + radius * 0.55, y: center.y - radius * 0.86 };
  const bulge = radius * 1.9;
  const path = `M ${left.x},${left.y} C ${left.x - bulge * 0.3},${left.y - bulge} ${right.x + bulge * 0.3},${right.y - bulge} ${right.x},${right.y}`;
  return { path, labelX: center.x, labelY: center.y - radius - bulge * 0.62 };
}
