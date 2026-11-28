import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FACT_KEYS, fact, fmt3 } from '@/lib/content/facts';
import { SOURCE_SHA256, facts } from '@/lib/content/facts.generated';
import { manualFacts } from '@/lib/content/facts.manual';

const RESULTS_JSON = resolve(__dirname, '../../../paper/data/results.json');
const r3 = (n: number) => Math.round(n * 1000) / 1000;

describe('generated facts', () => {
  it('are generated from the current paper/data/results.json (content hash, not mtime)', () => {
    const raw = readFileSync(RESULTS_JSON, 'utf8').replace(/\r\n/g, '\n');
    const sha = createHash('sha256').update(raw).digest('hex');
    expect(SOURCE_SHA256).toBe(sha);
  });

  it('every fact names its source and its results.md section', () => {
    for (const [key, fact] of Object.entries(facts)) {
      expect(fact.source, key).toMatch(/^paper\/data\/results\.json#/);
      expect(fact.section.length, key).toBeGreaterThan(0);
    }
  });

  // These are the numbers FRONTEND_SPEC.md section 3.2 quotes. If results.json moves, the spec table is stale.
  // The weighted-average F1 is 0.75248 in results.json, which is 0.752 at three decimals. The spec, main.tex and
  // CLAIMS.md printed 0.753 (a double rounding of results.md's 0.7525) until 2026-11-28; this test pins the true value.
  it('match the spec truth sheet (section 3.2)', () => {
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

  it('tracks consistent Python, Vitest, and golden-vector test totals in eval.tests', () => {
    const t = manualFacts['eval.tests'].value;
    expect(t.backend_passed + t.video_pipeline_passed + t.eval_passed).toBe(t.passed);
    expect(t.passed + t.skipped).toBe(t.python_collected);
    expect(t.frontend_suites).toBe(10);
    expect(t.frontend_tests).toBe(76);
    expect(t.frontend_unit_suites).toBe(7);
    expect(t.frontend_unit_tests).toBe(46);
    expect(t.golden_vectors).toBe(265);
  });
});

// Merged from the former tests/facts.test.ts (its hash and source checks duplicated the ones above).
describe('facts on the site', () => {
  it('covers every key listed in spec 3.2', () => {
    for (const key of [
      'res.model.wa', 'res.model.advanced', 'res.model.bayesian', 'res.model.igdctf', 'res.mcnemar',
      'res.strat.with_b', 'res.strat.without_b', 'res.ablation', 'res.sweep', 'res.tier1', 'res.tier2',
      'res.t2.end2end', 'res.overhead', 'eval.tests',
    ]) {
      expect(FACT_KEYS, key).toContain(key);
    }
  });

  it('matches the numbers printed in paper/results.md (4 decimals there, 3 decimals on the site)', () => {
    const wa = fact('res.model.wa');
    const adv = fact('res.model.advanced');
    const bay = fact('res.model.bayesian');
    const ig = fact('res.model.igdctf');
    // results.md section 1: WA F1 0.7525, Advanced 0.8113, Bayesian 0.8319, IG-DCTF 0.9756
    expect(wa.f1.toFixed(4)).toBe('0.7525');
    expect(adv.f1.toFixed(4)).toBe('0.8113');
    expect(bay.f1.toFixed(4)).toBe('0.8319');
    expect(ig.f1.toFixed(4)).toBe('0.9756');
    // Rounded once from the stored value: WA F1 is 0.752, not 0.753 (0.7525 rounded twice).
    expect([wa, adv, bay, ig].map((m) => fmt3(m.f1))).toEqual(['0.752', '0.811', '0.832', '0.976']);
    expect([ig.tp, ig.fp, ig.tn, ig.fn]).toEqual([60, 0, 57, 3]);
    expect(fact('res.corpus')).toEqual({ n_direct: 120, n_fabricated: 63, n_genuine: 57, n_with_signal_fields: 30 });
    expect(fact('res.mcnemar').igdctf_only_correct).toBe(17);
    expect(fact('res.tier1').distinct_cases).toBe(13);
    expect(fact('res.overhead').igdctf_us.toFixed(2)).toBe('4.69');
  });

  it('renders no hard-coded digits in section components', () => {
    // Heuristic for ground rule 1: JSX text between tags must not contain decimals or multi-digit numbers
    // (result figures). Single-digit method constants such as "G(s) = 1" are allowed.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.tsx')) {
          const text = readFileSync(p, 'utf8');
          for (const m of text.matchAll(/>([^<>{}]*(?:\d+\.\d+|\d{2,})[^<>{}]*)</g)) offenders.push(`${p}: ${m[1]?.trim()}`);
        }
      }
    };
    walk(resolve(__dirname, '../../src/components/sections'));
    expect(offenders).toEqual([]);
  });
});
