'use client';

import * as React from 'react';
import { demoConsoleData, demoDetail } from '@/lib/data/demo';
import type { AlertRow, ConsoleActions, ConsoleData } from '@/lib/data/types';
import { env } from '@/lib/env';
import { ConsoleShell } from './console-shell';
import { DemoBanner } from './demo-banner';
import { DeviceForensics } from './device-forensics';

const previewDeviceHref = (id: string) => `/console-preview/devices/${encodeURIComponent(id)}`;

function useDemoActions(setExtra: React.Dispatch<React.SetStateAction<AlertRow[]>> | null): {
  actions: ConsoleActions;
  ledgerNote: string | undefined;
} {
  const runs = React.useRef(0);
  const [ledgerNote, setLedgerNote] = React.useState<string | undefined>();
  const actions: ConsoleActions = {
    onRunScenario: setExtra
      ? () => {
          runs.current += 1;
          const run = runs.current;
          const now = new Date().toISOString();
          setExtra((rows) => [
            {
              id: `demo-run-${run}-tripped`,
              time: now,
              deviceId: 'demo-3',
              deviceLabel: 'Camera 004',
              tier: 'low',
              gateTripped: true,
              action: 'low_trust',
              score: 22,
              demo: true,
              ownerType: 'telecom',
            },
            {
              id: `demo-run-${run}-ok`,
              time: now,
              deviceId: 'demo-8',
              deviceLabel: 'Camera 009',
              tier: 'high',
              gateTripped: false,
              action: 'high_trust',
              score: 91,
              demo: true,
              ownerType: 'government',
            },
            ...rows,
          ]);
        }
      : undefined,
    onVerdict: async () => {
      await new Promise((r) => setTimeout(r, 250));
    },
    onVerifyLedger: () => setLedgerNote('Demo: nothing was verified.'),
  };
  return { actions, ledgerNote };
}

/** The console with demo data, for design review. Rendered only by the dev-only /console-preview route. */
export function ConsolePreview() {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [city, setCity] = React.useState('All India');
  const [extra, setExtra] = React.useState<AlertRow[]>([]);
  const { actions, ledgerNote } = useDemoActions(setExtra);
  const data: ConsoleData = React.useMemo(() => {
    const base = demoConsoleData(selected, city, extra);
    if (ledgerNote && base.analytics.status === 'ready') {
      return {
        ...base,
        analytics: {
          status: 'ready',
          data: {
            ...base.analytics.data,
            ledger: { ...base.analytics.data.ledger, message: ledgerNote },
          },
        },
      };
    }
    return base;
  }, [selected, city, extra, ledgerNote]);
  return (
    <ConsoleShell
      data={data}
      actions={actions}
      selectedDeviceId={selected}
      onSelectDevice={setSelected}
      city={city}
      onCityChange={setCity}
      mapStyleUrl={env.mapStyleUrl}
      deviceHref={previewDeviceHref}
      banner={<DemoBanner />}
    />
  );
}

export function DeviceForensicsPreview({ id }: { id: string }) {
  const { actions } = useDemoActions(null);
  const detail = React.useMemo(() => demoDetail(id), [id]);
  return (
    <DeviceForensics
      detail={{ status: 'ready', data: detail }}
      actions={actions}
      backHref="/console-preview"
      banner={<DemoBanner />}
    />
  );
}
