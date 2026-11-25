'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

/** On/off control with a visible label: a switch role on a button, so Space and Enter both toggle it. */
export function Switch({ label, checked, onCheckedChange, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-3 rounded-input text-left',
        className,
      )}
    >
      <span className="text-sm text-bone-2">{label}</span>
      <span
        aria-hidden
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-surface',
          checked ? 'border-signal bg-signal-dim' : 'border-line-strong bg-ink-3',
        )}
      >
        <span
          className={cn(
            'absolute size-4 rounded-full transition-all duration-150',
            checked ? 'left-[1.625rem] bg-signal' : 'left-1 bg-bone-2',
          )}
        />
      </span>
      <span className="sr-only">{checked ? 'On' : 'Off'}</span>
    </button>
  );
}
