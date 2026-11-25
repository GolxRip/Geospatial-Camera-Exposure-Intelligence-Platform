import * as React from 'react';
import { cn } from '@/lib/utils';

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-chip border border-line-strong bg-ink-2 px-1.5 font-mono text-xs leading-5 text-bone-2',
        className,
      )}
      {...props}
    />
  );
}
