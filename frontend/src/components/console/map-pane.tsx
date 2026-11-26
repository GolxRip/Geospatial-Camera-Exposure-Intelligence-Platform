'use client';

import * as React from 'react';
import { DeviceMap } from '@/components/map/device-map';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/inline-error';
import { OfflineState } from '@/components/ui/offline-state';
import { Skeleton } from '@/components/ui/skeleton';
import { TierShape } from '@/components/ui/tier-tag';
import type { LoadState, MapDevice } from '@/lib/data/types';

function Legend() {
  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-overlay max-w-[calc(100%-4.5rem)] rounded-panel border border-line bg-ink-1 px-3 py-2">
      <p className="sr-only">Legend</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-bone">
        <li className="flex items-center gap-1.5">
          <TierShape tier="high" size={14} />
          High
        </li>
        <li className="flex items-center gap-1.5">
          <TierShape tier="medium" size={14} />
          Medium
        </li>
        <li className="flex items-center gap-1.5">
          <TierShape tier="low" size={14} />
          Low
        </li>
        <li className="flex items-center gap-1.5">
          <TierShape tier="low" gateTripped size={14} />
          Gate tripped
        </li>
        <li className="flex items-center gap-1.5">
          <TierShape tier={null} size={14} />
          Unscored
        </li>
      </ul>
    </div>
  );
}

export interface MapPaneProps {
  devices: LoadState<MapDevice[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  styleUrl?: string;
  center?: [number, number];
  zoom?: number;
  className?: string;
}

/**
 * The map pane (FRONTEND_SPEC.md section 10.2): MapLibre with a clustered device layer, the legend and the states. The map has
 * no radius and no frame of its own. Heat layer, collusion arcs and zone drawing are not built.
 */
export function MapPane({
  devices,
  selectedId,
  onSelect,
  styleUrl,
  center,
  zoom,
  className,
}: MapPaneProps) {
  const list = devices.status === 'ready' ? devices.data : [];
  const emptyState =
    devices.status === 'loading' ? (
      <div role="status" className="flex flex-col items-center gap-2">
        <Skeleton className="h-10 w-48" />
        <span className="sr-only">Loading devices</span>
      </div>
    ) : devices.status === 'offline' ? (
      <OfflineState />
    ) : devices.status === 'error' ? (
      <InlineError title="Devices could not be loaded" detail={devices.message} />
    ) : (
      <EmptyState title="No devices to show">
        Devices appear here when the data source returns them.
      </EmptyState>
    );
  return (
    <section aria-label="Map" className={className}>
      <div className="relative min-h-0 flex-1">
        <DeviceMap
          devices={list}
          selectedId={selectedId}
          onSelect={onSelect}
          styleUrl={styleUrl}
          center={center}
          zoom={zoom}
          emptyState={emptyState}
          className="absolute inset-0"
        />
        <Legend />
      </div>
    </section>
  );
}
