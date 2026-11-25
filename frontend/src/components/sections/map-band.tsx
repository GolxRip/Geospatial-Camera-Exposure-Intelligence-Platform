import Link from 'next/link';
import { Section } from '@/components/layout/section';
import { LazyDeviceMap } from '@/components/map/lazy-device-map';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { CTA_CONSOLE_LABEL, ROUTES } from '@/lib/constants/routes';

/**
 * "Seen from above" (FRONTEND_SPEC.md section 7.8): a full-bleed band with the device map. The landing page carries no device
 * data of its own, so it shows the map with an honest empty state. Pass `devices` from your data layer to fill it.
 */
export function MapBand() {
  return (
    <Section
      id="map"
      title="Seen from above"
      bleed
      headerExtra={
        <Link href={ROUTES.console} className={buttonVariants({ size: 'md' })}>
          {CTA_CONSOLE_LABEL}
        </Link>
      }
    >
      <div data-stage="map-band" className="h-[70dvh] min-h-96 border-y border-line">
        <LazyDeviceMap
          devices={[]}
          label="Map of India with the device layer"
          emptyState={
            <EmptyState title="No device data on this page">
              The console draws every scored device here, with its tier shape and a masked address.
              Positions are estimates.
            </EmptyState>
          }
        />
      </div>
    </Section>
  );
}
