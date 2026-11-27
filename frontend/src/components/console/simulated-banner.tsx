'use client';

import Link from 'next/link';
import { useProvenance } from '@/lib/api/console-hooks';
import { ROUTES } from '@/lib/constants/routes';

/**
 * Persistent top banner shown across live console and device forensics views whenever
 * the connected database serves seeded `synthetic_demo` fixture records.
 */
export function SimulatedBanner({ city = 'All India' }: { city?: string }) {
  const provenanceQ = useProvenance(city);
  const prov = provenanceQ.data;
  if (!prov || prov.synthetic_devices <= 0) return null;

  return (
    <div
      role="status"
      className="border-b border-dashed border-bone-2/60 bg-ink-1 px-4 py-1.5 text-center text-xs text-bone"
    >
      Simulated data active: {prov.synthetic_devices} of {prov.total_devices} displayed devices in{' '}
      {prov.city} use synthetic fixtures with /24 IP masking (real camera IPs and live streams are
      withheld for legal and privacy safety; see{' '}
      <Link href={`${ROUTES.research}#limits`} className="underline underline-offset-2">
        Research
      </Link>
      ).
    </div>
  );
}
