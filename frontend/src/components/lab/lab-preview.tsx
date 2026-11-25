'use client';

import { DemoBanner } from '@/components/console/demo-banner';
import { DEMO_ALERTS, DEMO_DEVICES } from '@/lib/data/demo';
import type { LabActions } from '@/lib/data/types';
import { LabTabs } from './lab-tabs';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Scripted stand-ins for the lab's data source: fixed responses after a short wait. They say nothing about any real service. */
const DEMO_ACTIONS: LabActions = {
  onSimulate: async (id) => {
    await wait(200);
    if (id === 'reset') return { status: 200, reason: 'Demo: simulator state cleared.' };
    if (id === 'rate-flood') return { status: 429, reason: 'Demo: rate limit reached.' };
    return {
      status: 200,
      reason: `Demo: ${id} accepted.`,
      alert: { ...DEMO_ALERTS[0]!, id: `demo-sim-${id}`, demo: true },
    };
  },
  onRunScenario: async (onEvent) => {
    for (let i = 0; i < 12; i += 1) {
      await wait(150);
      onEvent({
        ...DEMO_ALERTS[i]!,
        id: `demo-replay-${i}`,
        time: new Date().toISOString(),
        demo: true,
      });
    }
    return { status: 200, message: 'Demo: twelve events sent.' };
  },
  onNlQuery: async (q) => {
    await wait(200);
    if (q.toLowerCase().includes('fail')) throw new Error('Demo: the query service returned 503.');
    return {
      parsedByModel: false,
      filters: [{ name: 'text', value: q }],
      devices: DEMO_DEVICES.slice(0, 4),
    };
  },
};

/** The lab with scripted actions, for design review of the connected states. Rendered only by the dev-only preview route. */
export function LabPreview() {
  return (
    <main id="main" className="min-h-[100dvh] pb-24">
      <DemoBanner />
      <div className="page-container pt-10">
        <h1 className="text-h2 mb-10">Lab preview</h1>
        <LabTabs actions={DEMO_ACTIONS} />
      </div>
    </main>
  );
}
