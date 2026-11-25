'use client';

import * as React from 'react';
import { DeviceMap, type DeviceMapProps } from './device-map';

/** Mounts the map (and so loads MapLibre) only when the band is within one screen of the viewport. */
export function LazyDeviceMap(props: DeviceMapProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [near, setNear] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="size-full">
      {near ? <DeviceMap {...props} /> : null}
    </div>
  );
}
