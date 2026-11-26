import type { Metadata } from 'next';
import { ConsoleApp } from '@/components/console/console-app';

export const metadata: Metadata = { title: 'Console', robots: { index: false, follow: true } };

/** Console uses client hooks (TanStack Query, WebSocket): skip static prerendering. */
export const dynamic = 'force-dynamic';

export default function ConsolePage() {
  return <ConsoleApp />;
}
