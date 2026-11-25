import { notFound } from 'next/navigation';
import { env } from '@/lib/env';

/**
 * The /console-preview routes show labelled demo data. They are available in `next dev`, and in a production build only when
 * NEXT_PUBLIC_DESIGN_PREVIEW=true was set at build time. Otherwise they are a 404.
 */
export function requireDesignPreview(): void {
  if (process.env.NODE_ENV === 'production' && !env.designPreview) notFound();
}
