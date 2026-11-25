import Link from 'next/link';
import { facts } from '@/lib/content/facts.generated';
import { ROUTES } from '@/lib/constants/routes';
import { Badge } from './badge';

/**
 * "Synthetic corpus, n = 120": every accuracy figure wears it and links to the limits block
 * (FRONTEND_SPEC.md ground rule 3). n is read from the generated facts, never typed.
 */
export function SyntheticChip({ className }: { className?: string }) {
  const n = facts['res.corpus'].value.n_direct;
  return (
    <Badge asChild tone="outline" className={className}>
      <Link href={ROUTES.limits}>Synthetic corpus, n = {n}</Link>
    </Badge>
  );
}
