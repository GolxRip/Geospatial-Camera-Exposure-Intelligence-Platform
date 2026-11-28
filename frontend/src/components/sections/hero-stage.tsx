'use client';

import * as React from 'react';
import { HoodCanvas } from '@/components/three/hood-canvas';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { animateNumbers } from '@/lib/animations';
import { feedBus } from '@/lib/three/feed-bus';
import type { HoodEngine } from '@/lib/three/hood-engine';

/**
 * Hero stage (FRONTEND_SPEC.md sections 7.2 and 8): the static SVG hood holds the position (and is the
 * accessible description) until the WebGL hood has drawn, then the canvas cross-fades over it, so nothing
 * shifts and WebGL failures fall back to the SVG. This is an illustration of the method, not data.
 */
export function HeroStage() {
  const reduced = usePrefersReducedMotion();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [live, setLive] = React.useState(false);

  const onReady = React.useCallback(
    (engine: HoodEngine) => {
      setLive(true);
      if (reduced) {
        Object.assign(engine.S, { eye: 1, prog: 1, stagger: 0, frames: 0.5, dolly: 9.4 });
        engine.invalidate();
      } else {
        // The eye ignites first, then the hood fans open (spec 7.2 entrance timeline).
        Object.assign(engine.S, { eye: 0, prog: 0, stagger: 1, frames: 0, dolly: 9.9 });
        const frame = () => engine.invalidate();
        animateNumbers(engine.S, { eye: 1 }, { delay: 200, duration: 520, ease: 'out', onFrame: frame });
        animateNumbers(engine.S, { prog: 1 }, { delay: 700, duration: 1500, ease: 'spring', onFrame: frame });
        animateNumbers(engine.S, { dolly: 9.4 }, { delay: 700, duration: 1500, ease: 'inOut', onFrame: frame });
        animateNumbers(engine.S, { frames: 0.75 }, { delay: 1300, duration: 900, ease: 'out', onFrame: frame });
      }
      // Bring up the page's feed field (mounted by FeedLayer on the landing page) with an amber pool behind the hood.
      feedBus.with((feed) => {
        Object.assign(feed.S, { accentX: 0.74, accentY: 0.5, accent: 0.14 });
        if (reduced) {
          feed.S.intro = 1;
          feed.invalidate();
        } else {
          animateNumbers(feed.S, { intro: 1 }, { duration: 1200, ease: 'out', onFrame: () => feed.invalidate() });
        }
      });
    },
    [reduced],
  );

  return (
    <div ref={rootRef} className="relative size-full">
      <div
        className={`absolute inset-0 grid place-items-center transition-opacity duration-500 ${live ? 'opacity-0' : 'opacity-100'}`}
      >
        <HoodGauge size={320} label="The COBRA-WATCH hood: nine ribs fanned around an amber eye" />
      </div>
      <HoodCanvas onReady={onReady} parallaxRoot={rootRef} />
    </div>
  );
}
