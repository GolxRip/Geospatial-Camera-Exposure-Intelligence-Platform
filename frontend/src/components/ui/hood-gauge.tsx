import {
  HOOD,
  HOOD_VIEWBOX,
  eyePath,
  ribAngles,
  sectorPath,
  spreadForGate,
} from '@/lib/brand/hood';
import { clamp, cn } from '@/lib/utils';

/**
 * The hood is a gauge (FRONTEND_SPEC.md section 6.3). The mark carries data, so one component draws
 * a gate state everywhere: table rows, popups, the inspector and the top bar.
 *
 *   Spread       236 degrees * G(s). Ribs keep the 4.5 degree gap, so at the floor G = 0.3 the hood is
 *                70.8 degrees wide and nearly closed, never invisible.
 *   Eye          intensity = T_final / 100, with a floor of 10% so the eye is always visible.
 *
 * The geometry comes from assets/logo/cobra-mark.geometry.json through src/lib/brand/hood.ts, the same
 * module the WebGL hood will use. Under reduced motion the gauge snaps to its state: this component has
 * no transition; the shared hood animation (animateHood) is added with the animation system.
 */
export interface HoodGaugeProps {
  /** Gate multiplier G(s) in [0.3, 1]. 1 draws the full mark. */
  gate?: number;
  /** Final trust score 0..100; sets the eye intensity. */
  trust?: number;
  /** Rendered width in px (16 to 480). */
  size?: number;
  /** Accessible name. Defaults to a description of the values drawn. */
  label?: string;
  /** Hide from assistive technology when the same state is already stated in text next to it. */
  decorative?: boolean;
  className?: string;
}

const MIN_EYE_OPACITY = 0.1;

export function HoodGauge({
  gate = 1,
  trust = 100,
  size = 64,
  label,
  decorative = false,
  className,
}: HoodGaugeProps) {
  const spread = spreadForGate(gate);
  const ribs = ribAngles(spread);
  const eyeOpacity = clamp(trust / 100, MIN_EYE_OPACITY, 1);
  const [cx, cy] = HOOD.center as [number, number];
  const width = clamp(size, 16, 480);
  const height = (width * HOOD_VIEWBOX.height) / HOOD_VIEWBOX.width;
  const accessibleName =
    label ?? `Gate multiplier ${gate.toFixed(2)}, trust score ${Math.round(trust)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`${HOOD_VIEWBOX.x} ${HOOD_VIEWBOX.y} ${HOOD_VIEWBOX.width} ${HOOD_VIEWBOX.height}`}
      className={cn('shrink-0', className)}
      {...(decorative
        ? { 'aria-hidden': true, focusable: 'false' as const }
        : { role: 'img', 'aria-label': accessibleName })}
    >
      {decorative ? null : <title>{accessibleName}</title>}
      <g className="fill-bone">
        {ribs.map((rib, i) => (
          <path key={i} d={sectorPath(cx, cy, HOOD.rIn, HOOD.rOut, rib.a0, rib.a1)} />
        ))}
      </g>
      <path
        d={eyePath(cx, cy, HOOD.eye.r, HOOD.eye.d)}
        className="fill-signal"
        fillOpacity={eyeOpacity}
      />
    </svg>
  );
}
