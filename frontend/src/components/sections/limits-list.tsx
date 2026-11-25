import { cn } from '@/lib/utils';

/** The limits block (FRONTEND_SPEC.md section 3.3): mandatory wherever results appear. Claim ids are those of paper/CLAIMS.md. */
export const LIMITS = [
  {
    id: 'C1',
    text: 'The corpus is synthetic and hand-authored; labels for the 90 attribute-only scenarios follow the intended tier.',
  },
  {
    id: 'C4, C5',
    text: 'All of the gain comes from the 30 scenarios that carry Channel B fields; on the other 90, IG-DCTF equals the CVE-only model.',
  },
  { id: 'C7', text: 'The corpus cannot choose the gate thresholds: the sweep is flat.' },
  {
    id: 'C8, C10',
    text: 'Tier 1 was benchmarked on 13 distinct cases. Tier 2 was benchmarked on synthetic frames, with weights revised after seeing the benchmark.',
  },
  {
    id: 'C14',
    text: 'A loop of real footage has natural motion and is not caught by the frozen-frame rule.',
  },
  { id: 'C17', text: 'There is no field data. Real-world effectiveness is unverified.' },
] as const;

export function LimitsList({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {LIMITS.map((l) => (
        <li key={l.id} className="measure flex gap-4 text-body text-bone-2">
          <span className="num w-14 shrink-0 text-sm leading-7 text-bone">{l.id}</span>
          <span>{l.text}</span>
        </li>
      ))}
    </ul>
  );
}
