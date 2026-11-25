import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The honest offline state (FRONTEND_SPEC.md ground rule 2). Live views show this instead of placeholder or sample data when the
 * data source cannot be reached. The integration hint is for the developer and is not rendered in a production build.
 */
export function OfflineState({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      className={cn(
        'surface-raised rounded-panel border border-line-strong px-6 py-5 text-sm',
        className,
      )}
      {...props}
    >
      <p className="text-bone">Data source not reachable.</p>
      <p className="mt-1 text-bone-2">Nothing is shown in its place.</p>
      {process.env.NODE_ENV !== 'production' ? (
        <p className="mt-2 text-bone-2">
          Developer: return data from <code className="text-bone">useConsoleData()</code> in{' '}
          <code className="text-bone">src/lib/data/use-console-data.ts</code>.
        </p>
      ) : null}
    </div>
  );
}
