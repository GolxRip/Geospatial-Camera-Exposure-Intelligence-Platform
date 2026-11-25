'use client';

import * as React from 'react';
import { Check, Copy } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/utils';

export interface CodeBlockProps {
  code: string;
  /** Short caption above the code, for example "backend". */
  label?: string;
  className?: string;
}

/** Mono code panel with a copy button that confirms success (FRONTEND_SPEC.md section 7.10). */
export function CodeBlock({ code, label, className }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={cn('surface-raised overflow-hidden rounded-panel border border-line', className)}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="font-mono text-xs text-bone-2">{label ?? 'shell'}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-xs text-bone-2 transition-surface hover:bg-ink-3 hover:text-bone"
        >
          {copied ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {/* Scrollable on narrow screens, so it must be reachable by keyboard (axe: scrollable-region-focusable) */}
      <pre
        tabIndex={0}
        role="region"
        aria-label={`${label ?? 'shell'} commands`}
        className="overflow-x-auto px-4 py-3 text-sm leading-6 text-bone"
      >
        <code>{code}</code>
      </pre>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </div>
  );
}
