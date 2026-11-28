import Link from 'next/link';
import { Section } from '@/components/layout/section';
import { Badge } from '@/components/ui/badge';
import { SourceNote } from '@/components/ui/source-note';
import { Stat } from '@/components/ui/stat';
import { SyntheticChip } from '@/components/ui/synthetic-chip';
import { facts } from '@/lib/content/facts.generated';
import { manualFacts } from '@/lib/content/facts.manual';
import { loadRealTier2Results } from '@/lib/content/real-tier2';
import { ROUTES } from '@/lib/constants/routes';
import { f1, f3 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LimitsList } from './limits-list';

const MODELS = [
  { name: 'Weighted average', fact: facts['res.model.wa'], hero: false },
  { name: 'CVE-only', fact: facts['res.model.advanced'], hero: false },
  { name: 'Bayesian', fact: facts['res.model.bayesian'], hero: false },
  { name: 'IG-DCTF', fact: facts['res.model.igdctf'], hero: true },
] as const;

/** Horizontal bar with no background track: width is the value itself. */
function Bar({ value, hero }: { value: number; hero?: boolean }) {
  return (
    <div className="h-3 w-full">
      <div
        className={cn('h-full rounded-chip', hero ? 'bg-signal' : 'bg-bone-2')}
        style={{ width: `${(value * 100).toFixed(2)}%` }}
      />
    </div>
  );
}

function Pair({ label, a, b }: { label: string; a: number; b: number }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-bone-2">{label}</p>
      {[
        ['CVE-only', a, false],
        ['IG-DCTF', b, true],
      ].map(([name, v, hero]) => (
        <div key={String(name)} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3">
          <span className="text-sm">{String(name)}</span>
          <Bar value={Number(v)} hero={Boolean(hero)} />
          <span className="num text-right text-sm">{f3(Number(v))}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Results section on home: keeps real Tier 2 public-video runs strictly separate from the synthetic 120-scenario corpus.
 * Note: JSX text intentionally avoids literal multi-digit numbers or decimals (verified by tests/facts.test.ts).
 */
export function Results() {
  const realResults = loadRealTier2Results();
  const ig = facts['res.model.igdctf'].value;
  const mc = facts['res.mcnemar'];
  const ab = facts['res.ablation'].value;
  const oh = facts['res.overhead'];
  const withB = facts['res.strat.with_b'];
  const withoutB = facts['res.strat.without_b'];
  const tests = manualFacts['eval.tests'].value;

  return (
    <Section id="results" title="Results, with their limits" headerExtra={<SyntheticChip />}>
      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-4 rounded-panel border border-line bg-ink-1 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold tracking-tight">Real Tier 2 video evaluation</h3>
            <Badge tone={realResults.available ? 'signal' : 'neutral'}>
              {realResults.available ? 'Real footage' : 'Pending run'}
            </Badge>
          </div>
          {realResults.available ? (
            <ul className="flex flex-col gap-4">
              {realResults.runs.map((run) => {
                const cl = run.levels.tripped.clean;
                return (
                  <li key={run.id} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-bone">
                        {run.dataset} ({run.date})
                      </p>
                      <Badge tone={run.roleLabel.startsWith('held-out') ? 'signal' : 'neutral'}>
                        {run.roleLabel}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-bone-2">
                      {cl
                        ? `${cl.videos} evaluated (${cl.dropNote}) | Clean FA: ${cl.faPerHour.toFixed(1)}/h [95% CI ${cl.ciLow.toFixed(1)}, ${cl.ciHigh.toFixed(1)}] (${cl.falseAlarms} over ${cl.hours.toFixed(3)} clean h)`
                        : run.dropNote}
                    </p>
                    <p className="mt-1 font-mono text-xs text-bone-2">
                      {run.command ?? 'eval/tier2_real_footage.py'}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-bone-2">
              No real-footage evaluation has been saved in eval/results/ yet. Synthetic benchmark
              metrics below are separate.
            </p>
          )}
          <Link
            href={`${ROUTES.research}#results`}
            className="self-start rounded-chip text-sm text-bone underline underline-offset-4 transition-surface hover:text-signal"
          >
            Inspect full results on Research page
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-semibold tracking-tight">Synthetic benchmark comparison</h3>
          <p className="text-sm text-bone-2">
            F1 on the synthetic corpus, positive class fabricated
            <SourceNote fact={facts['res.model.igdctf']} />
          </p>
          <ul aria-label="F1 by model" className="mt-4 flex flex-col gap-7">
            {MODELS.map(({ name, fact, hero }) => {
              const v = fact.value;
              return (
                <li
                  key={name}
                  className="grid gap-x-6 gap-y-2 md:grid-cols-[9rem_1fr_4.5rem] md:items-center"
                >
                  <span className={cn('text-base', hero ? 'font-medium text-bone' : 'text-bone-2')}>
                    {name}
                  </span>
                  <Bar value={v.f1} hero={hero} />
                  <span className="num text-xl md:text-right">{f3(v.f1)}</span>
                  <span className="num text-xs text-bone-2 md:col-start-2 md:col-end-4">
                    TP {v.tp}, FP {v.fp}, TN {v.tn}, FN {v.fn}
                    {hero
                      ? `. Accuracy ${f3(v.accuracy)}, Wilson interval ${f3(v.accuracy_ci[0])} to ${f3(v.accuracy_ci[1])}.`
                      : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <ul
          aria-label="Supporting figures"
          className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4"
        >
          <li>
            <Stat
              value={`${mc.value.igdctf_only_correct} vs ${mc.value.advanced_only_correct}`}
              label="Channel-B scenario gap, IG-DCTF vs CVE-only"
              fact={mc}
              detail="Formula check only (not real-world significance)"
            />
          </li>
          <li>
            <Stat
              value={`${ab.multiplicative.fn} vs ${ab.additive.fn}`}
              label="Missed attacks, multiplicative vs additive fusion"
              fact={facts['res.ablation']}
            />
          </li>
          <li>
            <Stat
              value={`${f1(oh.value.igdctf_us)} us`}
              label="Per event, full IG-DCTF"
              fact={oh}
              detail={`${f1(oh.value.channel_a_only_us)} us with Channel A only. In-process Python, no I/O.`}
            />
          </li>
          <li>
            <Stat
              value={tests.passed}
              label="Python tests passed"
              detail={`Run ${tests.date} (${tests.backend_passed} backend, ${tests.video_pipeline_passed} video, ${tests.eval_passed} eval); ${tests.frontend_tests} Vitest across ${tests.frontend_suites} suites, run ${tests.frontend_date}`}
            />
          </li>
        </ul>

        <div className="flex flex-col gap-6">
          <h3 className="text-xl font-semibold tracking-tight">
            Where it helps, and where it does not
            <SourceNote fact={withB} />
          </h3>
          <div className="grid gap-10 md:grid-cols-2">
            <Pair
              label={`With Channel B fields, n = ${withB.value.n}: accuracy`}
              a={withB.value.accuracy.advanced}
              b={withB.value.accuracy.igdctf}
            />
            <Pair
              label={`Without Channel B fields, n = ${withoutB.value.n}: accuracy`}
              a={withoutB.value.accuracy.advanced}
              b={withoutB.value.accuracy.igdctf}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-xl font-semibold tracking-tight">Limits</h3>
          <LimitsList />
          <p className="text-sm text-bone-2">
            IG-DCTF recall is {f3(ig.recall)} with {ig.fp} false positives on{' '}
            {facts['res.corpus'].value.n_direct} scenarios.
          </p>
        </div>
      </div>
    </Section>
  );
}
