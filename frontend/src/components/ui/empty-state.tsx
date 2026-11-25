import * as React from 'react';
import { cn } from '@/lib/utils';

/** Designed empty state, for example "No alerts yet. Run a scenario or send an event." */
export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, children, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-panel border border-dashed border-line-strong px-6 py-8 text-center',
        className,
      )}
      {...props}
    >
      <p className="font-medium text-bone">{title}</p>
      {children ? (
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-bone-2">{children}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
