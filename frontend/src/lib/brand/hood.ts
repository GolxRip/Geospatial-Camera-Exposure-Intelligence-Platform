import geometry from './hood-geometry.json';
import { manualFacts } from '@/lib/content/facts.manual';
import { clamp } from '@/lib/utils';

/**
 * Hood geometry, shared by the SVG HoodGauge and (later) the WebGL hood so the two cannot disagree
 * (FRONTEND_SPEC.md section 6.3). Everything is derived from assets/logo/cobra-mark.geometry.json, which
 * build_logo.py writes; nothing is redrawn by hand. Angles are degrees, 0 = up, clockwise. Units are the
 * 200 x 200 viewBox of the mark.
 */
export const HOOD = geometry;

const first = geometry.ribs[0];
const second = geometry.ribs[1];
const last = geometry.ribs[geometry.ribs.length - 1];
if (!first || !second || !last) throw new Error('hood-geometry.json has no ribs');

export const RIB_COUNT = geometry.ribs.length;
/** Opening angle of the full hood: 236 degrees. */
export const FULL_SPAN_DEG = last.a1 - first.a0;
/** Gap between neighbouring ribs: 4.5 degrees, constant at every spread. */
export const GAP_DEG = Math.round((second.a0 - first.a1) * 1000) / 1000;

/** The gate multiplier floor G(s) can reach: a tripped gate is nearly closed but never invisible. */
export const GATE_FLOOR = manualFacts['const.gate'].value.floor_multiplier;

export interface RibAngle {
  readonly a0: number;
  readonly a1: number;
}

/** Same formula as build_logo.rib_angles(): ribs share the spread equally and keep a constant gap. */
export function ribAngles(spreadDeg: number, count = RIB_COUNT, gapDeg = GAP_DEG): RibAngle[] {
  const width = (spreadDeg - gapDeg * (count - 1)) / count;
  const out: RibAngle[] = [];
  let a = -spreadDeg / 2;
  for (let i = 0; i < count; i += 1) {
    out.push({ a0: a, a1: a + width });
    a += width + gapDeg;
  }
  return out;
}

/** Spread = 236 degrees * G(s), with G clamped to [floor, 1]. */
export function spreadForGate(gate: number): number {
  return FULL_SPAN_DEG * clamp(gate, GATE_FLOOR, 1);
}

/** Width of one rib at a given spread, in degrees. */
export function ribWidthDeg(spreadDeg: number, count = RIB_COUNT, gapDeg = GAP_DEG): number {
  return (spreadDeg - gapDeg * (count - 1)) / count;
}

const f = (n: number): string => n.toFixed(2);

/** Annular sector between radii r1 < r2. Same path construction as build_logo.sector(). */
export function sectorPath(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  a0: number,
  a1: number,
): string {
  const pt = (r: number, a: number): [number, number] => {
    const t = (a * Math.PI) / 180;
    return [cx + r * Math.sin(t), cy - r * Math.cos(t)];
  };
  const [x0, y0] = pt(r2, a0);
  const [x1, y1] = pt(r2, a1);
  const [x2, y2] = pt(r1, a1);
  const [x3, y3] = pt(r1, a0);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return (
    `M${f(x0)},${f(y0)} A${r2},${r2} 0 ${large} 1 ${f(x1)},${f(y1)} ` +
    `L${f(x2)},${f(y2)} A${r1},${r1} 0 ${large} 0 ${f(x3)},${f(y3)} Z`
  );
}

/** Lens-shaped overlap of two circles of radius r centred (cx - d, cy) and (cx + d, cy). */
export function eyePath(cx: number, cy: number, r: number, d: number): string {
  const h = Math.sqrt(r * r - d * d);
  return `M${cx},${f(cy - h)} A${r},${r} 0 0 1 ${cx},${f(cy + h)} A${r},${r} 0 0 1 ${cx},${f(cy - h)} Z`;
}

/** Tight viewBox around the hood (ribs run from y = 34 to about y = 166 and x = 20 to 180). */
export const HOOD_VIEWBOX = { x: 16, y: 30, width: 168, height: 140 } as const;
