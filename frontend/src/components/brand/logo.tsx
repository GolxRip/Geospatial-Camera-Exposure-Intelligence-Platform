import Image from 'next/image';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { cn } from '@/lib/utils';

/**
 * Mark plus wordmark. The mark is drawn from the shared hood geometry; the wordmark is
 * public/brand/cobra-wordmark.svg, exported from build_logo.wordmark() by scripts/export-wordmark.py.
 * Neither is redrawn by hand (FRONTEND_SPEC.md section 6.1).
 */
export function Logo({ className, markSize = 40 }: { className?: string; markSize?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <HoodGauge size={markSize} decorative />
      <Image
        src="/brand/cobra-wordmark.svg"
        alt=""
        width={612}
        height={48}
        unoptimized
        className="h-3.5 w-auto"
      />
      <span className="sr-only">COBRA-WATCH</span>
    </span>
  );
}
