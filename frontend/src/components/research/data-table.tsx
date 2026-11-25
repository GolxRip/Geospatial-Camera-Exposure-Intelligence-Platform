import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A plain data table: caption, mono tabular numbers, hairline rows. It scrolls sideways inside its own region on narrow screens,
 * and that region is keyboard reachable.
 */
export function DataTable({
  caption,
  head,
  rows,
  className,
  emphasisRow,
}: {
  caption: string;
  head: string[];
  rows: React.ReactNode[][];
  className?: string;
  /** Index of the row to set in bone rather than bone-2 (the IG-DCTF row). */
  emphasisRow?: number;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className={cn('overflow-x-auto rounded-chip', className)}
    >
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <caption className="mb-3 text-left text-sm text-bone-2">{caption}</caption>
        <thead>
          <tr className="border-b border-line-strong">
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={cn('py-2 pr-4 font-medium text-bone-2', i > 0 && 'text-right')}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-line">
              {r.map((c, ci) =>
                ci === 0 ? (
                  <th
                    key={ci}
                    scope="row"
                    className={cn(
                      'py-2 pr-4 text-left font-normal',
                      ri === emphasisRow ? 'text-bone' : 'text-bone-2',
                    )}
                  >
                    {c}
                  </th>
                ) : (
                  <td
                    key={ci}
                    className={cn(
                      'num py-2 pr-4 text-right',
                      ri === emphasisRow ? 'text-bone' : 'text-bone-2',
                    )}
                  >
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
