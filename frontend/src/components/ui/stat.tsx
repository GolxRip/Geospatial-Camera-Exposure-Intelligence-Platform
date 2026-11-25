import * as React from 'react';
import type { Fact } from '@/lib/content/facts.generated';
import { cn } from '@/lib/utils';
import { SourceNote } from './source-note';

/**
 * A single figure: big mono number, a label, an optional source. Stats are plain text on the page,
 * never cards (FRONTEND_SPEC.md section 7.6).
 */
export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  value: React.ReactNode;
  label: string;
  /** The fact the value was read from; renders the SourceNote marker. */
  fact?: Pick<Fact<unknown>, 'source' | 'section' | 'anchor'>;
  detail?: React.ReactNode;
}

export function Stat({ value, label, fact, detail, className, ...props }: StatProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)} {...props}>
      <div className="num text-4xl leading-none font-medium tracking-tight text-bone md:text-5xl">
        {value}
      </div>
      <div className="text-sm text-bone-2">
        {label}
        {fact ? <SourceNote fact={fact} /> : null}
      </div>
      {detail ? <div className="text-sm text-bone-2">{detail}</div> : null}
    </div>
  );
}
