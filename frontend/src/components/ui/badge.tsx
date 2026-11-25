import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** Square badge (6 px radius). "Demo" is a dashed outline so scripted traffic never looks like real traffic. */
export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5 font-mono text-xs leading-5 tabular-nums',
  {
    variants: {
      tone: {
        neutral: 'border-line-strong bg-ink-2 text-bone-2',
        outline: 'border-line-strong text-bone',
        signal: 'border-signal/40 bg-signal-dim text-signal',
        demo: 'border-dashed border-bone-2/60 text-bone-2',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

export function Badge({ className, tone, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : 'span';
  return <Comp className={cn(badgeVariants({ tone }), className)} {...props} />;
}
