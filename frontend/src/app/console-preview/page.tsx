import type { Metadata } from 'next';
import { ConsolePreview } from '@/components/console/console-preview';
import { requireDesignPreview } from '@/lib/data/preview-gate';

export const metadata: Metadata = {
  title: 'Console preview (demo data)',
  robots: { index: false, follow: false },
};

export default function ConsolePreviewPage() {
  requireDesignPreview();
  return <ConsolePreview />;
}
