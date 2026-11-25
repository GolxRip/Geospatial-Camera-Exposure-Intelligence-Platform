import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

/**
 * Error in place. `detail` is the backend's own message, shown verbatim. Pass `onRetry` only where a retry
 * can help: a 403 from the verdict route, for example, offers no retry loop (FRONTEND_SPEC.md section 10.3).
 */
export interface InlineErrorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string;
  detail?: string;
  onRetry?: () => void;
}

export function InlineError({ title, detail, onRetry, className, ...props }: InlineErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-input border border-signal/40 bg-signal-dim px-4 py-3 text-sm',
        className,
      )}
      {...props}
    >
      <p className="font-medium text-bone">{title}</p>
      {detail ? <p className="mt-1 break-words text-bone-2">{detail}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
