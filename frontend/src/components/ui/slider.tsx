'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Visible value text, for example "0.25". */
  display: string;
  /** Spoken value: the computed outcome of this setting (FRONTEND_SPEC.md section 20). */
  valueText: string;
  className?: string;
}

/** Native range input, labelled above with its value beside it. Arrow keys, Home and End work as in the platform. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  valueText,
  className,
}: SliderProps) {
  const id = React.useId();
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-bone-2">
          {label}
        </label>
        <output htmlFor={id} className="num text-sm text-bone">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
