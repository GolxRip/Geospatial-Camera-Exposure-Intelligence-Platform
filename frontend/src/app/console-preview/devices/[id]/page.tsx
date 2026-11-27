import type { Metadata } from 'next';
import { DeviceForensicsPreview } from '@/components/console/console-preview';
import { requireDesignPreview } from '@/lib/data/preview-gate';
import { safeDecode } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Device forensics preview (demo data)',
  robots: { index: false, follow: false },
};

export default async function DeviceForensicsPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  requireDesignPreview();
  const { id } = await params;
  return <DeviceForensicsPreview id={safeDecode(id)} />;
}
