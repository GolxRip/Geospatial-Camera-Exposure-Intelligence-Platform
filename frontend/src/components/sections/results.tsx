import { Section } from '@/components/layout/section';
import { SourceNote } from '@/components/ui/source-note';
import { Stat } from '@/components/ui/stat';
import { SyntheticChip } from '@/components/ui/synthetic-chip';
import { facts } from '@/lib/content/facts.generated';
import { manualFacts } from '@/lib/content/facts.manual';
import { f1, f3, sci } from '@/lib/format';
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
 * "Results, with their limits" (FRONTEND_SPEC.md section 7.6): one large comparison, a supporting row of four figures, a
 * two-row small multiple, and the limits block as part of the section. Every figure is read from the generated facts.
 */
export function Results() {
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
        <div className="flex flex-col gap-2">
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
                      ? `. Accuracy ${f3(v.accuracy)}, 95% Wilson interval ${f3(v.accuracy_ci[0])} to ${f3(v.accuracy_ci[1])}.`
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
              label="Discordant scenarios, IG-DCTF vs CVE-only"
              fact={mc}
              detail={`Exact McNemar p = ${sci(mc.value.p_value)}`}
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
            <Stat value={tests.passed} label="Tests passed" detail={`Run on ${tests.date}`} />
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
