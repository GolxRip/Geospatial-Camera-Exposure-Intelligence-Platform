'use client';

import * as React from 'react';
import { deviceRoute } from '@/lib/constants/routes';
import type { ConsoleActions, ConsoleData } from '@/lib/data/types';
import { cn } from '@/lib/utils';
import { AlertStream } from './alert-stream';
import { AnalyticsDrawer } from './analytics-drawer';
import { CommandPalette } from './command-palette';
import { Inspector } from './inspector';
import { MapPane } from './map-pane';
import { TopBar } from './top-bar';

type View = 'map' | 'stream' | 'detail';

function SwitchButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="inline-flex h-10 flex-1 items-center justify-center rounded-control border border-line px-5 text-sm text-bone-2 transition-surface hover:text-bone aria-pressed:border-line-strong aria-pressed:bg-ink-3 aria-pressed:text-bone"
    >
      {children}
    </button>
  );
}

export interface ConsoleShellProps {
  data: ConsoleData;
  actions?: ConsoleActions;
  selectedDeviceId: string | null;
  onSelectDevice: (id: string | null) => void;
  city: string;
  onCityChange: (city: string) => void;
  /** MapLibre style URL for the basemap. Omit for a plain dark canvas. */
  mapStyleUrl?: string;
  /** Where "Open forensics" goes for a device. Defaults to the device route. */
  deviceHref?: (id: string) => string;
  /** Rendered above the top bar, for example the demo-data banner. */
  banner?: React.ReactNode;
}

/**
 * Console layout (FRONTEND_SPEC.md sections 10.1 and 21), as a controlled component: it renders `data` and calls back; it never
 * fetches. Selection and city are owned by the parent.
 *   1280 and up    three panes: stream 3, map 6, inspector 3 columns
 *   1024 to 1279   three panes, narrower inspector
 *   768 to 1023    two panes: the map and one side pane, chosen with a segmented control (stream or inspector)
 *   below 768      one pane at a time, chosen with three buttons (map, stream, detail)
 * Hidden panes are display: none, so they leave the accessibility tree; each is one control away. The shell is a tool surface:
 * it fills the viewport and scrolls inside its panes. Selecting a device on a narrow screen opens the detail pane.
 */
export function ConsoleShell({
  data,
  actions,
  selectedDeviceId,
  onSelectDevice,
  city,
  onCityChange,
  mapStyleUrl,
  deviceHref = deviceRoute,
  banner,
}: ConsoleShellProps) {
  const [view, setView] = React.useState<View>('map');
  const [analyticsOpen, setAnalyticsOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const select = (id: string) => {
    onSelectDevice(id);
    setView('detail');
  };

  const gauge =
    data.detail.status === 'ready' && data.detail.data
      ? { multiplier: data.detail.data.gate.multiplier, score: data.detail.data.score }
      : null;

  const pane = 'min-h-0 flex-col border-line';
  const mapClass = cn(
    pane,
    'md:col-start-1 md:row-start-1 lg:col-start-2',
    view === 'map' ? 'flex' : 'hidden md:flex',
  );
  const streamClass = cn(
    pane,
    'md:col-start-2 md:row-start-1 md:border-l lg:col-start-1 lg:border-l-0 lg:border-r',
    view === 'stream' ? 'flex' : view === 'detail' ? 'hidden lg:flex' : 'hidden md:flex',
  );
  const detailClass = cn(
    pane,
    'md:col-start-2 md:row-start-1 md:border-l lg:col-start-3',
    view === 'detail' ? 'flex' : 'hidden lg:flex',
  );

  return (
    <main id="main" className="flex h-[100dvh] flex-col">
      {banner}
      <TopBar
        connection={data.connection}
        counts={data.counts}
        cities={data.cities}
        city={city}
        onCityChange={onCityChange}
        onRunScenario={actions?.onRunScenario}
        onOpenPalette={() => setPaletteOpen(true)}
        analyticsOpen={analyticsOpen}
        onToggleAnalytics={() => setAnalyticsOpen((v) => !v)}
        gauge={gauge}
      />

      <div
        role="group"
        aria-label="Panes"
        className="flex gap-2 border-b border-line px-3 py-2 md:hidden"
      >
        {(['map', 'stream', 'detail'] as const).map((v) => (
          <SwitchButton key={v} pressed={view === v} onClick={() => setView(v)}>
            {v === 'map' ? 'Map' : v === 'stream' ? 'Stream' : 'Detail'}
          </SwitchButton>
        ))}
      </div>
      <div
        role="group"
        aria-label="Side pane"
        className="hidden justify-end gap-2 border-b border-line px-4 py-2 md:flex lg:hidden"
      >
        <div className="flex w-72 gap-2">
          <SwitchButton pressed={view !== 'detail'} onClick={() => setView('stream')}>
            Stream
          </SwitchButton>
          <SwitchButton pressed={view === 'detail'} onClick={() => setView('detail')}>
            Detail
          </SwitchButton>
        </div>
      </div>

      <div
        className={cn(
          'grid min-h-0 flex-1 grid-cols-1',
          'md:grid-cols-[minmax(0,1fr)_20rem]',
          'lg:grid-cols-[minmax(15rem,3fr)_minmax(0,6fr)_minmax(14rem,2.2fr)]',
          'xl:grid-cols-[minmax(0,3fr)_minmax(0,6fr)_minmax(0,3fr)]',
        )}
      >
        <AlertStream
          alerts={data.alerts}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={select}
          onRunScenario={actions?.onRunScenario}
          className={streamClass}
        />
        <MapPane
          devices={data.devices}
          selectedId={selectedDeviceId}
          onSelect={select}
          styleUrl={mapStyleUrl}
          className={mapClass}
        />
        <section aria-labelledby="inspector-title" className={detailClass}>
          <div className="border-b border-line p-3">
            <h2 id="inspector-title" className="text-base font-semibold tracking-tight">
              Inspector
            </h2>
          </div>
          <div
            role="region"
            aria-label="Inspector sections"
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto p-3"
          >
            <Inspector detail={data.detail} actions={actions} deviceHref={deviceHref} />
          </div>
        </section>
      </div>

      {analyticsOpen ? (
        <AnalyticsDrawer id="analytics-drawer" analytics={data.analytics} actions={actions} />
      ) : null}

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        cities={data.cities}
        onCityChange={onCityChange}
        devices={data.devices.status === 'ready' ? data.devices.data : []}
        onSelectDevice={select}
        onRunScenario={actions?.onRunScenario}
        onToggleAnalytics={() => setAnalyticsOpen((v) => !v)}
      />
    </main>
  );
}
