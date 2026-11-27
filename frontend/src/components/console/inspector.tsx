'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { GateCurve } from '@/components/lab/gate-curve';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { InlineError } from '@/components/ui/inline-error';
import { OfflineState } from '@/components/ui/offline-state';
import { Skeleton } from '@/components/ui/skeleton';
import { TierTag } from '@/components/ui/tier-tag';
import { manualFacts } from '@/lib/content/facts.manual';
import { geoProvenance } from '@/lib/api/normalize';
import { deviceRoute } from '@/lib/constants/routes';
import type { ConsoleActions, DeviceDetail, LoadState } from '@/lib/data/types';
import { f2 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ModelsTable } from './models-table';

const DRIFT_THRESHOLD = manualFacts['const.tier1.drift_threshold'].value;
const GATE_STATUS_LABEL = {
  nominal: 'Nominal',
  tapered: 'Tapered',
  hard_gated: 'Hard gated',
} as const;
const AUDIT_PREVIEW = 5;

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const signed = (n: number) => (n > 0 ? `+${num(n)}` : n < 0 ? `−${num(Math.abs(n))}` : '0');

function utc(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

type Level = 'h2' | 'h3';

function Block({
  id,
  title,
  level,
  className,
  children,
}: {
  id: string;
  title: string;
  level: Level;
  className?: string;
  children: React.ReactNode;
}) {
  const H = level;
  return (
    <section aria-labelledby={`inspector-${id}`} className={cn('flex flex-col gap-3', className)}>
      <H
        id={`inspector-${id}`}
        className={
          level === 'h2'
            ? 'text-xl font-semibold tracking-tight'
            : 'text-base font-semibold tracking-tight'
        }
      >
        {title}
      </H>
      {children}
    </section>
  );
}

function DefList({ items }: { items: { term: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {items.map((i) => (
        <React.Fragment key={i.term}>
          <dt className="text-bone-2">{i.term}</dt>
          <dd className="min-w-0 break-words text-bone">{i.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function DecayChart({ points, unit }: { points: DeviceDetail['decay']; unit?: string }) {
  if (points.length < 2)
    return <p className="text-sm text-bone-2">No decay curve for this device.</p>;
  const W = 320;
  const H = 150;
  const m = { l: 34, r: 10, t: 10, b: 28 };
  const maxAge = Math.max(...points.map((p) => p.age));
  const x = (a: number) => m.l + (maxAge === 0 ? 0 : a / maxAge) * (W - m.l - m.r);
  const y = (w: number) => H - m.b - Math.max(0, Math.min(1, w)) * (H - m.t - m.b);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.age).toFixed(1)} ${y(p.weight).toFixed(1)}`)
    .join(' ');
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Decay curve. Weight goes from ${f2(first.weight)} at age ${num(first.age)} to ${f2(last.weight)} at age ${num(last.age)}${unit ? ` ${unit}` : ''}.`}
      className="w-full max-w-sm"
    >
      <g className="stroke-line-strong" strokeWidth="1" fill="none">
        <path d={`M ${x(0)} ${y(0)} H ${x(maxAge)}`} />
        <path d={`M ${x(0)} ${y(0)} V ${y(1)}`} />
      </g>
      <path d={d} fill="none" className="stroke-bone" strokeWidth="2" strokeLinejoin="round" />
      <text
        x={m.l - 6}
        y={y(1) + 3}
        textAnchor="end"
        className="fill-bone-2 font-mono"
        fontSize="10"
      >
        1.0
      </text>
      <text
        x={m.l - 6}
        y={y(0) + 3}
        textAnchor="end"
        className="fill-bone-2 font-mono"
        fontSize="10"
      >
        0
      </text>
      <text x={x(0)} y={H - 10} className="fill-bone-2 font-mono" fontSize="10">
        0
      </text>
      <text
        x={x(maxAge)}
        y={H - 10}
        textAnchor="end"
        className="fill-bone-2 font-mono"
        fontSize="10"
      >
        {num(maxAge)} {unit ?? ''}
      </text>
      <text
        x={(x(0) + x(maxAge)) / 2}
        y={H - 10}
        textAnchor="middle"
        className="fill-bone-2 font-mono"
        fontSize="10"
      >
        age
      </text>
    </svg>
  );
}

function InspectorSkeleton({ level }: { level: Level }) {
  const sections: [string, string][] = [
    ['header', 'Header'],
    ['factors', 'Channel A factors'],
    ['channel-b', 'Channel B'],
    ['gate', 'Gate'],
    ['models', 'Scoring models'],
    ['decay', 'Decay'],
    ['audit', 'Audit trail'],
    ['verdict', 'Verdict'],
  ];
  return (
    <div aria-busy="true" aria-label="Loading device" className="flex flex-col gap-6">
      {sections.map(([id, title]) => (
        <Block key={id} id={id} title={title} level={level}>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </Block>
      ))}
    </div>
  );
}

export interface InspectorProps {
  detail: LoadState<DeviceDetail | null>;
  actions?: ConsoleActions;
  /** Device forensics page: two-column reading layout from 1024 up, section headings at h2, the full audit trail. */
  wide?: boolean;
  /** Where the "Open forensics" link goes. Defaults to the device route. Not shown in `wide` mode. */
  deviceHref?: (id: string) => string;
  className?: string;
}

/**
 * The inspector (FRONTEND_SPEC.md section 10.3): eight sections, top to bottom. Whole-device loading, offline, error and
 * nothing-selected states are drawn here; each section also has its own empty states inside a loaded device (no factors,
 * no authorized footage, no audit entries). Nothing is displayed for a field the data does not have.
 */
export function Inspector({
  detail,
  actions,
  wide = false,
  deviceHref = deviceRoute,
  className,
}: InspectorProps) {
  const level: Level = wide ? 'h2' : 'h3';
  if (detail.status === 'loading') return <InspectorSkeleton level={level} />;
  if (detail.status === 'offline') return <OfflineState className={className} />;
  if (detail.status === 'error')
    return (
      <InlineError
        className={className}
        title="Device could not be loaded"
        detail={detail.message}
      />
    );
  if (detail.data === null) {
    return (
      <EmptyState className={className} title="No device selected">
        Select a device on the map or in the alert stream to see its score, the evidence behind it
        and its audit trail.
      </EmptyState>
    );
  }
  return (
    <InspectorBody
      key={detail.data.id}
      d={detail.data}
      actions={actions}
      wide={wide}
      level={level}
      deviceHref={deviceHref}
      className={className}
    />
  );
}

function InspectorBody({
  d,
  actions,
  wide,
  level,
  deviceHref,
  className,
}: {
  d: DeviceDetail;
  actions?: ConsoleActions;
  wide: boolean;
  level: Level;
  deviceHref: (id: string) => string;
  className?: string;
}) {
  const [sent, setSent] = React.useState<'verified' | 'false_alarm' | null>(null);
  const [pending, setPending] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);

  const maxDelta = Math.max(1, ...d.channelA.factors.map((f) => Math.abs(f.delta)));
  const drift = d.channelB.drift;
  const audit = wide || showAll ? d.audit : d.audit.slice(0, AUDIT_PREVIEW);
  const gateLabel = `Gate multiplier ${f2(d.gate.multiplier)}, ${d.score === null ? 'unscored' : `trust score ${Math.round(d.score)}`}`;

  const submit = async (v: 'verified' | 'false_alarm') => {
    if (!actions?.onVerdict) return;
    setPending(true);
    try {
      await actions.onVerdict(v);
      setSent(v);
    } catch {
      setSent(null);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-8',
        wide && 'lg:grid lg:grid-cols-2 lg:gap-x-12 lg:gap-y-10',
        className,
      )}
    >
      <Block id="header" title="Header" level={level}>
        {(() => {
          const prov = geoProvenance(d.geoSource);
          return (
            <div className="flex flex-wrap items-center gap-2">
              {d.geoSource ? (
                <Badge tone={prov.seeded ? 'outline' : 'neutral'} title={prov.note}>
                  {prov.seeded ? 'Simulated fixture' : prov.label}
                </Badge>
              ) : null}
            </div>
          );
        })()}
        <div className="flex items-center gap-4">
          <HoodGauge
            size={wide ? 96 : 72}
            gate={d.gate.multiplier}
            trust={d.score ?? 0}
            label={gateLabel}
          />
          <div className="flex flex-col gap-1">
            <TierTag tier={d.tier} gateTripped={d.gateTripped} size={14} />
            <p className="num text-3xl leading-none font-medium text-bone">
              {d.score === null ? '--' : Math.round(d.score)}
              <span className="ml-2 font-sans text-xs font-normal text-bone-2">T_final</span>
            </p>
            <p className="text-xs text-bone-2">Basis: {d.basis}</p>
          </div>
        </div>
        <DefList
          items={[
            { term: 'IP', value: <span className="num">{d.maskedIp}</span> },
            { term: 'Maker', value: d.manufacturer },
            { term: 'Type', value: d.deviceType },
            {
              term: 'Owner',
              value: (
                <>
                  {d.owner}
                  <span className="text-bone-2">
                    {' '}
                    ({d.ownerType}
                    {d.ownerConfidence !== undefined
                      ? `, confidence ${Math.round(d.ownerConfidence * 100)}%`
                      : ''}
                    )
                  </span>
                </>
              ),
            },
            {
              term: 'City',
              value: (
                <>
                  {d.city} <span className="text-bone-2">(estimated from IP)</span>
                </>
              ),
            },
            ...(d.geoSource
              ? [{ term: 'Provenance', value: <span className="text-bone-2">{geoProvenance(d.geoSource).note}</span> }]
              : []),
          ]}
        />
        {!wide ? (
          <Link
            href={deviceHref(d.id)}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-chip text-sm text-bone underline-offset-4 hover:underline"
          >
            Open forensics
            <ArrowRight aria-hidden size={14} />
          </Link>
        ) : null}
      </Block>

      <Block id="factors" title="Channel A factors" level={level}>
        <p className="text-sm text-bone-2">
          Vulnerability posture{' '}
          <span className="num text-bone">T_cve {Math.round(d.channelA.tCve)}</span>
        </p>
        {d.channelA.factors.length === 0 ? (
          <p className="text-sm text-bone-2">No factors were reported for this device.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {d.channelA.factors.map((f) => (
              <li key={f.label} className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-bone">
                    {f.label}
                    {f.kev ? (
                      <Badge
                        tone="signal"
                        className="ml-2"
                        title="Listed in the CISA Known Exploited Vulnerabilities catalog"
                      >
                        CISA KEV
                      </Badge>
                    ) : null}
                  </span>
                  <span className="num shrink-0 text-bone">{signed(f.delta)}</span>
                </div>
                <div className="h-2" aria-hidden>
                  <div
                    className={cn('h-full rounded-chip', f.delta < 0 ? 'bg-signal' : 'bg-bone-2')}
                    style={{ width: `${(Math.abs(f.delta) / maxDelta) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block id="channel-b" title="Channel B" level={level}>
        {drift === null ? (
          <p className="text-sm text-bone-2">
            Tier 1 unavailable: no baseline banner for this device.
          </p>
        ) : (
          <p className="text-sm text-bone-2">
            Tier 1 banner drift <span className="num text-bone">{f2(drift)}</span>, threshold{' '}
            {f2(DRIFT_THRESHOLD)}:{' '}
            <span className="text-bone">
              {drift > DRIFT_THRESHOLD ? 'above, flagged' : 'within'}
            </span>
          </p>
        )}
        {d.channelB.banner.length > 0 ? (
          <ul aria-label="Banner fields, weighted" className="flex flex-col">
            {d.channelB.banner.map((b) => {
              const changed = b.baseline !== b.current;
              return (
                <li
                  key={b.field}
                  className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-b border-line py-2 text-sm"
                >
                  <span className="text-bone">
                    {b.field}{' '}
                    <span className="num text-xs text-bone-2">weight {b.weight.toFixed(2)}</span>
                  </span>
                  <span className="text-right">
                    {changed ? (
                      <Badge tone="signal">changed</Badge>
                    ) : (
                      <span className="text-xs text-bone-2">same</span>
                    )}
                  </span>
                  <span className="min-w-0 break-words">
                    <span className="block text-xs text-bone-2">Baseline</span>
                    <span className="num text-bone-2">{b.baseline}</span>
                  </span>
                  <span className="min-w-0 break-words">
                    <span className="block text-xs text-bone-2">Current</span>
                    <span className="num text-bone">{b.current}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {d.channelB.liveness === null ? (
          <p className="text-sm text-bone-2">
            Tier 2 unavailable: no authorized footage for this device.
          </p>
        ) : (
          <p className="text-sm text-bone-2">
            Tier 2 liveness <span className="num text-bone">L {f2(d.channelB.liveness)}</span>
          </p>
        )}
      </Block>

      <Block id="gate" title="Gate" level={level}>
        <GateCurve s={d.gate.s} g={d.gate.multiplier} className="w-full max-w-sm" />
        <DefList
          items={[
            { term: 's', value: <span className="num">{f2(d.gate.s)}</span> },
            { term: 'G(s)', value: <span className="num">{f2(d.gate.multiplier)}</span> },
            {
              term: 'Hard cap',
              value: (
                <span className="num">{d.gate.hardCap === null ? 'none' : d.gate.hardCap}</span>
              ),
            },
            { term: 'Status', value: GATE_STATUS_LABEL[d.gate.status] },
          ]}
        />
      </Block>

      <Block id="models" title="Scoring models" level={level}>
        <ModelsTable models={d.models} full={wide} />
      </Block>

      <Block id="decay" title="Decay" level={level}>
        <DecayChart points={d.decay} unit={d.decayAgeUnit} />
      </Block>

      <Block
        id="audit"
        title="Audit trail"
        level={level}
        className={wide ? 'lg:col-span-2' : undefined}
      >
        {d.audit.length === 0 ? (
          <p className="text-sm text-bone-2">No audit entries for this device.</p>
        ) : (
          <>
            <ul className="flex flex-col">
              {audit.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-2 text-sm"
                >
                  <time dateTime={a.time} className="num text-xs text-bone-2">
                    {utc(a.time)}
                  </time>
                  <span className="min-w-0 flex-1 font-mono text-xs text-bone">{a.action}</span>
                  {a.proofHref ? (
                    <Link
                      href={a.proofHref}
                      className="rounded-chip text-bone underline-offset-4 hover:underline"
                    >
                      Merkle proof
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
            {!wide && d.audit.length > AUDIT_PREVIEW ? (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                aria-expanded={showAll}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Show fewer' : `Show all ${d.audit.length}`}
              </Button>
            ) : null}
          </>
        )}
      </Block>

      <Block id="verdict" title="Verdict" level={level}>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!actions?.onVerdict || pending}
            aria-describedby={actions?.onVerdict ? undefined : 'verdict-hint'}
            onClick={() => void submit('verified')}
          >
            Verified
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!actions?.onVerdict || pending}
            aria-describedby={actions?.onVerdict ? undefined : 'verdict-hint'}
            onClick={() => void submit('false_alarm')}
          >
            False alarm
          </Button>
        </div>
        {!actions?.onVerdict ? (
          <p id="verdict-hint" className="text-sm text-bone-2">
            Verdicts are not connected to a data source.
          </p>
        ) : null}
        {actions?.verdictError ? (
          <InlineError title="Verdict not recorded" detail={actions.verdictError} />
        ) : null}
        {sent && !actions?.verdictError ? (
          <p role="status" className="text-sm text-bone-2">
            Sent: {sent === 'verified' ? 'verified' : 'false alarm'}.
          </p>
        ) : null}
      </Block>
    </div>
  );
}
