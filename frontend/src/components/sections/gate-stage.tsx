import * as React from 'react';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { GATE, evaluateGate } from '@/lib/scoring/gate';

export const GATE_STEPS = [
  'Posture',
  'Integrity',
  'Both must hold',
  'The gate',
  'Trips, tapers, passes',
] as const;

const TAPER_EXAMPLE = evaluateGate((GATE.theta_low + GATE.theta_high) / 2);

/**
 * The stage of "Walk the gate" (FRONTEND_SPEC.md section 7.4), drawn in SVG until the 3D scene replaces it:
 * one circle (Channel A), two circles with their two arcs (Channel B), the overlap filled as the eye, the hood opened to G(s),
 * and the three outcomes. The whole thing is described in text for assistive technology.
 */
export function GateStage({ step }: { step: number }) {
  const id = React.useId();
  const a = { cx: 150, cy: 200, r: 105 };
  const b = { cx: 250, cy: 200, r: 105 };
  const description = [
    'Channel A: one circle for vulnerability posture.',
    'Channel B: a second circle for feed authenticity, with two arcs for Tier 1 banner drift and Tier 2 liveness.',
    'The overlap of the two circles is filled amber: the eye, trusted only where both hold.',
    'The hood opens as far as the gate multiplier G of s allows.',
    'Three outcomes: the hood closed to the floor, partly open, and fully open.',
  ][step];

  if (step === 3) {
    return (
      <div
        role="img"
        aria-label={description}
        className="flex size-full items-center justify-center"
      >
        <HoodGauge gate={1} trust={100} size={360} decorative />
      </div>
    );
  }

  if (step === 4) {
    const cases = [
      { label: 'Trips', g: GATE.floor_multiplier, note: `s below ${GATE.theta_low.toFixed(2)}` },
      {
        label: 'Tapers',
        g: TAPER_EXAMPLE.multiplier,
        note: `s from ${GATE.theta_low.toFixed(2)} to ${GATE.theta_high.toFixed(2)}`,
      },
      { label: 'Passes', g: 1, note: `s at least ${GATE.theta_high.toFixed(2)}` },
    ];
    return (
      <div
        role="img"
        aria-label={description}
        className="flex size-full flex-wrap items-center justify-center gap-8"
      >
        {cases.map((c) => (
          <figure key={c.label} className="flex flex-col items-center gap-3">
            <HoodGauge gate={c.g} trust={Math.round(c.g * 100)} size={112} decorative />
            <figcaption className="text-center">
              <span className="block text-base font-medium text-bone">{c.label}</span>
              <span className="num block text-sm text-bone-2">{c.note}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }

  return (
    <svg viewBox="0 0 400 400" role="img" aria-label={description} className="size-full">
      <defs>
        <clipPath id={`${id}-a`}>
          <circle cx={a.cx} cy={a.cy} r={a.r} />
        </clipPath>
      </defs>
      {step >= 2 ? (
        <circle cx={b.cx} cy={b.cy} r={b.r} clipPath={`url(#${id}-a)`} className="fill-signal" />
      ) : null}
      <circle cx={a.cx} cy={a.cy} r={a.r} fill="none" className="stroke-bone" strokeWidth="2" />
      <text
        x={a.cx - 52}
        y={a.cy + 4}
        textAnchor="middle"
        className="fill-bone font-sans"
        fontSize="14"
      >
        Channel A
      </text>
      {step >= 1 ? (
        <>
          <circle cx={b.cx} cy={b.cy} r={b.r} fill="none" className="stroke-bone" strokeWidth="2" />
          <text
            x={b.cx + 52}
            y={b.cy + 4}
            textAnchor="middle"
            className="fill-bone font-sans"
            fontSize="14"
          >
            Channel B
          </text>
          <path
            d={`M ${b.cx + 78} ${b.cy - 78} A 110 110 0 0 1 ${b.cx + 110} ${b.cy}`}
            fill="none"
            className="stroke-bone-2"
            strokeWidth="3"
            transform="translate(0 0)"
          />
          <path
            d={`M ${b.cx + 110} ${b.cy + 8} A 110 110 0 0 1 ${b.cx + 78} ${b.cy + 78}`}
            fill="none"
            className="stroke-bone-2"
            strokeWidth="3"
            strokeDasharray="6 5"
          />
          <text x={b.cx + 96} y={b.cy - 96} className="fill-bone-2 font-mono" fontSize="11">
            Tier 1
          </text>
          <text x={b.cx + 96} y={b.cy + 104} className="fill-bone-2 font-mono" fontSize="11">
            Tier 2
          </text>
        </>
      ) : null}
      {step >= 2 ? (
        <text x="200" y="352" textAnchor="middle" className="fill-bone font-mono" fontSize="12">
          P(secure and authentic)
        </text>
      ) : null}
    </svg>
  );
}
