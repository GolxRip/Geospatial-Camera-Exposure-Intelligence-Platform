import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/utils';

/**
 * Button (FRONTEND_SPEC.md section 5.6). Controls are full pills. The primary label is ink-0 on amber
 * (9.5:1), never white on amber. MagneticButton arrives with the animation system in Phase 6.
 */
export const buttonVariants = cva(
  [
    'group inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap select-none',
    'font-medium transition-surface',
    'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
  ],
  {
    variants: {
      variant: {
        primary: 'rounded-control bg-signal text-ink-0 hover:bg-signal/90',
        secondary: 'rounded-control border border-line-strong bg-ink-2 text-bone hover:bg-ink-3',
        ghost: 'rounded-control text-bone-2 hover:bg-ink-3 hover:text-bone',
        link: 'rounded-chip px-0 text-bone underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-6 text-[15px]',
        lg: 'h-12 px-7 text-base',
      },
    },
    compoundVariants: [{ variant: 'link', size: ['sm', 'md', 'lg'], className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element (for example a Next.js Link) with the button styles. */
  asChild?: boolean;
  /** Trailing arrow that moves 2 px on hover (the text-link treatment from the hero). */
  arrow?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, arrow = false, children, type, ...props },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button ref={ref} type={type ?? 'button'} className={classes} {...props}>
      {children}
      {arrow ? (
        <ArrowRight
          aria-hidden
          size={16}
          weight="regular"
          className="transition-transform duration-[160ms] group-hover:translate-x-0.5"
        />
      ) : null}
    </button>
  );
});
