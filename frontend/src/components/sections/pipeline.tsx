import { Section } from '@/components/layout/section';
import { SourceNote } from '@/components/ui/source-note';
import { facts } from '@/lib/content/facts.generated';
import { f1 } from '@/lib/format';
import { cn } from '@/lib/utils';

const STAGES = [
  {
    name: 'Detection event',
    text: 'A detection from authorized footage or a client, sent with an idempotency key.',
  },
  {
    name: 'Corroboration',
    text: 'Nearby cameras that agree raise the score. A lone camera lowers it.',
  },
  { name: 'Channel A', text: 'Posture from CVEs, authentication, owner type and firmware age.' },
  { name: 'Channel B', text: 'Banner drift, and frame liveness where footage is authorized.' },
  { name: 'The gate', text: 'G(s) multiplies the score and caps a tripped feed at 30.' },
  { name: 'Alert and audit ledger', text: 'The decision is hashed into a Merkle-chained ledger.' },
] as const;

/**
 * "From event to ledger" (FRONTEND_SPEC.md section 7.7): six stages in one row from 1024, two rows of three from 768, one
 * column below. Only the gate shows a measured number; the stages without a measurement show none.
 */
export function Pipeline() {
  const oh = facts['res.overhead'];
  return (
    <Section id="pipeline" title="From event to ledger">
      <ol className="grid gap-x-6 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s, i) => (
          <li
            key={s.name}
            className="relative flex flex-col gap-3 border-t border-line-strong pt-4"
          >
            <span className="num text-sm text-bone-2" aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3
              className={cn(
                'text-lg font-semibold tracking-tight',
                s.name === 'The gate' && 'text-signal',
              )}
            >
              {s.name}
            </h3>
            <p className="text-sm text-bone-2">{s.text}</p>
            {s.name === 'The gate' ? (
              <p className="num text-sm text-bone">
                {f1(oh.value.igdctf_us)} us per event
                <SourceNote fact={oh} />
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      <ul className="mt-14 grid gap-8 md:grid-cols-3">
        {[
          'Writes carry an idempotency key and a timestamp, and stale or repeated events are rejected.',
          'Every decision is a Merkle-chained audit entry that can be verified later.',
          'Sources are passive: stored scanner metadata, public catalogs and authorized footage.',
        ].map((t) => (
          <li key={t} className="text-body measure text-bone-2">
            {t}
          </li>
        ))}
      </ul>
    </Section>
  );
}
