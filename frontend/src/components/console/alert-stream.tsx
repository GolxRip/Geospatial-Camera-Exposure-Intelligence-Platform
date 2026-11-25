'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { DemoTag } from '@/components/ui/demo-tag';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { OfflineState } from '@/components/ui/offline-state';
import { Skeleton } from '@/components/ui/skeleton';
import { TierTag } from '@/components/ui/tier-tag';
import type { AlertRow, LoadState, TierId } from '@/lib/data/types';
import { cn } from '@/lib/utils';

const ROW_HEIGHT = 64;
const ANNOUNCE_EVERY_MS = 5000;

type TierFilter = 'all' | TierId;
type DemoFilter = 'all' | 'real' | 'demo';

/** One alert row at its final layout: time, tier shape, device label, tier tag, action, score, demo tag (FRONTEND_SPEC.md 10.1). */
function RowSkeleton() {
  return (
    <li aria-hidden className="flex h-16 flex-col justify-center gap-2 border-b border-line px-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 w-8" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </li>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

function fullTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-bone-2">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full min-w-0 rounded-control border border-line-strong bg-ink-2 px-3 text-sm text-bone"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface AlertStreamProps {
  alerts: LoadState<AlertRow[]>;
  selectedDeviceId: string | null;
  onSelectDevice: (id: string) => void;
  onRunScenario?: () => void;
  className?: string;
}

/**
 * The alert stream (FRONTEND_SPEC.md sections 10.1 and 10.7): newest first, virtualised, with filters for tier, gate tripped,
 * demo traffic and owner type. It is one listbox: arrow keys move through the rows, Enter selects. Gate-tripped alerts that arrive
 * after the first load are announced through a polite live region, at most one every five seconds.
 */
export function AlertStream({
  alerts,
  selectedDeviceId,
  onSelectDevice,
  onRunScenario,
  className,
}: AlertStreamProps) {
  const [tier, setTier] = React.useState<TierFilter>('all');
  const [tripped, setTripped] = React.useState(false);
  const [demo, setDemo] = React.useState<DemoFilter>('all');
  const [owner, setOwner] = React.useState('all');
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState('');

  const rows = alerts.status === 'ready' ? alerts.data : null;

  const owners = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) if (r.ownerType) set.add(r.ownerType);
    return [...set].sort();
  }, [rows]);

  const filtered = React.useMemo(() => {
    if (!rows) return [];
    return rows.filter(
      (r) =>
        (tier === 'all' || r.tier === tier) &&
        (!tripped || r.gateTripped) &&
        (demo === 'all' || (demo === 'demo' ? r.demo : !r.demo)) &&
        (owner === 'all' || r.ownerType === owner),
    );
  }, [rows, tier, tripped, demo, owner]);

  const clearFilters = () => {
    setTier('all');
    setTripped(false);
    setDemo('all');
    setOwner('all');
  };

  // Polite announcements for newly arrived gate-tripped alerts: skipped on first load, throttled to one per five seconds.
  const seen = React.useRef<Set<string> | null>(null);
  const lastAnnounced = React.useRef(0);
  const pending = React.useRef<AlertRow | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!rows) return;
    if (seen.current === null) {
      seen.current = new Set(rows.map((r) => r.id));
      return;
    }
    const known = seen.current;
    const fresh = rows.filter((r) => !known.has(r.id));
    for (const r of fresh) known.add(r.id);
    const newest = fresh.find((r) => r.gateTripped);
    if (!newest) return;
    pending.current = newest;
    const flush = () => {
      const a = pending.current;
      pending.current = null;
      timer.current = null;
      if (!a) return;
      lastAnnounced.current = Date.now();
      const score = a.score === null ? 'unscored' : `score ${Math.round(a.score)}`;
      setAnnouncement(`Gate tripped on ${a.deviceLabel}, ${score}${a.demo ? ', demo' : ''}.`);
    };
    const wait = ANNOUNCE_EVERY_MS - (Date.now() - lastAnnounced.current);
    if (wait <= 0) flush();
    else if (!timer.current) timer.current = setTimeout(flush, wait);
  }, [rows]);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  // TanStack Virtual returns functions the React Compiler cannot memoize; the compiler skips this component, which is fine.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const activeIndex = activeId ? filtered.findIndex((r) => r.id === activeId) : -1;
  const move = (next: number) => {
    const i = Math.max(0, Math.min(filtered.length - 1, next));
    const row = filtered[i];
    if (!row) return;
    setActiveId(row.id);
    virtualizer.scrollToIndex(i);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (filtered.length === 0) return;
    const page = Math.max(
      1,
      Math.floor((scrollRef.current?.clientHeight ?? ROW_HEIGHT * 5) / ROW_HEIGHT) - 1,
    );
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(activeIndex < 0 ? 0 : activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(activeIndex < 0 ? 0 : activeIndex - 1);
        break;
      case 'PageDown':
        e.preventDefault();
        move((activeIndex < 0 ? 0 : activeIndex) + page);
        break;
      case 'PageUp':
        e.preventDefault();
        move((activeIndex < 0 ? 0 : activeIndex) - page);
        break;
      case 'Home':
        e.preventDefault();
        move(0);
        break;
      case 'End':
        e.preventDefault();
        move(filtered.length - 1);
        break;
      case 'Enter':
      case ' ': {
        const row = activeIndex >= 0 ? filtered[activeIndex] : undefined;
        if (row) {
          e.preventDefault();
          onSelectDevice(row.deviceId);
        }
        break;
      }
    }
  };

  const optionId = (id: string) => `alert-option-${id}`;

  let body: React.ReactNode;
  if (alerts.status === 'loading') {
    body = (
      <ul aria-label="Loading alerts" aria-busy="true">
        {Array.from({ length: 10 }, (_, i) => (
          <RowSkeleton key={i} />
        ))}
      </ul>
    );
  } else if (alerts.status === 'offline') {
    body = <OfflineState className="m-3" />;
  } else if (alerts.status === 'error') {
    body = (
      <InlineError className="m-3" title="Alerts could not be loaded" detail={alerts.message} />
    );
  } else if (alerts.data.length === 0) {
    body = (
      <EmptyState
        className="m-3"
        title="No alerts yet"
        action={
          onRunScenario ? (
            <Button variant="secondary" size="sm" onClick={onRunScenario}>
              Run scenario
            </Button>
          ) : undefined
        }
      >
        Run a scenario or send an event.
      </EmptyState>
    );
  } else if (filtered.length === 0) {
    body = (
      <EmptyState
        className="m-3"
        title="No alerts match these filters"
        action={
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  } else {
    body = (
      <div
        role="listbox"
        aria-label="Alerts, newest first"
        tabIndex={0}
        aria-activedescendant={activeId && activeIndex >= 0 ? optionId(activeId) : undefined}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (!activeId && filtered[0]) setActiveId(filtered[0].id);
        }}
        className="group/list relative rounded-none"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((v) => {
          const r = filtered[v.index]!;
          const selected = r.deviceId === selectedDeviceId;
          const active = r.id === activeId;
          return (
            <div
              key={r.id}
              id={optionId(r.id)}
              role="option"
              aria-selected={selected}
              aria-posinset={v.index + 1}
              aria-setsize={filtered.length}
              data-tripped={r.gateTripped || undefined}
              onClick={() => {
                setActiveId(r.id);
                onSelectDevice(r.deviceId);
              }}
              className={cn(
                'absolute inset-x-0 flex cursor-pointer flex-col justify-center gap-1.5 border-b border-line px-3 text-sm transition-surface hover:bg-ink-2',
                selected && 'bg-ink-3',
                active &&
                  'group-focus-visible/list:outline-2 group-focus-visible/list:-outline-offset-2 group-focus-visible/list:outline-signal',
              )}
              style={{ height: v.size, transform: `translateY(${v.start}px)` }}
            >
              <div className="flex items-baseline gap-3">
                <time
                  dateTime={r.time}
                  title={fullTime(r.time)}
                  className="num shrink-0 text-xs text-bone-2"
                >
                  {formatTime(r.time)}
                </time>
                <span className="min-w-0 flex-1 truncate text-bone">{r.deviceLabel}</span>
                <span className="num shrink-0 text-bone">
                  {r.score === null ? '--' : Math.round(r.score)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TierTag tier={r.tier} gateTripped={r.gateTripped} demo={r.demo} size={14} />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-bone-2">
                  {r.action}
                </span>
                {r.demo ? <DemoTag compact /> : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const ready = alerts.status === 'ready';
  return (
    <section aria-labelledby="stream-title" className={className}>
      <div className="flex flex-col gap-3 border-b border-line p-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="stream-title" className="text-base font-semibold tracking-tight">
            Alerts
          </h2>
          {ready ? (
            <p className="num text-xs text-bone-2" aria-live="off">
              {filtered.length === rows!.length
                ? `${rows!.length} alerts`
                : `${filtered.length} of ${rows!.length}`}
            </p>
          ) : null}
        </div>
        {ready && rows!.length > 0 ? (
          <div role="group" aria-label="Alert filters" className="grid grid-cols-2 gap-x-2 gap-y-2">
            <FilterSelect
              label="Tier"
              value={tier}
              onChange={(v) => setTier(v as TierFilter)}
              options={[
                { value: 'all', label: 'All tiers' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
            <FilterSelect
              label="Traffic"
              value={demo}
              onChange={(v) => setDemo(v as DemoFilter)}
              options={[
                { value: 'all', label: 'All traffic' },
                { value: 'real', label: 'Real only' },
                { value: 'demo', label: 'Demo only' },
              ]}
            />
            <FilterSelect
              label="Owner type"
              value={owner}
              onChange={setOwner}
              options={[
                { value: 'all', label: 'All owners' },
                ...owners.map((o) => ({ value: o, label: o })),
              ]}
            />
            <label className="flex items-end gap-2 pb-2 text-sm text-bone">
              <input
                type="checkbox"
                checked={tripped}
                onChange={(e) => setTripped(e.target.checked)}
                className="size-4 accent-signal"
              />
              Gate tripped
            </label>
          </div>
        ) : null}
      </div>
      <div
        ref={scrollRef}
        role="region"
        aria-label="Alert list"
        tabIndex={ready && filtered.length > 0 ? -1 : 0}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {body}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
