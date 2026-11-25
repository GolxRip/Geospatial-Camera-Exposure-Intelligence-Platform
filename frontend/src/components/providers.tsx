'use client';

import * as React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

/** Client-side providers. TanStack Query joins here with the data layer in Phase 4. */
export function Providers({ children }: { children: React.ReactNode }) {
  return <TooltipProvider delayDuration={200}>{children}</TooltipProvider>;
}
