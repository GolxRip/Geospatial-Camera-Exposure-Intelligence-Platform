import * as React from 'react';
import { cn } from '@/lib/utils';

/** Loading placeholder. Rows should match the final layout. The pulse is disabled under reduced motion by the global rule. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div aria-hidden className={cn('animate-pulse rounded-input bg-ink-2', className)} {...props} />
  );
}
