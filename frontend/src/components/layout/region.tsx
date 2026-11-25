import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Wireframe block used while the structure of a page is being settled (build phase 3). It marks where real
 * content, a canvas or a map will go, in a dashed outline so that it cannot be mistaken for data. It carries no
 * numbers and no copy. Phases 4 to 9 replace each one with the real thing.
 */
export function Region({
  label,
  className,
  children,
  ...props
}: { label: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-region={label}
      className={cn(
        'flex min-h-10 flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-line-strong px-3 py-2 text-center font-mono text-xs leading-5 text-bone-2',
        className,
      )}
      {...props}
    >
      {children}
      <span>{label}</span>
    </div>
  );
}
