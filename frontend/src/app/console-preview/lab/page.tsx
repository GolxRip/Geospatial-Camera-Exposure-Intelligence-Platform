import type { Metadata } from 'next';
import { LabPreview } from '@/components/lab/lab-preview';
import { requireDesignPreview } from '@/lib/data/preview-gate';

export const metadata: Metadata = {
  title: 'Lab preview (demo data)',
  robots: { index: false, follow: false },
};

export default function LabPreviewPage() {
  requireDesignPreview();
  return <LabPreview />;
}
