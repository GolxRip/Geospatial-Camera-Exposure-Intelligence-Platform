import Link from 'next/link';
import { Section } from '@/components/layout/section';
import { ROUTES } from '@/lib/constants/routes';

const COLUMNS = [
  {
    title: 'Passive only',
    lines: [
      'Scoring uses stored scanner metadata and public vulnerability catalogs.',
      'Zero outbound probes or TCP connections are opened to discovered devices.',
    ],
  },
  {
    title: 'No live video from discovered devices',
    lines: [
      'The video module runs only on pre-authorized, recorded footage.',
      'It does not take live streams from cameras found on the internet.',
    ],
  },
  {
    title: 'No biometrics or personal data',
    lines: [
      'No face recognition, no license plate recognition, no tracking of people.',
      'It stores device IP, manufacturer, port and security posture, nothing about citizens.',
    ],
  },
] as const;

/** "What it will never do" (FRONTEND_SPEC.md section 7.9): three columns of plain text, no cards; one column below 768. */
export function EthicsSection() {
  return (
    <Section id="ethics" title="What it will never do">
      <div className="grid gap-10 md:grid-cols-3">
        {COLUMNS.map((c) => (
          <div key={c.title} className="flex flex-col gap-4 border-t border-line-strong pt-6">
            <h3 className="text-xl font-semibold tracking-tight">{c.title}</h3>
            {c.lines.map((l) => (
              <p key={l} className="text-body text-bone-2">
                {l}
              </p>
            ))}
          </div>
        ))}
      </div>
      <Link
        href={ROUTES.ethics}
        className="mt-10 inline-block rounded-chip text-bone underline underline-offset-4 transition-surface hover:text-signal"
      >
        Read the full policy
      </Link>
    </Section>
  );
}
