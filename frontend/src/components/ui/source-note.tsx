'use client';

import { ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
import type { Fact } from '@/lib/content/facts.generated';
import { repoFileUrl } from '@/lib/env';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

/**
 * Footnote marker that links a number to the section of paper/results.md it came from
 * (FRONTEND_SPEC.md section 5.6). It takes the Fact object itself, so a number and its source cannot drift apart.
 */
export function SourceNote({
  fact,
}: {
  fact: Pick<Fact<unknown>, 'source' | 'section' | 'anchor'>;
}) {
  const href = repoFileUrl('paper/results.md', fact.anchor);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Source: paper/results.md, ${fact.section}`}
          className="ml-1 inline-flex align-super text-bone-2 transition-surface hover:text-signal"
        >
          <ArrowUpRight aria-hidden size={12} weight="regular" />
        </a>
      </TooltipTrigger>
      <TooltipContent>
        <span className="block text-bone">paper/results.md, {fact.section}</span>
        <span className="mt-1 block break-all font-mono text-bone-2">{fact.source}</span>
      </TooltipContent>
    </Tooltip>
  );
}
