import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/brand/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/ui/code-block';
import { DemoTag } from '@/components/ui/demo-tag';
import { EmptyState } from '@/components/ui/empty-state';
import { HoodGauge } from '@/components/ui/hood-gauge';
import { InlineError } from '@/components/ui/inline-error';
import { Kbd } from '@/components/ui/kbd';
import { OfflineState } from '@/components/ui/offline-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Stat } from '@/components/ui/stat';
import { SyntheticChip } from '@/components/ui/synthetic-chip';
import { TierTag } from '@/components/ui/tier-tag';
import { facts } from '@/lib/content/facts.generated';
import { maskIp } from '@/lib/privacy/mask-ip';

export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false },
};

const SWATCHES = [
  { name: 'ink-0', hex: '#0A0C0B', cls: 'bg-ink-0', use: 'Page background' },
  { name: 'ink-1', hex: '#101311', cls: 'bg-ink-1', use: 'Raised surface' },
  { name: 'ink-2', hex: '#171B19', cls: 'bg-ink-2', use: 'Elevated surface' },
  { name: 'ink-3', hex: '#202522', cls: 'bg-ink-3', use: 'Hover surface' },
  { name: 'bone', hex: '#E7EAE3', cls: 'bg-bone', use: 'Primary text' },
  { name: 'bone-2', hex: '#A4AAA1', cls: 'bg-bone-2', use: 'Secondary text' },
  { name: 'bone-3', hex: '#6E746C', cls: 'bg-bone-3', use: 'Tertiary, 18 px or larger' },
  { name: 'signal', hex: '#F3A33A', cls: 'bg-signal', use: 'The one accent' },
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-t border-line py-10">
      <h2 id={id} className="mb-6 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Development preview of the Phase 2 primitives. Not part of the product (FRONTEND_SPEC.md section 4 lists
 * no such route): it returns 404 in a production build unless NEXT_PUBLIC_DESIGN_PREVIEW=true.
 * The gate values below are demonstration parameters, not claims.
 */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DESIGN_PREVIEW !== 'true') {
    notFound();
  }
  const igdctf = facts['res.model.igdctf'];
  const advanced = facts['res.model.advanced'];
  const mcnemar = facts['res.mcnemar'];

  return (
    <main id="main" className="page-container py-16">
      <header className="mb-10 flex flex-col gap-4">
        <Logo />
        <h1 className="text-h2">Design system preview</h1>
        <p className="text-body measure text-bone-2">
          Development only. One accent, one radius system, one theme. Every number on this page that
          is a result is imported from the generated facts.
        </p>
      </header>

      <Section id="colour" title="Colour">
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {SWATCHES.map((s) => (
            <li key={s.name} className="flex flex-col gap-2">
              <div className={`${s.cls} h-16 rounded-input border border-line-strong`} />
              <div className="text-sm">
                <span className="text-bone">{s.name}</span>
                <span className="num ml-2 text-bone-2">{s.hex}</span>
              </div>
              <div className="text-xs text-bone-2">{s.use}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="type" title="Type">
        <div className="flex flex-col gap-4">
          <p className="text-display">Display, weight 600</p>
          <p className="text-h2">Heading two, weight 600</p>
          <p className="text-body measure">
            Body copy at 16 to 17 px with a line height of 1.6, never wider than 62 characters, set
            in Geist.
          </p>
          <p className="num text-sm text-bone-2">
            Numbers, identifiers and hashes: 0123456789 0.976 203.0.113.• a3f9c1
          </p>
        </div>
      </Section>

      <Section id="buttons" title="Buttons, badges and keys">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Open console</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link" arrow>
            Read the research
          </Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Badge>Neutral</Badge>
          <Badge tone="outline">Outline</Badge>
          <Badge tone="signal">Signal</Badge>
          <DemoTag />
          <DemoTag compact />
          <SyntheticChip />
          <span className="text-sm text-bone-2">
            Command palette: <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
          </span>
        </div>
      </Section>

      <Section id="stats" title="Stats with sources">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <Stat
            value={igdctf.value.f1.toFixed(3)}
            label="IG-DCTF F1"
            fact={igdctf}
            detail={<SyntheticChip />}
          />
          <Stat value={advanced.value.f1.toFixed(3)} label="CVE-only F1" fact={advanced} />
          <Stat
            value={`${mcnemar.value.igdctf_only_correct} vs ${mcnemar.value.advanced_only_correct}`}
            label="Discordant scenarios"
            fact={mcnemar}
          />
        </div>
      </Section>

      <Section id="tiers" title="Severity: shape, one amber ramp, and a label">
        <ul className="flex flex-wrap gap-x-10 gap-y-4">
          <li>
            <TierTag tier="high" />
          </li>
          <li>
            <TierTag tier="medium" />
          </li>
          <li>
            <TierTag tier="low" />
          </li>
          <li>
            <TierTag tier="low" gateTripped />
          </li>
          <li>
            <TierTag tier={null} />
          </li>
          <li>
            <TierTag tier="medium" demo />
          </li>
          <li>
            <TierTag tier="low" gateTripped demo />
          </li>
        </ul>
      </Section>

      <Section
        id="hood"
        title="The hood is a gauge: spread is the gate multiplier, the eye is the score"
      >
        <ul className="flex flex-wrap items-end gap-x-10 gap-y-6">
          {[
            { g: 1, t: 100 },
            { g: 0.65, t: 65 },
            { g: 0.3, t: 30 },
          ].map(({ g, t }) => (
            <li key={g} className="flex flex-col items-start gap-2">
              <HoodGauge gate={g} trust={t} size={128} />
              <span className="num text-sm text-bone-2">
                G {g.toFixed(2)}, score {t}
              </span>
            </li>
          ))}
          <li className="flex flex-col items-start gap-2">
            <div className="flex items-end gap-3">
              <HoodGauge size={16} />
              <HoodGauge size={24} />
              <HoodGauge size={40} />
              <HoodGauge size={64} />
            </div>
            <span className="num text-sm text-bone-2">16, 24, 40 and 64 px</span>
          </li>
        </ul>
      </Section>

      <Section id="states" title="Loading, empty, error, offline">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
          </div>
          <EmptyState title="No alerts yet">Run a scenario or send an event.</EmptyState>
          <InlineError
            title="Verdict not recorded"
            detail="Invalid or missing X-API-Key. Set X-API-Key: <your key> header when calling POST/write routes."
          />
          <OfflineState />
        </div>
      </Section>

      <Section id="privacy" title="IP masking">
        <p className="num text-sm text-bone-2">
          {maskIp('203.0.113.45')} &nbsp; {maskIp('2001:db8:abcd:12::1')} &nbsp;{' '}
          {maskIp('not an address')}
        </p>
      </Section>

      <Section id="code" title="Code block">
        <CodeBlock
          label="backend"
          code={'pip install -r backend/requirements.txt\npython backend/main.py'}
        />
      </Section>
    </main>
  );
}
