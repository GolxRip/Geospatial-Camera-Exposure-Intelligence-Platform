'use client';

import * as React from 'react';
import { Section } from '@/components/layout/section';
import { SourceNote } from '@/components/ui/source-note';
import { facts } from '@/lib/content/facts.generated';
import { manualFacts } from '@/lib/content/facts.manual';
import { f2, f3 } from '@/lib/format';
import { GATE } from '@/lib/scoring/gate';
import { GATE_STEPS, GateStage } from './gate-stage';

const WEIGHTS = manualFacts['const.tier1.weights'].value;
/** One changed banner field can lower signal integrity by at most its weight; the largest weight is firmware. */
const WORST_SINGLE_FIELD_S = 1 - Math.max(...Object.values(WEIGHTS));

const PANELS: { text: string; metric: React.ReactNode; label: string; note: React.ReactNode }[] = [
  {
    text: 'Channel A reads what a scanner already collected: known CVEs, authentication, owner type and firmware age. It measures exposure, not honesty.',
    metric: f3(facts['res.ablation'].value.channel_a_only.f1),
    label: 'F1 with Channel A alone',
    note: <SourceNote fact={facts['res.ablation']} />,
  },
  {
    text: 'Channel B asks whether the feed is still real. Tier 1 compares the banner with its baseline, passively. Tier 2 checks frames from authorized footage.',
    metric: f3(facts['res.ablation'].value.channel_b_only.f1),
    label: 'F1 with Channel B alone',
    note: <SourceNote fact={facts['res.ablation']} />,
  },
  {
    text: 'A camera is trusted only where both hold: secure and authentic. The overlap of the two channels is the eye.',
    metric: f3(facts['res.model.igdctf'].value.f1),
    label: 'F1 with both, multiplied',
    note: <SourceNote fact={facts['res.model.igdctf']} />,
  },
  {
    text: `Signal integrity s sets the opening of the hood: fully open above the upper threshold, capped at ${GATE.hard_cap} below the lower one.`,
    metric: `${f2(GATE.theta_low)} and ${f2(GATE.theta_high)}`,
    label: 'Lower and upper threshold',
    note: (
      <span className="font-mono text-xs break-words [overflow-wrap:anywhere]">
        {manualFacts['const.gate'].source.split(' and ')[0]}
      </span>
    ),
  },
  {
    text: 'The gate has three outcomes. A single changed banner field tapers the score but never trips the gate.',
    metric: f2(WORST_SINGLE_FIELD_S),
    label: 'Lowest s from one changed banner field',
    note: (
      <span className="font-mono text-xs break-words [overflow-wrap:anywhere]">
        {manualFacts['const.tier1.weights'].source}
      </span>
    ),
  },
];

/**
 * "Walk the gate" (FRONTEND_SPEC.md section 7.4): from 1024 up one sticky stage on the left follows the panel scrolling past on
 * the right (native sticky, no scroll hijack). Below 1024 each panel carries its own 60vh stage above its text.
 */
export function WalkTheGate() {
  const [active, setActive] = React.useState(0);
  const refs = React.useRef<(HTMLLIElement | null)[]>([]);

  React.useEffect(() => {
    const els = refs.current.filter((e): e is HTMLLIElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <Section id="method" title="Walk the gate" className="pb-0 md:pb-0">
      <div className="lg:grid lg:grid-cols-2 lg:gap-16">
        <div className="hidden lg:block" data-stage="sticky">
          <div className="sticky top-24 h-[calc(100dvh-8rem)] rounded-panel border border-line bg-ink-1 p-8">
            <GateStage step={active} />
          </div>
        </div>
        <ol className="flex flex-col">
          {PANELS.map((p, i) => (
            <li
              key={GATE_STEPS[i]}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-step={i}
              className="flex flex-col justify-center gap-6 py-12 lg:min-h-[80dvh]"
            >
              <div
                data-stage="inline"
                className="h-[60vh] min-h-64 rounded-panel border border-line bg-ink-1 p-6 lg:hidden"
              >
                <GateStage step={i} />
              </div>
              <h3 className="text-3xl font-semibold tracking-tight">{GATE_STEPS[i]}</h3>
              <p className="text-body measure text-bone-2">{p.text}</p>
              <div className="flex flex-col gap-1">
                <span className="num text-4xl font-medium tracking-tight">{p.metric}</span>
                <span className="text-sm text-bone-2">
                  {p.label}
                  {p.note}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
