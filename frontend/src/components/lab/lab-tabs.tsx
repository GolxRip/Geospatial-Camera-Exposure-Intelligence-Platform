'use client';

import { GateExplorer } from '@/components/lab/gate-explorer';
import { QueryPanel, ReplayPanel, SimulatorsPanel } from '@/components/lab/instruments';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { LabActions } from '@/lib/data/types';

/**
 * The four lab instruments (FRONTEND_SPEC.md section 12). Radix tabs, so arrow keys move between them. The gate explorer runs the
 * scoring code in the browser; the other three call what `actions` provides and are marked as not connected when it provides nothing.
 */
export function LabTabs({ actions = {} }: { actions?: LabActions }) {
  return (
    <Tabs defaultValue="explorer">
      <TabsList aria-label="Instruments">
        <TabsTrigger value="explorer">Gate explorer</TabsTrigger>
        <TabsTrigger value="simulators">Attack simulators</TabsTrigger>
        <TabsTrigger value="replay">Scenario replay</TabsTrigger>
        <TabsTrigger value="nl">Natural-language query</TabsTrigger>
      </TabsList>
      <TabsContent value="explorer">
        <GateExplorer />
      </TabsContent>
      <TabsContent value="simulators">
        <SimulatorsPanel onSimulate={actions.onSimulate} />
      </TabsContent>
      <TabsContent value="replay">
        <ReplayPanel onRunScenario={actions.onRunScenario} />
      </TabsContent>
      <TabsContent value="nl">
        <QueryPanel onNlQuery={actions.onNlQuery} />
      </TabsContent>
    </Tabs>
  );
}
