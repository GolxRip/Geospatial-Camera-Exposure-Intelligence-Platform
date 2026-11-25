'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { TierTag } from '@/components/ui/tier-tag';
import { f2, f3 } from '@/lib/format';
import { fuse, type GateStatus } from '@/lib/scoring/gate';
import { tierFromAction } from '@/lib/tier';
import { cn } from '@/lib/utils';
import { FeedCanvas } from './feed-canvas';
import { GateCurve } from './gate-curve';

const STATUS_LABEL: Record<GateStatus, string> = {
  nominal: 'Nominal',
  tapered: 'Tapered',
  hard_gated: 'Tripped',
};

export interface GateExplorerProps {
  /** `compact` is the landing-page form: the two-column visuals instead of three. */
  compact?: boolean;
  /**
   * Where the thresholds came from. The explorer always computes with the static copy of the backend constants; pass 'live'
   * once you fetch them from `GET /api/config/thresholds` and feed them in, so the chip tells the truth.
   */
  thresholdSource?: 'static' | 'live';
}

/**
 * Gate explorer (FRONTEND_SPEC.md sections 7.5 and 12). Six controls drive the in-browser port of the scoring path
 * (src/lib/scoring/gate.ts, checked against the Python implementation); outputs, the feed pane, the G(s) curve, the hood and the
 * CVE-only comparison all update from the same computed result.
 */
export function GateExplorer({ compact = false, thresholdSource = 'static' }: GateExplorerProps) {
  const [tCve, setTCve] = React.useState(100);
  const [drift, setDrift] = React.useState(0);
  const [freeze, setFreeze] = React.useState(false);
  const [blur, setBlur] = React.useState(0);
  const [mismatch, setMismatch] = React.useState(false);
  const [tier2Off, setTier2Off] = React.useState(false);

  const r = fuse({
    tCve,
    drift,
    freeze,
    qualityDrift: blur,
    specMismatch: mismatch,
    tier2: !tier2Off,
  });
  const tier = tierFromAction(r.tier);
  const cveTier = tierFromAction(r.cveOnlyTier);
  const outcome = `final score ${r.final}, ${tier ?? 'unscored'} trust, gate ${STATUS_LABEL[r.gate.status].toLowerCase()}`;
  // With Tier 2 unavailable the feed controls have no effect on the score, so the pane shows the camera as it is, unaffected.
  const feedFrozen = freeze && !tier2Off;
  const feedBlur = tier2Off ? 0 : blur;
  const feedMismatch = mismatch && !tier2Off;

  const outputs: { term: string; value: React.ReactNode }[] = [
    { term: 'Drift', value: f2(drift) },
    { term: 'L', value: r.liveness === null ? 'n/a' : f3(r.liveness) },
    { term: 's', value: f3(r.signalIntegrity) },
    { term: 'G', value: f2(r.gate.multiplier) },
    { term: 'T_final', value: String(r.final) },
    { term: 'Tier', value: <TierTag tier={tier} gateTripped={false} /> },
    { term: 'Gate', value: STATUS_LABEL[r.gate.status] },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="outline">
          {thresholdSource === 'live'
            ? 'Computed in your browser with live thresholds, same formula as the backend (parity-tested)'
            : 'Computed in your browser, same formula as the backend (parity-tested)'}
        </Badge>
        {thresholdSource === 'static' ? <Badge tone="neutral">Static thresholds</Badge> : null}
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <ul aria-label="Controls" className="flex flex-col gap-5">
          <li>
            <Slider
              label="T_cve"
              value={tCve}
              min={0}
              max={100}
              step={1}
              onChange={setTCve}
              display={String(tCve)}
              valueText={`T_cve ${tCve}, ${outcome}`}
            />
          </li>
          <li>
            <Slider
              label="Banner drift"
              value={drift}
              min={0}
              max={1}
              step={0.01}
              onChange={setDrift}
              display={f2(drift)}
              valueText={`Banner drift ${f2(drift)}, ${outcome}`}
            />
          </li>
          <li>
            <Switch label="Freeze" checked={freeze} onCheckedChange={setFreeze} />
          </li>
          <li>
            <Slider
              label="Blur"
              value={blur}
              min={0}
              max={1}
              step={0.01}
              onChange={setBlur}
              display={f2(blur)}
              valueText={`Blur ${f2(blur)}, ${outcome}`}
            />
          </li>
          <li>
            <Switch label="Spec mismatch" checked={mismatch} onCheckedChange={setMismatch} />
          </li>
          <li>
            <Switch label="Tier 2 unavailable" checked={tier2Off} onCheckedChange={setTier2Off} />
          </li>
        </ul>
        <div className="flex flex-col gap-6">
          <ul
            aria-label="Outputs"
            className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 xl:grid-cols-7"
          >
            {outputs.map((o) => (
              <li key={o.term} className="flex flex-col gap-1">
                <span className="font-mono text-xs text-bone-2">{o.term}</span>
                <span className="num text-xl text-bone">{o.value}</span>
              </li>
            ))}
          </ul>
          <p role="status" className="sr-only">
            {outcome}
          </p>
          <div
            className={cn('grid items-start gap-6 md:grid-cols-2', compact ? '' : 'xl:grid-cols-3')}
          >
            <FeedCanvas
              frozen={feedFrozen}
              blur={feedBlur}
              mismatch={feedMismatch}
              label={`Simulated feed: ${feedFrozen ? 'frozen' : 'moving'}${feedBlur > 0 ? `, blur ${f2(feedBlur)}` : ''}${feedMismatch ? ', letterboxed by a spec mismatch' : ''}`}
            />
            <GateCurve
              s={r.signalIntegrity}
              g={r.gate.multiplier}
              className="w-full rounded-panel border border-line bg-ink-1"
            />
            <div
              className={cn(
                'flex items-center justify-center rounded-panel border border-line bg-ink-1 py-6 md:col-span-2',
                compact ? '' : 'xl:col-span-1',
              )}
            >
              <HoodGauge gate={r.gate.multiplier} trust={r.final} size={128} />
            </div>
          </div>
          <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-bone-2">CVE-only would say</span>
              <span className="flex items-center gap-3">
                <span className="num text-2xl">{tCve}</span>
                <TierTag tier={cveTier} />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-bone-2">IG-DCTF says</span>
              <span className="flex items-center gap-3">
                <span className="num text-2xl">{r.final}</span>
                <TierTag tier={tier} gateTripped={r.gate.tripped} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
