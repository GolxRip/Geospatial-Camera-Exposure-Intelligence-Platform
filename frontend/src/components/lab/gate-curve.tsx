import { GATE } from '@/lib/scoring/gate';

/**
 * G(s) with the two thresholds and a point at the current signal integrity (FRONTEND_SPEC.md section 7.5). Hand-built SVG:
 * flat at the floor below theta_low, a straight taper to 1 at theta_high, flat above. Every value drawn is also in the label.
 */
export function GateCurve({ s, g, className }: { s: number; g: number; className?: string }) {
  const W = 320;
  const H = 200;
  const m = { l: 36, r: 12, t: 14, b: 30 };
  const x = (v: number) => m.l + v * (W - m.l - m.r);
  const y = (v: number) => H - m.b - v * (H - m.t - m.b);
  const { theta_low: lo, theta_high: hi, floor_multiplier: floor } = GATE;
  const path = `M ${x(0)} ${y(floor)} L ${x(lo)} ${y(floor)} L ${x(hi)} ${y(1)} L ${x(1)} ${y(1)}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Gate curve. Signal integrity ${s.toFixed(2)} gives a multiplier of ${g.toFixed(2)}. Thresholds at ${lo.toFixed(2)} and ${hi.toFixed(2)}.`}
      className={className}
    >
      <g className="stroke-line-strong" strokeWidth="1" fill="none">
        <path d={`M ${x(0)} ${y(0)} H ${x(1)}`} />
        <path d={`M ${x(0)} ${y(0)} V ${y(1)}`} />
      </g>
      {[lo, hi].map((t) => (
        <g key={t}>
          <path
            d={`M ${x(t)} ${y(0)} V ${y(1)}`}
            className="stroke-bone-2/50"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text
            x={x(t)}
            y={H - 10}
            textAnchor="middle"
            className="fill-bone-2 font-mono"
            fontSize="10"
          >
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" className="stroke-bone" strokeWidth="2" strokeLinejoin="round" />
      <text
        x={x(0) - 6}
        y={y(1) + 3}
        textAnchor="end"
        className="fill-bone-2 font-mono"
        fontSize="10"
      >
        1.0
      </text>
      <text
        x={x(0) - 6}
        y={y(floor) + 3}
        textAnchor="end"
        className="fill-bone-2 font-mono"
        fontSize="10"
      >
        {floor.toFixed(1)}
      </text>
      <text x={x(1)} y={H - 10} textAnchor="end" className="fill-bone-2 font-mono" fontSize="10">
        s
      </text>
      <path d={`M ${x(s)} ${y(0)} V ${y(g)}`} className="stroke-signal/60" strokeWidth="1" />
      <circle cx={x(s)} cy={y(g)} r="5" className="fill-signal" />
    </svg>
  );
}
