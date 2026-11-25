'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/inline-error';
import { OfflineState } from '@/components/ui/offline-state';
import { Skeleton } from '@/components/ui/skeleton';
import { SourceNote } from '@/components/ui/source-note';
import { SyntheticChip } from '@/components/ui/synthetic-chip';
import { TierShape } from '@/components/ui/tier-tag';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { facts } from '@/lib/content/facts.generated';
import { ROUTES } from '@/lib/constants/routes';
import type { AnalyticsData, ConsoleActions, LoadState, TierId } from '@/lib/data/types';
import { f3 } from '@/lib/format';
import { cn } from '@/lib/utils';

const TABS = ['Fleet', 'Alerts', 'Integrity', 'Ledger', 'Accuracy'] as const;

function Bar({ value, max, hero }: { value: number; max: number; hero?: boolean }) {
  return (
    <div className="h-3 w-full" aria-hidden>
      <div
        className={cn('h-full rounded-chip', hero ? 'bg-signal' : 'bg-bone-2')}
        style={{ width: `${max === 0 ? 0 : (value / max) * 100}%` }}
      />
    </div>
  );
}

function CountRows({
  label,
  rows,
}: {
  label: string;
  rows: {
    key: string;
    name: string;
    value: number;
    shape?: React.ReactNode;
    hero?: boolean;
    note?: string;
  }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <ul aria-label={label} className="flex max-w-2xl flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[8.5rem_1fr_6.5rem] items-center gap-3 text-sm">
          <span className="flex items-center gap-2 text-bone">
            {r.shape}
            {r.name}
          </span>
          <Bar value={r.value} max={max} hero={r.hero} />
          <span className="num text-right text-bone">
            {r.value}{' '}
            <span className="text-xs text-bone-2">
              {total === 0 ? '' : `${Math.round((r.value / total) * 100)}%`}
            </span>
          </span>
          {r.note ? <span className="col-span-3 -mt-2 text-xs text-bone-2">{r.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Timeline({
  title,
  series,
  dashed,
  label,
}: {
  title: string;
  series: { label: string; value: number }[];
  dashed?: boolean;
  label: string;
}) {
  const W = 600;
  const H = 96;
  const m = { l: 28, r: 4, t: 6, b: 18 };
  const max = Math.max(1, ...series.map((s) => s.value));
  const bw = (W - m.l - m.r) / Math.max(1, series.length);
  const total = series.reduce((a, s) => a + s.value, 0);
  const every = Math.ceil(series.length / 8);
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-sm text-bone">
        {title} <span className="num text-xs text-bone-2">{total} alerts</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}: ${total} alerts over ${series.length} periods, at most ${max} in one period.`}
        className="h-auto w-full max-w-3xl"
      >
        <path
          d={`M ${m.l} ${H - m.b} H ${W - m.r}`}
          className="stroke-line-strong"
          strokeWidth="1"
        />
        <text
          x={m.l - 5}
          y={m.t + 8}
          textAnchor="end"
          className="fill-bone-2 font-mono"
          fontSize="9"
        >
          {max}
        </text>
        <text
          x={m.l - 5}
          y={H - m.b}
          textAnchor="end"
          className="fill-bone-2 font-mono"
          fontSize="9"
        >
          0
        </text>
        {series.map((s, i) => {
          const h = (s.value / max) * (H - m.t - m.b);
          return (
            <g key={`${s.label}-${i}`}>
              <rect
                x={m.l + i * bw + 2}
                y={H - m.b - h}
                width={Math.max(1, bw - 4)}
                height={h}
                rx="1.5"
                className={dashed ? 'fill-none stroke-bone-2' : 'fill-signal'}
                strokeWidth={dashed ? 1 : 0}
                strokeDasharray={dashed ? '3 2' : undefined}
              />
              {i % every === 0 ? (
                <text
                  x={m.l + i * bw + bw / 2}
                  y={H - 4}
                  textAnchor="middle"
                  className="fill-bone-2 font-mono"
                  fontSize="9"
                >
                  {s.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function AnalyticsStates({
  analytics,
  children,
}: {
  analytics: LoadState<AnalyticsData>;
  children: (d: AnalyticsData) => React.ReactNode;
}) {
  if (analytics.status === 'loading')
    return (
      <div
        aria-busy="true"
        aria-label="Loading analytics"
        className="flex max-w-2xl flex-col gap-3"
      >
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    );
  if (analytics.status === 'offline') return <OfflineState className="max-w-xl" />;
  if (analytics.status === 'error')
    return (
      <InlineError
        className="max-w-xl"
        title="Analytics could not be loaded"
        detail={analytics.message}
      />
    );
  return <>{children(analytics.data)}</>;
}

function Accuracy() {
  const models = [
    { name: 'Weighted average', fact: facts['res.model.wa'], hero: false },
    { name: 'CVE-only', fact: facts['res.model.advanced'], hero: false },
    { name: 'Bayesian', fact: facts['res.model.bayesian'], hero: false },
    { name: 'IG-DCTF', fact: facts['res.model.igdctf'], hero: true },
  ] as const;
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-bone-2">
          F1 on the synthetic corpus, positive class fabricated
          <SourceNote fact={facts['res.model.igdctf']} />
        </p>
        <SyntheticChip />
      </div>
      <ul aria-label="F1 by model" className="flex flex-col gap-3">
        {models.map((m) => (
          <li
            key={m.name}
            className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 text-sm"
          >
            <span className={m.hero ? 'text-bone' : 'text-bone-2'}>{m.name}</span>
            <Bar value={m.fact.value.f1} max={1} hero={m.hero} />
            <span className="num text-right text-bone">{f3(m.fact.value.f1)}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-bone-2">
        These are the saved corpus results, not a live measurement of this fleet.{' '}
        <Link
          href={`${ROUTES.research}#results`}
          className="rounded-chip text-bone underline underline-offset-4"
        >
          Results and limits
        </Link>
      </p>
    </div>
  );
}

export interface AnalyticsDrawerProps {
  id: string;
  analytics: LoadState<AnalyticsData>;
  actions?: ConsoleActions;
}

/**
 * Analytics drawer (FRONTEND_SPEC.md section 10.4): five tabs under the panes, opened from the top bar. Charts are hand-built
 * SVG and bars. Real and demo alert series are drawn apart, demo with a dashed outline, and never summed. The Accuracy tab shows the
 * saved corpus results from the generated facts and works without a data source.
 */
export function AnalyticsDrawer({ id, analytics, actions }: AnalyticsDrawerProps) {
  return (
    <section
      id={id}
      aria-label="Analytics"
      className="flex h-[40dvh] min-h-52 shrink-0 flex-col border-t border-line-strong bg-ink-1 p-3 md:p-4"
    >
      <Tabs defaultValue="fleet" className="flex min-h-0 flex-1 flex-col">
        <TabsList aria-label="Analytics views">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t.toLowerCase()}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="fleet" className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <AnalyticsStates analytics={analytics}>
            {(a) => {
              const tiers: { key: TierId | 'unscored'; name: string }[] = [
                { key: 'high', name: 'High' },
                { key: 'medium', name: 'Medium' },
                { key: 'low', name: 'Low' },
                { key: 'unscored', name: 'Unscored' },
              ];
              return (
                <CountRows
                  label="Devices by trust tier"
                  rows={tiers.map((t) => ({
                    key: t.key,
                    name: t.name,
                    value: a.fleet[t.key],
                    shape: <TierShape tier={t.key === 'unscored' ? null : t.key} />,
                    hero: t.key === 'low',
                  }))}
                />
              );
            }}
          </AnalyticsStates>
        </TabsContent>

        <TabsContent value="alerts" className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <AnalyticsStates analytics={analytics}>
            {(a) =>
              a.alerts.length === 0 ? (
                <p className="text-sm text-bone-2">No alerts in this period.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <Timeline
                    title="Real traffic"
                    label="Real alerts"
                    series={a.alerts.map((x) => ({ label: x.label, value: x.real }))}
                  />
                  <Timeline
                    title="Demo traffic"
                    label="Demo alerts"
                    dashed
                    series={a.alerts.map((x) => ({ label: x.label, value: x.demo }))}
                  />
                </div>
              )
            }
          </AnalyticsStates>
        </TabsContent>

        <TabsContent value="integrity" className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <AnalyticsStates analytics={analytics}>
            {(a) => (
              <CountRows
                label="Devices by gate status"
                rows={[
                  {
                    key: 'nominal',
                    name: 'Nominal',
                    value: a.integrity.nominal,
                    note: 'Signal integrity above the upper threshold: the gate leaves the score alone.',
                  },
                  {
                    key: 'tapered',
                    name: 'Tapered',
                    value: a.integrity.tapered,
                    note: 'Between the thresholds: the score is scaled down.',
                  },
                  {
                    key: 'hard',
                    name: 'Hard gated',
                    value: a.integrity.hardGated,
                    hero: true,
                    note: 'Below the lower threshold: the score is capped.',
                  },
                ]}
              />
            )}
          </AnalyticsStates>
        </TabsContent>

        <TabsContent value="ledger" className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <AnalyticsStates analytics={analytics}>
            {(a) => (
              <div className="flex max-w-xl flex-col gap-3 text-sm">
                <p className="text-bone-2">
                  Ledger entries <span className="num text-bone">{a.ledger.entries}</span>
                </p>
                <p role="status" className="text-bone">
                  {a.ledger.chainOk === null
                    ? 'Chain not verified yet.'
                    : a.ledger.chainOk
                      ? 'Chain verified: every entry links to the one before it.'
                      : 'Chain verification failed.'}
                  {a.ledger.message ? (
                    <span className="block text-bone-2">{a.ledger.message}</span>
                  ) : null}
                </p>
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!actions?.onVerifyLedger || actions.verifyingLedger}
                    aria-describedby={actions?.onVerifyLedger ? undefined : 'ledger-hint'}
                    onClick={actions?.onVerifyLedger}
                  >
                    {actions?.verifyingLedger ? 'Verifying…' : 'Verify full chain'}
                  </Button>
                </div>
                {!actions?.onVerifyLedger ? (
                  <p id="ledger-hint" className="text-bone-2">
                    Chain verification is not connected to a data source.
                  </p>
                ) : null}
              </div>
            )}
          </AnalyticsStates>
        </TabsContent>

        <TabsContent value="accuracy" className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <Accuracy />
        </TabsContent>
      </Tabs>
    </section>
  );
}
