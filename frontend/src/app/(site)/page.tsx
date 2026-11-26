import { CtaBand } from '@/components/sections/cta-band';
import { EthicsSection } from '@/components/sections/ethics';
import { GateExplorer } from '@/components/sections/gate-explorer';
import { Hero } from '@/components/sections/hero';
import { MapBand } from '@/components/sections/map-band';
import { Pipeline } from '@/components/sections/pipeline';
import { Process } from '@/components/sections/process';
import { Results } from '@/components/sections/results';
import { TwinCameras } from '@/components/sections/twin-cameras';
import { WalkTheGate } from '@/components/sections/walk-the-gate';

export const dynamic = 'force-dynamic';

/**
 * Landing page structure (FRONTEND_SPEC.md section 7), build phase 3: every section is laid out at four breakpoints with
 * wireframe regions, no copy beyond headings, no motion. Content arrives in phase 4, motion in phase 6, WebGL in phase 7.
 */
export default function HomePage() {
  return (
    <main id="main">
      <Hero />
      <TwinCameras />
      <WalkTheGate />
      <GateExplorer />
      <Results />
      <Pipeline />
      <MapBand />
      <EthicsSection />
      <Process />
      <CtaBand />
    </main>
  );
}
