import { CtaBand } from '@/components/sections/cta-band';
import { FeedLayer } from '@/components/three/feed-layer';
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
 * Landing page (FRONTEND_SPEC.md section 7). FeedLayer is the fixed WebGL "feed field" behind the page (spec 9.1); it
 * mounts on the landing page only and stays invisible until the hero brings it up. `main` sits above it (z-content).
 */
export default function HomePage() {
  return (
    <>
      <FeedLayer />
      <main id="main" className="relative z-content">
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
    </>
  );
}
