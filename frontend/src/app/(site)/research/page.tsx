import type { Metadata } from 'next';
import { DataTable } from '@/components/research/data-table';
import { Tex } from '@/components/research/tex';
import { LimitsList } from '@/components/sections/limits-list';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SourceNote } from '@/components/ui/source-note';
import { SyntheticChip } from '@/components/ui/synthetic-chip';
import { facts } from '@/lib/content/facts.generated';
import { manualFacts } from '@/lib/content/facts.manual';
import { loadRealTier2Results } from '@/lib/content/real-tier2';
import { f1, f2, f3, sci } from '@/lib/format';
import { repoFileUrl } from '@/lib/env';
import { GATE } from '@/lib/scoring/gate';

import 'katex/dist/katex.min.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Research' };

const SECTIONS = [
  { id: 'problem', title: 'The problem' },
  { id: 'channels', title: 'The two channels' },
  { id: 'gate', title: 'The gate' },
  { id: 'propositions', title: 'Propositions' },
  { id: 'results', title: 'Results' },
  { id: 'limits', title: 'Limits' },
  { id: 'ablation', title: 'Ablation and fusion control' },
  { id: 'sweep', title: 'Threshold sweep' },
  { id: 'benchmarks', title: 'Synthetic Tier 1 and Tier 2 benchmarks' },
  { id: 'overhead', title: 'Overhead' },
] as const;

const W = manualFacts['const.tier1.weights'].value;
const T2 = manualFacts['const.tier2.weights'].value;
const FR = manualFacts['const.tier2.freeze'].value;
const th = { lo: f2(GATE.theta_low), hi: f2(GATE.theta_high) };

