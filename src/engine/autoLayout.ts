import type { Automaton } from '../types/automaton';
import { GRID_SIZE, NODE_DIAMETER } from '../components/Canvas/floatingEdge';

/** Base column/row spacing (center-to-center), clear enough for a self-loop's
 *  upward bulge and an accept state's double-circle ring not to touch the
 *  next state over. Always a multiple of GRID_SIZE. */
const BASE_SPACING = 176;
/** Whitespace kept clear on each side of an edge's label between two columns. */
const LABEL_MARGIN = 40;

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

/** Mirrors the width estimate used for the exported SVG's label pills — doesn't need to
 *  be pixel-perfect, just enough to keep long multi-symbol labels off the states. */
function estimateLabelWidth(text: string): number {
  return Math.max(24, text.length * 7.5 + 16);
}

/**
 * BFS layer (shortest number of hops) from `startId` along directed, non-self
 * transitions. States unreachable from `startId` are simply absent from the
 * result — callers decide how to treat them.
 *
 * Also used outside layout: two states are exactly one hop apart in this
 * numbering if and only if an edge between them follows the automaton's main
 * flow from the start state, which is what decides whether that edge can be
 * drawn as a straight line without risking crossing another edge's path (see
 * `Canvas.tsx`'s edge-curving rule).
 */
export function computeLayers(automaton: Automaton, startId: string): Map<string, number> {
  const forward = new Map<string, string[]>();
  for (const t of automaton.transitions) {
    if (t.from === t.to) continue;
    forward.set(t.from, [...(forward.get(t.from) ?? []), t.to]);
  }

  const layer = new Map<string, number>([[startId, 0]]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layer.get(current)!;
    for (const next of forward.get(current) ?? []) {
      if (!layer.has(next)) {
        layer.set(next, currentLayer + 1);
        queue.push(next);
      }
    }
  }
  return layer;
}

/**
 * Lays out an automaton's states left-to-right in layers (Sugiyama-style),
 * rooted at the start state so it always lands in column 0 — never in the
 * middle or on the right, regardless of any back-edges into it.
 *
 * States unreachable from the start (dead/disconnected states) are appended
 * in one trailing column after the furthest reachable layer.
 *
 * Returns each state's new top-left position, snapped to the grid.
 */
export function computeAutoLayout(automaton: Automaton): Map<string, { x: number; y: number }> {
  const { states, transitions } = automaton;
  const positions = new Map<string, { x: number; y: number }>();
  if (states.length === 0) return positions;

  const startId =
    automaton.startStateId && states.some((s) => s.id === automaton.startStateId)
      ? automaton.startStateId
      : states[0].id;

  // Column spacing widens to fit the longest merged edge label (e.g. "0, 1, 2"),
  // so it never overlaps either state on either side of it.
  const labelsByPair = new Map<string, Set<string>>();
  for (const t of transitions) {
    if (t.from === t.to) continue; // self-loops don't sit between columns
    const key = `${t.from}=>${t.to}`;
    const set = labelsByPair.get(key) ?? new Set<string>();
    set.add(t.input);
    labelsByPair.set(key, set);
  }
  let maxLabelWidth = 0;
  for (const symbols of labelsByPair.values()) {
    maxLabelWidth = Math.max(maxLabelWidth, estimateLabelWidth([...symbols].sort().join(', ')));
  }
  const columnSpacing = Math.max(BASE_SPACING, snap(NODE_DIAMETER + maxLabelWidth + LABEL_MARGIN * 2));

  const predecessors = new Map<string, string[]>();
  for (const t of transitions) {
    if (t.from === t.to) continue;
    predecessors.set(t.to, [...(predecessors.get(t.to) ?? []), t.from]);
  }

  const layer = computeLayers(automaton, startId);
  const reachableMaxLayer = Math.max(0, ...layer.values());
  for (const s of states) {
    if (!layer.has(s.id)) layer.set(s.id, reachableMaxLayer + 1);
  }

  const byLayer = new Map<number, string[]>();
  for (const s of states) {
    const l = layer.get(s.id)!;
    byLayer.set(l, [...(byLayer.get(l) ?? []), s.id]);
  }
  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);

  // Order within each layer by the barycenter of predecessors already placed in
  // the previous layer(s) — one top-down pass, enough to keep mostly-forward
  // automata readable without full iterative crossing minimization.
  const order = new Map<string, number>();
  for (const l of sortedLayers) {
    const ids = byLayer.get(l)!;
    if (l === 0) {
      ids.forEach((id, i) => order.set(id, i));
      continue;
    }
    const withKey = ids.map((id, i) => {
      const placedPreds = (predecessors.get(id) ?? [])
        .map((p) => order.get(p))
        .filter((v): v is number => v !== undefined);
      const barycenter = placedPreds.length > 0 ? placedPreds.reduce((a, b) => a + b, 0) / placedPreds.length : i;
      return { id, barycenter, i };
    });
    withKey.sort((a, b) => a.barycenter - b.barycenter || a.i - b.i);
    withKey.forEach((entry, i) => order.set(entry.id, i));
  }

  for (const l of sortedLayers) {
    const ids = byLayer.get(l)!;
    const count = ids.length;
    const x = l * columnSpacing;
    for (const id of ids) {
      const index = order.get(id)!;
      const y = (index - (count - 1) / 2) * BASE_SPACING;
      positions.set(id, { x: snap(x - NODE_DIAMETER / 2), y: snap(y - NODE_DIAMETER / 2) });
    }
  }

  return positions;
}
