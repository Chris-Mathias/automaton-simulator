import { NODE_DIAMETER, buildCurvedPath, buildLoopPath, buildStraightPath } from '../components/Canvas/floatingEdge';
import { formatTransitionLabels, type Automaton, type Transition } from '../types/automaton';

/**
 * Builds the export PNG from the automaton's *data* (positions, labels,
 * transitions) as a small, self-contained SVG — rather than rasterizing a
 * snapshot of the live on-screen canvas. Earlier attempts did the latter
 * (via html-to-image cloning the React Flow DOM), but that pulled in a
 * whole class of unreliable behavior: CSS custom properties and
 * transitions resolving inconsistently in the clone, web fonts racing to
 * load, and — the one that finally killed the approach — edge strokes and
 * arrowheads silently failing to rasterize in some browsers because they
 * sit in an SVG nested inside the cloned DOM. A hand-built SVG with literal
 * colors and no nested foreignObject sidesteps all of that, and as a bonus
 * needs no theme flip on the live page, so there's nothing to flash either.
 */

const RADIUS = NODE_DIAMETER / 2;
const CURVATURE = 38;
const PADDING = 30;

const INK = '#000000';
const NODE_FILL = '#ffffff';
const TEXT_COLOR = '#171a21';
const ACCEPT_COLOR = '#059669';
const START_COLOR = '#d97706';
const BG_COLOR = '#f5f6f9';
const LABEL_FILL = '#ffffff';
const LABEL_BORDER = '#c5cad6';
const FONT_UI = "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

interface Point {
  x: number;
  y: number;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pointOnCircle(from: Point, towards: Point, radius: number): Point {
  const dx = towards.x - from.x;
  const dy = towards.y - from.y;
  const dist = Math.max(Math.hypot(dx, dy), 1);
  return { x: from.x + (dx / dist) * radius, y: from.y + (dy / dist) * radius };
}

function labelMarkup(text: string, x: number, y: number): string {
  const w = Math.max(24, text.length * 7.5 + 16);
  const h = 24;
  return (
    `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="6" fill="${LABEL_FILL}" stroke="${LABEL_BORDER}" />` +
    `<text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_MONO}" font-size="13" fill="${TEXT_COLOR}">${escapeXml(text)}</text>`
  );
}

function buildSvg(automaton: Automaton): { svg: string; width: number; height: number } {
  const centers = new Map<string, Point>(automaton.states.map((s) => [s.id, { x: s.position.x + RADIUS, y: s.position.y + RADIUS }]));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of centers.values()) {
    minX = Math.min(minX, c.x - RADIUS);
    minY = Math.min(minY, c.y - RADIUS);
    maxX = Math.max(maxX, c.x + RADIUS);
    maxY = Math.max(maxY, c.y + RADIUS);
  }
  // Room for the start arrow (sticks out ~28px left of its node) and self-loop bulges (~65px above).
  minX -= 40;
  minY -= 75;
  maxX += 20;
  maxY += 20;

  const width = Math.max(1, maxX - minX) + PADDING * 2;
  const height = Math.max(1, maxY - minY) + PADDING * 2;
  const offsetX = PADDING - minX;
  const offsetY = PADDING - minY;
  const at = (p: Point): Point => ({ x: p.x + offsetX, y: p.y + offsetY });

  const groups = new Map<string, Transition[]>();
  for (const t of automaton.transitions) {
    const key = `${t.from}=>${t.to}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(t);
  }

  let edgesSvg = '';
  for (const [key, group] of groups) {
    const [from, to] = key.split('=>');
    const fromCenter = centers.get(from);
    const toCenter = centers.get(to);
    if (!fromCenter || !toCenter) continue;

    const label = formatTransitionLabels(automaton.kind, [...group].sort((a, b) => a.input.localeCompare(b.input)));

    let path: string;
    let labelX: number;
    let labelY: number;
    if (from === to) {
      ({ path, labelX, labelY } = buildLoopPath(at(fromCenter), RADIUS + 2));
    } else {
      const source = pointOnCircle(at(fromCenter), at(toCenter), RADIUS + 2);
      const target = pointOnCircle(at(toCenter), at(fromCenter), RADIUS + 6);
      // Mirrors the canvas: straight unless a transition also exists in the
      // opposite direction, in which case the two edges bow apart so they don't overlap.
      const curved = groups.has(`${to}=>${from}`);
      ({ path, labelX, labelY } = curved ? buildCurvedPath(source, target, CURVATURE) : buildStraightPath(source, target));
    }

    edgesSvg += `<path d="${path}" fill="none" stroke="${INK}" stroke-width="1.75" marker-end="url(#arrow)" />`;
    edgesSvg += labelMarkup(label, labelX, labelY);
  }

  let nodesSvg = '';
  for (const s of automaton.states) {
    const c = at(centers.get(s.id)!);
    if (s.isAccept) {
      nodesSvg += `<circle cx="${c.x}" cy="${c.y}" r="${RADIUS + 6}" fill="none" stroke="${ACCEPT_COLOR}" stroke-width="2.5" />`;
    }
    if (s.isStart) {
      const tailX = c.x - RADIUS - 26;
      const headX = c.x - RADIUS - 3;
      nodesSvg += `<line x1="${tailX}" y1="${c.y}" x2="${headX}" y2="${c.y}" stroke="${START_COLOR}" stroke-width="2.5" />`;
      nodesSvg += `<polygon points="${headX - 1},${c.y - 6} ${headX + 8},${c.y} ${headX - 1},${c.y + 6}" fill="${START_COLOR}" />`;
    }
    nodesSvg += `<circle cx="${c.x}" cy="${c.y}" r="${RADIUS}" fill="${NODE_FILL}" stroke="${INK}" stroke-width="2.5" />`;
    nodesSvg += `<text x="${c.x}" y="${c.y + 1}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_UI}" font-size="14" font-weight="600" fill="${TEXT_COLOR}">${escapeXml(s.label)}</text>`;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 Z" fill="${INK}" /></marker></defs>` +
    `<rect width="${width}" height="${height}" fill="${BG_COLOR}" />` +
    edgesSvg +
    nodesSvg +
    `</svg>`;

  return { svg, width, height };
}

function svgToPngDataUrl(svg: string, width: number, height: number, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas 2D context unavailable.'));
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize the diagram SVG.'));
    };
    img.src = url;
  });
}

export async function exportAutomatonToPng(automaton: Automaton): Promise<void> {
  if (automaton.states.length === 0) return;

  const { svg, width, height } = buildSvg(automaton);
  const dataUrl = await svgToPngDataUrl(svg, width, height);

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${automaton.name.trim().replace(/\s+/g, '-') || 'automato'}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