function Section({
  id,
  title,
  children,
  extra,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h2 id={`${id}-title`} className="text-3xl font-semibold tracking-tight">
          {title}
        </h2>
        {extra}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-body measure text-bone-2">{children}</p>
);

const PROPOSITIONS = [
  {
    name: 'Non-compensation',
    text: (
      <>
        If <Tex tex={`s \\le \\theta_L`} /> then{' '}
        <Tex tex={`T_{\\mathrm{final}} \\le ${GATE.hard_cap}`} />, whatever the device attributes,
        so the event is low trust.
      </>
    ),
  },
  {
    name: 'The blind spot of Channel A scorers',
    text: (
      <>
        Two events with equal Channel A inputs get the same tier from any score that uses those
        inputs alone. If their labels differ, it errs on at least one. No refinement of the
        vulnerability weights removes the error; only an additional signal can.
      </>
    ),
  },
  {
    name: 'Single-field tolerance',
    text: (
      <>
        With Tier 2 clean, a change in any single banner field gives{' '}
        <Tex tex={`\\mathrm{Drift} \\le ${f2(maxOf(W))}`} />, hence{' '}
        <Tex tex={`s \\ge ${f2(1 - maxOf(W))}`} /> and a taper, never a trip. The hard region{' '}
        <Tex tex={`s < \\theta_L`} /> needs{' '}
        <Tex tex={`\\mathrm{Drift} > ${f2(1 - GATE.theta_low)}`} />, which takes at least three
        changed fields.
      </>
    ),
  },
  {
    name: 'Bounded sensitivity',
    text: (
      <>
        <Tex tex="G" /> is continuous and non-decreasing with Lipschitz constant{' '}
        <Tex
          tex={`0.7/(\\theta_H - \\theta_L) = ${f1(0.7 / (GATE.theta_high - GATE.theta_low))}`}
        />
        , so{' '}
        <Tex tex={`|\\Delta T_{\\mathrm{final}}| \\le 2\\, T_{\\mathrm{cve}}\\, |\\Delta s|`} />.
      </>
    ),
  },
  {
    name: 'Tier 2 reachability',
    text: (
      <>
        With the Tier 2 weights, <Tex tex={`\\mathrm{Drift}=0`} /> and{' '}
        <Tex tex={`T_{\\mathrm{cve}}=100`} />, one failure at full strength gives{' '}
        <Tex tex={`T_{\\mathrm{final}} = ${GATE.hard_cap}`} /> for a freeze, maximal blur or a
        resolution mismatch. In general a failure with weight <Tex tex="w" /> reaches low trust if
        and only if <Tex tex="w > 0.4" />.
      </>
    ),
  },
];

function maxOf(w: Record<string, number>): number {
  return Object.values(w).reduce((a, b) => (a > b ? a : b), 0);
}

export default function ResearchPage() {
  const realResults = loadRealTier2Results();

  const model = (
    k: 'res.model.wa' | 'res.model.advanced' | 'res.model.bayesian' | 'res.model.igdctf',
  ) => facts[k].value;
  const rows = [
    ['Weighted average', model('res.model.wa')],
    ['CVE-only', model('res.model.advanced')],
    ['Bayesian log-odds', model('res.model.bayesian')],
    ['IG-DCTF', model('res.model.igdctf')],
  ] as const;
  const ab = facts['res.ablation'].value;
  const sw = facts['res.sweep'].value;
  const t1 = facts['res.tier1'].value;
  const t2 = facts['res.tier2'].value;
  const e2e = facts['res.t2.end2end'].value;
  const oh = facts['res.overhead'].value;
  const mc = facts['res.mcnemar'].value;
  const strat = { b: facts['res.strat.with_b'].value, nb: facts['res.strat.without_b'].value };

  return (
    <main id="main" className="page-container pb-24 pt-24">
      <header className="mb-12 flex flex-col gap-6 md:mb-16">
        <h1 className="text-display">Research</h1>
        <P>
          The method in reading order. Real-footage Tier 2 runs from <code>eval/results/</code> and
          the older hand-authored synthetic corpus benchmark are kept strictly separate.
        </P>
        <a
          href={repoFileUrl('paper/main.tex')}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-chip text-bone underline underline-offset-4 transition-surface hover:text-signal"
        >
          Read the manuscript source (secondary)
        </a>
      </header>
      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="On this page" className="mb-12 lg:mb-0">
          <ol className="flex flex-wrap gap-x-5 gap-y-1 lg:sticky lg:top-24 lg:flex-col lg:gap-y-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="inline-flex min-h-8 items-center rounded-chip text-sm text-bone-2 transition-surface hover:text-bone"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-20">
          <Section id="problem" title="The problem">
            <P>
              A vulnerability score says how exposed a camera is. It cannot say whether the feed you
              are looking at is real. Two cameras with the same banner and the same CVE record get
              the same score, even when one of them shows a frozen loop.
            </P>
            <P>
              COBRA-WATCH adds a second channel for feed authenticity and lets it gate the first, so
              a compromised feed cannot be rescued by a clean vulnerability record.
            </P>
          </Section>

          <Section id="channels" title="The two channels">
            <P>
              <strong className="font-medium text-bone">Channel A</strong> is vulnerability posture:{' '}
              <Tex tex="T_{\mathrm{cve}}" /> from NVD and CISA KEV CVEs by category, authentication,
              owner type, firmware patch age, corroboration and latency. Tiers: high from{' '}
              {manualFacts['const.tiers'].value.high_min}, medium from{' '}
              {manualFacts['const.tiers'].value.medium_min}, low below.
            </P>
            <P>
              <strong className="font-medium text-bone">Channel B, Tier 1</strong> is passive banner
              drift: the device&apos;s current banner fingerprint against its baseline. No packet is
              sent to the device. Drift is a weighted sum over six fields, flagged above{' '}
              {f2(manualFacts['const.tier1.drift_threshold'].value)}.
            </P>
            <DataTable
              caption="Tier 1 drift weights"
              head={['Field', 'Weight']}
              rows={[
                ['Firmware', f2(W.firmware_version)],
                ['Server', f2(W.http_server)],
                ['Open ports (Jaccard)', f2(W.open_ports)],
                ['Resolution', f2(W.resolution)],
                ['Product string', f2(W.product_string)],
                ['Codec', f2(W.codec)],
              ]}
            />
            <P>
              <strong className="font-medium text-bone">Channel B, Tier 2</strong> is frame
              liveness, and runs only on authorized or public video: a perceptual-hash freeze check (
              {FR.consecutive_frames} or more frames within Hamming distance {FR.hamming_max}), blur
              and exposure drift against a per-camera moving average (alpha {FR.ewma_alpha}), and a
              declared-spec mismatch.
            </P>
            <Tex
              display
              label="Visual liveness"
              tex={`L = 1 - \\max\\bigl(${f1(T2.freeze)}\\,\\mathrm{Freeze},\; ${f1(T2.quality)}\\,q,\; ${f1(T2.spec)}\\,m\\bigr)`}
            />
            <P>
              The two tiers combine into one signal integrity value. Without Tier 2 it is simply one
              minus the drift.
            </P>
            <Tex display label="Signal integrity" tex={`s = (1 - \\mathrm{Drift})\\cdot L`} />
          </Section>

          <Section id="gate" title="The gate">
            <P>
              The gate turns signal integrity into a multiplier on the vulnerability score. The
              thresholds are {th.lo} and {th.hi}; the floor is {f1(GATE.floor_multiplier)}. Below
              the lower threshold the score is also capped at {GATE.hard_cap}.
            </P>
            <Tex
              display
              label="The gate and the final score"
              tex={`G(s)=\\begin{cases} 1 & s \\ge ${th.hi} \\\\ ${f1(GATE.floor_multiplier)} + 0.7\\,\\dfrac{s-${th.lo}}{${th.hi}-${th.lo}} & ${th.lo} \\le s < ${th.hi} \\\\ ${f1(GATE.floor_multiplier)} & s < ${th.lo} \\end{cases} \\qquad T_{\\mathrm{final}} = T_{\\mathrm{cve}}\\, G(s)`}
            />
            <P>
              The same function runs in your browser in the{' '}
              <a className="text-bone underline underline-offset-4" href="/lab">
                lab
              </a>
              , checked against the Python implementation on 748 vectors.
            </P>
          </Section>

          <Section id="propositions" title="Propositions">
            <P>Five properties follow from the equations. Proofs are in the manuscript.</P>
            <ol className="flex flex-col gap-8">
              {PROPOSITIONS.map((p, i) => (
                <li key={p.name} className="flex flex-col gap-2">
                  <h3 className="text-xl font-semibold tracking-tight">
                    <span className="num mr-3 text-sm text-bone-2">{i + 1}</span>
                    {p.name}
                  </h3>
                  <p className="text-body measure text-bone-2">{p.text}</p>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="results" title="Results">
            <div className="flex flex-col gap-6 rounded-panel border border-line bg-ink-1 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold tracking-tight">
                  Real Tier 2 evaluation (public video)
                </h3>
                <Badge tone={realResults.available ? 'signal' : 'neutral'}>
                  {realResults.available ? 'Real footage results' : 'Awaiting eval/results/'}
                </Badge>
              </div>
              {realResults.available ? (
                <div className="flex flex-col gap-10">
                  {realResults.comparisons.map((comp) => {
                    const base = comp.baseline;
                    const v2 = comp.v2;
                    const primary = v2 ?? base;
                    const allAttacks = primary?.attackOrder ?? base?.attackOrder ?? [];
                    const formatAttackCell = (
                      run: typeof base,
                      level: 'degraded' | 'tripped',
                      atk: string,
                    ) => {
                      const row = run?.levels[level].attacks[atk];
                      if (!row) return 'Pending run';
                      return `${row.hits}/${row.total} (${row.ratePct.toFixed(1)}%) [${row.ciLowPct.toFixed(1)}, ${row.ciHighPct.toFixed(1)}]%`;
                    };
                    const formatDelayCell = (
                      run: typeof base,
                      level: 'degraded' | 'tripped',
                      atk: string,
                    ) => {
                      const row = run?.levels[level].attacks[atk];
                      if (!row) return 'Pending';
                      return row.medianDelayS === 'n/a' ? 'n/a' : `${row.medianDelayS} s`;
                    };
                    const formatCleanCell = (run: typeof base, level: 'degraded' | 'tripped') => {
                      const cl = run?.levels[level].clean;
                      if (!cl) return 'Pending run';
                      return `${cl.faPerHour.toFixed(1)}/h [95% CI ${cl.ciLow.toFixed(1)}, ${cl.ciHigh.toFixed(1)}] (${cl.falseAlarms} FA over ${cl.hours.toFixed(3)} h; ${cl.videos} evaluated, ${cl.dropNote})`;
                    };

                    return (
                      <div
                        key={comp.splitKey}
                        className="flex flex-col gap-5 border-t border-line pt-6 first:border-t-0 first:pt-0"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h4 className="text-lg font-semibold tracking-tight text-bone">
                            {comp.splitTitle}
                          </h4>
                          <Badge tone={comp.roleKindLabel === 'held-out' ? 'signal' : 'neutral'}>
                            {comp.roleKindLabel}
                          </Badge>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-control border border-line bg-ink-0 p-4 text-xs">
                            <p className="font-medium text-bone">
                              Baseline (v1): {base ? base.roleLabel : 'Not saved yet'}
                            </p>
                            {base ? (
                              <div className="mt-2 flex flex-col gap-1 text-bone-2">
                                <p>
                                  Date: <span className="num text-bone">{base.date}</span>
                                </p>
                                <p>
                                  Clips:{' '}
                                  <span className="num text-bone">
                                    {base.evaluatedVideos ?? '?'} evaluated
                                  </span>{' '}
                                  ({base.dropNote}), clean window{' '}
                                  <span className="num text-bone">
                                    {base.levels.tripped.clean?.hours.toFixed(3) ?? '?'} h
                                  </span>
                                </p>
                                <p className="break-all font-mono">
                                  {base.command ?? 'eval/tier2_real_footage.py'}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-2 text-bone-2">
                                Run v1 baseline into eval/results/ to populate.
                              </p>
                            )}
                          </div>

                          <div className="rounded-control border border-line bg-ink-0 p-4 text-xs">
                            <p className="font-medium text-bone">
                              Frozen detector (v2): {v2 ? v2.roleLabel : comp.roleKindLabel}
                            </p>
                            {v2 ? (
                              <div className="mt-2 flex flex-col gap-1 text-bone-2">
                                <p>
                                  Date: <span className="num text-bone">{v2.date}</span>
                                </p>
                                <p>
                                  Clips:{' '}
                                  <span className="num text-bone">
                                    {v2.evaluatedVideos ?? '?'} evaluated
                                  </span>{' '}
                                  ({v2.dropNote}), clean window{' '}
                                  <span className="num text-bone">
                                    {v2.levels.tripped.clean?.hours.toFixed(3) ?? '?'} h
                                  </span>
                                </p>
                                <p className="break-all font-mono">
                                  {v2.command ?? 'eval/tier2_real_footage.py'}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-2 text-bone-2">
                                Pending push from Kali for this split ({comp.roleKindLabel}).
                              </p>
                            )}
                          </div>
                        </div>

                        {(['tripped', 'degraded'] as const).map((lvl) => (
                          <DataTable
                            key={lvl}
                            caption={`${comp.splitTitle}: side-by-side comparison at alarm level ${lvl} (95% Wilson CIs for detection; exact 95% Poisson CI for clean FA/h)`}
                            head={[
                              'Attack / Metric',
                              'Baseline v1 (rate, 95% CI)',
                              'v1 delay',
                              'v2 (rate, 95% CI)',
                              'v2 delay',
                            ]}
                            rows={[
                              ...allAttacks.map((atk) => [
                                atk,
                                formatAttackCell(base, lvl, atk),
                                formatDelayCell(base, lvl, atk),
                                formatAttackCell(v2, lvl, atk),
                                formatDelayCell(v2, lvl, atk),
                              ]),
                              [
                                'Clean false alarms / hour',
                                formatCleanCell(base, lvl),
                                'n/a',
                                formatCleanCell(v2, lvl),
                                'n/a',
                              ],
                            ]}
                          />
                        ))}

                        {[base, v2]
                          .filter((r): r is NonNullable<typeof r> => r !== null)
                          .map((run) => {
                            const perCsv = run.csvTables.find((t) => t.filename === 'per_run.csv');
                            if (!perCsv) return null;
                            return (
                              <details
                                key={`${run.id}-per-run`}
                                className="rounded-control border border-line bg-ink-0 p-3"
                              >
                                <summary className="cursor-pointer text-sm text-bone-2 hover:text-bone">
                                  {`Per-video breakdown (${run.version}): ${perCsv.filename} (${perCsv.rows.length} rows)`}
                                </summary>
                                <div className="mt-4">
                                  <DataTable
                                    caption={`${perCsv.filename} (${run.dataset}, ${run.date})`}
                                    head={perCsv.headers}
                                    rows={perCsv.rows}
                                  />
                                </div>
                              </details>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="No real Tier 2 runs saved yet">
                  Run <code>python eval/tier2_real_footage.py</code> on public video to write CSV
                  metrics and <code>summary.md</code> into <code>eval/results/</code>. Synthetic
                  clips are never included here.
                </EmptyState>
              )}
            </div>

            <div className="flex flex-col gap-6 pt-4">
              <div className="flex flex-wrap items-center gap-4">
                <h3 className="text-xl font-semibold tracking-tight">
                  Synthetic benchmark corpus (hand-authored formula check)
                </h3>
                <SyntheticChip />
              </div>
              <P>
                Four scoring models on {facts['res.corpus'].value.n_direct} synthetic scenarios:{' '}
                {facts['res.corpus'].value.n_fabricated} fabricated feeds and{' '}
                {facts['res.corpus'].value.n_genuine} genuine ones. Fabricated is the positive
                class.
                <SourceNote fact={facts['res.model.igdctf']} />
              </P>
              <DataTable
                caption="Four-model comparison (synthetic corpus)"
                emphasisRow={3}
                head={['Model', 'Accuracy', 'Recall', 'F1', 'FP']}
                rows={rows.map(([name, m]) => [
                  name,
                  f3(m.accuracy),
                  f3(m.recall),
                  f3(m.f1),
                  String(m.fp),
                ])}
              />
              <P>
                Exact McNemar test, IG-DCTF against CVE-only: {mc.igdctf_only_correct} against{' '}
                {mc.advanced_only_correct} discordant scenarios, p = {sci(mc.p_value)}. The 95%
                Wilson interval for IG-DCTF accuracy is {f3(model('res.model.igdctf').accuracy_ci[0])}{' '}
                to {f3(model('res.model.igdctf').accuracy_ci[1])}.
              </P>
              <DataTable
                caption="Accuracy by presence of Channel B fields (synthetic corpus)"
                head={['Subset', 'Weighted avg', 'CVE-only', 'Bayesian', 'IG-DCTF']}
                rows={[
                  [
                    `With Channel B, n = ${strat.b.n}`,
                    f3(strat.b.accuracy.wa),
                    f3(strat.b.accuracy.advanced),
                    f3(strat.b.accuracy.bayesian),
                    f3(strat.b.accuracy.igdctf),
                  ],
                  [
                    `Without Channel B, n = ${strat.nb.n}`,
                    f3(strat.nb.accuracy.wa),
                    f3(strat.nb.accuracy.advanced),
                    f3(strat.nb.accuracy.bayesian),
                    f3(strat.nb.accuracy.igdctf),
                  ],
                ]}
              />
            </div>
          </Section>

          <Section id="limits" title="Limits">
            <P>
              These belong to the synthetic results above and are part of them. Claim ids refer to
              the claim ledger in the repository.
            </P>
            <LimitsList />
            <div className="mt-4 flex flex-col gap-3 rounded-panel border border-line bg-ink-1 p-6">
              <h3 className="text-xl font-semibold tracking-tight">
                Why synthetic and simulated data are used instead of live camera feeds
              </h3>
              <ul className="flex flex-col gap-2 text-sm text-bone-2">
                <li>
                  <strong className="font-medium text-bone">
                    No unauthorized live video streams:
                  </strong>{' '}
                  Pulling RTSP or HTTP video from internet-discovered cameras without authorization
                  violates India&apos;s Information Technology Act, 2000 (sections 43 and 66) and
                  DPDP Act, 2023 minimization principles. Tier 2 therefore evaluates on real public
                  benchmark clips (CUHK Avenue) with reproducible tamper transforms applied at known
                  onset frames so false alarms and delay have verifiable ground truth.
                </li>
                <li>
                  <strong className="font-medium text-bone">
                    No live target list in the interactive console:
                  </strong>{' '}
                  Censys exposure data is kept strictly as anonymized country-level aggregates
                  (104,218 India hosts in data/censys, zero IP addresses). The /console database uses
                  /24-masked simulated device fixtures (geo_source = synthetic_demo) so the UI can
                  demonstrate scoring and Merkle auditing without publishing vulnerable live hosts.
                </li>
                <li>
                  <strong className="font-medium text-bone">
                    Controlled counterfactual gate verification:
                  </strong>{' '}
                  Open historical banner-drift datasets with verified device-compromise ground truth
                  do not exist. The 120-scenario synthetic corpus isolates fusion arithmetic
                  (IG-DCTF vs baseline scorers) under controlled conditions and stays separated
                  under Synthetic corpus chips.
                </li>
              </ul>
            </div>
          </Section>

          <Section id="ablation" title="Ablation and fusion control" extra={<SyntheticChip />}>
            <DataTable
              caption="Which part carries the result (synthetic corpus)"
              emphasisRow={3}
              head={['Configuration', 'F1', 'Missed attacks']}
              rows={[
                ['Channel A only', f3(ab.channel_a_only.f1), String(ab.channel_a_only.fn)],
                ['Channel B only', f3(ab.channel_b_only.f1), String(ab.channel_b_only.fn)],
                ['Additive fusion', f3(ab.additive.f1), String(ab.additive.fn)],
                [
                  'Multiplicative fusion (IG-DCTF)',
                  f3(ab.multiplicative.f1),
                  String(ab.multiplicative.fn),
                ],
              ]}
            />
            <P>
              The additive control is one choice of control, not the only one.
              <SourceNote fact={facts['res.ablation']} />
            </P>
          </Section>

          <Section id="sweep" title="Threshold sweep" extra={<SyntheticChip />}>
            <P>
              F1 is {f3(sw.best_f1)} at all {sw.within_0_01_of_best} of {sw.total} grid points
              tried, so within 0.01 of the best everywhere. That means the corpus cannot select the
              thresholds. They are design choices.
              <SourceNote fact={facts['res.sweep']} />
            </P>
          </Section>

          <Section
            id="benchmarks"
            title="Synthetic Tier 1 and Tier 2 benchmarks"
            extra={<SyntheticChip />}
          >
            <P>
              Tier 1 ran on {t1.n} synthetic cases with {t1.fp} false positives and {t1.fn} false
              negatives, at {t1.ms_per_device.toFixed(4)} ms per device. Those cases contain only{' '}
              <strong className="font-medium text-bone">{t1.distinct_cases} distinct</strong> banner
              mutations, which is why this is weak evidence.
              <SourceNote fact={facts['res.tier1']} />
            </P>
            <DataTable
              caption="Tier 1 by category (synthetic)"
              head={['Category', 'Cases', 'Drift', 'Detected']}
              rows={Object.entries(t1.categories).map(([k, v]) => [
                k.replace(/_/g, ' '),
                String(v.n),
                f2(v.drift),
                String(v.detected),
              ])}
            />
            <P>
              Tier 2 ran on {t2.n} synthetic frame sequences with {t2.fp} false positives and{' '}
              {t2.fn} false negatives. Mean detection latency was {f1(t2.mean_latency_frames)}{' '}
              frames. Frames are synthetic, and the weights were revised after seeing this
              benchmark (logged as tuned after seeing data).
              <SourceNote fact={facts['res.tier2']} />
            </P>
            <DataTable
              caption="End to end, Channel A score 100 and drift 0 (synthetic)"
              head={['Category', 'n', 'Mean T_final']}
              rows={[
                ['Genuine live', String(e2e.genuine_live.n), f1(e2e.genuine_live.mean_t_final)],
                [
                  'Freeze or loop',
                  String(e2e.freeze_loop_attack.n),
                  f1(e2e.freeze_loop_attack.mean_t_final),
                ],
                [
                  'Quality drift, blur',
                  String(e2e.quality_drift_blur.n),
                  f1(e2e.quality_drift_blur.mean_t_final),
                ],
                [
                  'Spec mismatch',
                  String(e2e.spec_mismatch_mitm.n),
                  f1(e2e.spec_mismatch_mitm.mean_t_final),
                ],
              ]}
            />
          </Section>

          <Section id="overhead" title="Overhead" extra={<SyntheticChip />}>
            <P>
              Cost per event, in-process Python with no I/O: {f1(oh.channel_a_only_us)} us with
              Channel A only, {f1(oh.igdctf_us)} us for the full IG-DCTF.
              <SourceNote fact={facts['res.overhead']} />
            </P>
          </Section>
        </div>
      </div>
    </main>
  );
}
