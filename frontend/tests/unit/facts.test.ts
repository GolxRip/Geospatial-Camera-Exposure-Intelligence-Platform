import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCE_SHA256, facts } from '@/lib/content/facts.generated';
import { manualFacts } from '@/lib/content/facts.manual';

const RESULTS_JSON = resolve(__dirname, '../../../paper/data/results.json');
const r3 = (n: number) => Math.round(n * 1000) / 1000;

describe('generated facts', () => {
  it('are generated from the current paper/data/results.json (content hash, not mtime)', () => {
    const sha = createHash('sha256').update(readFileSync(RESULTS_JSON, 'utf8')).digest('hex');
    expect(SOURCE_SHA256).toBe(sha);
  });

  it('every fact names its source and its results.md section', () => {
    for (const [key, fact] of Object.entries(facts)) {
      expect(fact.source, key).toMatch(/^paper\/data\/results\.json#/);
      expect(fact.section.length, key).toBeGreaterThan(0);
    }
  });

  // These are the numbers FRONTEND_SPEC.md section 3.2 quotes. If results.json moves, the spec table is stale.
  // Known discrepancy: the spec and README print the weighted-average F1 as 0.753, but results.json holds
  // 0.75248, which is 0.752 at three decimals (0.753 is a double rounding of results.md's 0.7525). The site
  // renders from the facts, so it shows 0.752; this test pins the true value.
  it('match the spec truth sheet (section 3.2), except the weighted-average F1 rounding', () => {
    const m = (k: 'wa' | 'advanced' | 'bayesian' | 'igdctf') => facts[`res.model.${k}`].value;
    expect([r3(m('wa').accuracy), r3(m('wa').recall), r3(m('wa').f1), m('wa').fp]).toEqual([
      0.792, 0.603, 0.752, 0,
    ]);
    expect([
      r3(m('advanced').accuracy),
      r3(m('advanced').recall),
      r3(m('advanced').f1),
      m('advanced').fp,
    ]).toEqual([0.833, 0.683, 0.811, 0]);
    expect([
      r3(m('bayesian').accuracy),
      r3(m('bayesian').recall),
      r3(m('bayesian').f1),
      m('bayesian').fp,
    ]).toEqual([0.842, 0.746, 0.832, 3]);
    expect([
      r3(m('igdctf').accuracy),
      r3(m('igdctf').recall),
      r3(m('igdctf').f1),
      m('igdctf').fp,
    ]).toEqual([0.975, 0.952, 0.976, 0]);
    expect(m('igdctf').accuracy_ci.map(r3)).toEqual([0.929, 0.991]);

    const mc = facts['res.mcnemar'].value;
    expect([mc.igdctf_only_correct, mc.advanced_only_correct]).toEqual([17, 0]);
    expect(mc.p_value).toBeCloseTo(1.53e-5, 7);

    const w = facts['res.strat.with_b'].value;
    expect(w.n).toBe(30);
    expect(
      [w.accuracy.wa, w.accuracy.advanced, w.accuracy.bayesian, w.accuracy.igdctf].map(r3),
    ).toEqual([0.433, 0.433, 0.467, 1]);
    const wo = facts['res.strat.without_b'].value;
    expect(wo.n).toBe(90);
    expect(
      [wo.accuracy.wa, wo.accuracy.advanced, wo.accuracy.bayesian, wo.accuracy.igdctf].map(r3),
    ).toEqual([0.911, 0.967, 0.967, 0.967]);

    const a = facts['res.ablation'].value;
    expect(
      [a.channel_a_only, a.channel_b_only, a.additive, a.multiplicative].map((v) => r3(v.f1)),
    ).toEqual([0.811, 0.444, 0.914, 0.976]);
    expect(
      [a.channel_a_only, a.channel_b_only, a.additive, a.multiplicative].map((v) => v.fn),
    ).toEqual([20, 45, 10, 3]);

    const sw = facts['res.sweep'].value;
    expect([r3(sw.best_f1), sw.within_0_01_of_best, sw.total]).toEqual([0.976, 42, 42]);

    const t1 = facts['res.tier1'].value;
    expect([t1.n, t1.fp, t1.fn, t1.distinct_cases]).toEqual([100, 0, 0, 13]);
    expect(t1.ms_per_device).toBeCloseTo(0.0038, 4);
    const t2 = facts['res.tier2'].value;
    expect([t2.n, t2.fp, t2.fn, t2.mean_latency_frames]).toEqual([80, 0, 0, 9.6]);

    const e = facts['res.t2.end2end'].value;
    expect([
      e.genuine_live.mean_t_final,
      e.freeze_loop_attack.mean_t_final,
      e.quality_drift_blur.mean_t_final,
      e.spec_mismatch_mitm.mean_t_final,
    ]).toEqual([100, 30, 30, 30]);

    const o = facts['res.overhead'].value;
    expect([
      Math.round(o.channel_a_only_us * 100) / 100,
      Math.round(o.igdctf_us * 100) / 100,
    ]).toEqual([2.6, 4.69]);

    const c = facts['res.corpus'].value;
    expect([c.n_direct, c.n_fabricated, c.n_genuine, c.n_with_signal_fields]).toEqual([
      120, 63, 57, 30,
    ]);
  });
});

describe('manual facts', () => {
  it('every entry has a non-empty source', () => {
    for (const [key, fact] of Object.entries(manualFacts)) {
      expect(fact.source.trim().length, key).toBeGreaterThan(0);
    }
  });
});
