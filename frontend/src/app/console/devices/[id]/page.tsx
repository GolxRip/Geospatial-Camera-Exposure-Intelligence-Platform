import type { Metadata } from 'next';
import { DeviceForensicsApp } from '@/components/console/device-forensics-app';

export const metadata: Metadata = { title: 'Device forensics', robots: { index: false, follow: true } };

/** Device forensics uses client hooks (TanStack Query) — skip static prerendering. */
export const dynamic = 'force-dynamic';

export default function DevicePage() {
  return <DeviceForensicsApp />;
}
