'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChartBar, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/ui/button';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/lib/constants/routes';
import type { ConnectionInfo, FleetCounts, LoadState } from '@/lib/data/types';
import { cn } from '@/lib/utils';

function ConnectionStatus({ connection }: { connection: ConnectionInfo }) {
  const label =
    connection.status === 'live'
      ? 'Live'
      : connection.status === 'connecting'
        ? 'Connecting'
        : connection.retryInSeconds !== undefined
          ? `Disconnected, retrying in ${connection.retryInSeconds} s`
          : 'Disconnected';
  return (
    <p
      role="status"
      className="flex h-9 items-center gap-2 rounded-control border border-line px-3 text-sm text-bone"
    >
      <svg aria-hidden width="8" height="8" viewBox="0 0 8 8" className="shrink-0">
        {connection.status === 'live' ? <rect width="8" height="8" className="fill-bone" /> : null}
        {connection.status === 'connecting' ? (
          <rect
            x="0.75"
            y="0.75"
            width="6.5"
            height="6.5"
            fill="none"
            className="stroke-bone-2"
            strokeWidth="1.5"
          />
        ) : null}
        {connection.status === 'disconnected' ? (
          <path d="M0 4 H8" className="stroke-signal" strokeWidth="2" />
        ) : null}
      </svg>
      {label}
    </p>
  );
}

function Counts({ counts }: { counts: LoadState<FleetCounts> }) {
  if (counts.status === 'loading') return <Skeleton aria-hidden className="h-9 w-48" />;
  if (counts.status !== 'ready')
    return <p className="flex h-9 items-center text-sm text-bone-2">Counts unavailable</p>;
  const items = [
    ['Devices', counts.data.devices],
    ['Alerts', counts.data.alerts],
    ['Gate tripped', counts.data.gateTripped],
  ] as const;
  return (
    <dl aria-label="Counts" className="flex h-9 items-center gap-4 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-1.5">
          <dt className="text-bone-2">{k}</dt>
          <dd className="num text-bone">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface TopBarProps {
  connection: ConnectionInfo;
  counts: LoadState<FleetCounts>;
  cities: string[];
  city: string;
  onCityChange: (city: string) => void;
  onRunScenario?: () => void;
  onOpenPalette: () => void;
  analyticsOpen: boolean;
  onToggleAnalytics: () => void;
  /** Gate state of the selected device, which the mark in the corner reflects. Omit for the plain mark. */
  gauge?: { multiplier: number; score: number | null } | null;
}

/**
 * Console top bar (FRONTEND_SPEC.md section 10.1): the mark as a gauge of the selected device, connection status, city select,
 * counts, Run scenario, the command palette and the analytics drawer.
 */
export function TopBar({
  connection,
  counts,
  cities,
  city,
  onCityChange,
  onRunScenario,
  onOpenPalette,
  analyticsOpen,
  onToggleAnalytics,
  gauge,
}: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-3 py-2 md:px-4">
      <h1 className="sr-only">Console</h1>
      <Link
        href={ROUTES.home}
        aria-label="COBRA-WATCH, home"
        className="inline-flex min-h-11 items-center rounded-chip"
      >
        <HoodGauge size={44} gate={gauge?.multiplier ?? 1} trust={gauge?.score ?? 100} decorative />
      </Link>
      <ConnectionStatus connection={connection} />
      <label className="flex items-center">
        <span className="sr-only">City</span>
        <select
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          className="h-9 w-40 rounded-control border border-line-strong bg-ink-2 px-3 text-sm text-bone"
        >
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <Counts counts={counts} />
      <Button
        size="sm"
        disabled={!onRunScenario}
        aria-describedby={onRunScenario ? undefined : 'run-hint'}
        onClick={onRunScenario}
      >
        Run scenario
      </Button>
      {!onRunScenario ? (
        <span id="run-hint" className="sr-only">
          Scenario runs are not connected to a data source.
        </span>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-keyshortcuts="Control+K Meta+K"
          onClick={onOpenPalette}
        >
          <MagnifyingGlass aria-hidden size={16} />
          <span className="sr-only md:not-sr-only">Search</span>
          <span className="hidden items-center gap-1 md:flex" aria-hidden>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={analyticsOpen}
          aria-controls="analytics-drawer"
          className={cn(analyticsOpen && 'bg-ink-3')}
          onClick={onToggleAnalytics}
        >
          <ChartBar aria-hidden size={16} />
          Analytics
        </Button>
      </div>
    </header>
  );
}
