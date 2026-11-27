import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { manualFacts } from '@/lib/content/facts.manual';
import { evaluateGate, fuse, roundHalfEven, tierOf, GATE } from '@/lib/scoring/gate';

interface GoldenCase {
  t_cve: number;
  drift: number;
  freeze: boolean | null;
  quality: number;
  spec: boolean;
  liveness: number | null;
  s: number;
  multiplier: number;
  status: string;
  tripped: boolean;
  hard_cap: number | null;
  t_final: number;
}

interface Golden {
  cases: GoldenCase[];
}

const golden = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/gate_golden.json'), 'utf8'),
) as Golden;

describe('gate port against the Python implementation (FRONTEND_SPEC.md 14.4)', () => {
  it('uses the same thresholds as manualFacts and threshold edge cases in the fixture', () => {
    expect(GATE.theta_high).toBe(manualFacts['const.gate'].value.theta_high);
    expect(GATE.theta_low).toBe(manualFacts['const.gate'].value.theta_low);
    const atLow = golden.cases.find((c) => Math.abs(c.s - 0.5) < 1e-9);
    const belowLow = golden.cases.find((c) => Math.abs(c.s - 0.4999) < 1e-9);
    const atHigh = golden.cases.find((c) => Math.abs(c.s - 0.85) < 1e-9);
    expect(atLow?.status).toBe('tapered');
    expect(belowLow?.status).toBe('hard_gated');
    expect(atHigh?.status).toBe('nominal');
  });

  it('has a fixture with the edges, the half-integer rounding cases and the random vectors', () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(265);
  });

  it('matches every golden vector to 4 decimals, and the integer score and tier exactly', () => {
    const failures: string[] = [];
    for (const v of golden.cases) {
      const r = fuse({
        tCve: v.t_cve,
        drift: v.drift,
        freeze: v.freeze ?? false,
        qualityDrift: v.quality,
        specMismatch: v.spec,
        tier2: v.freeze !== null,
      });
      const tag = JSON.stringify({ t_cve: v.t_cve, drift: v.drift, freeze: v.freeze });
      if (
        r.liveness !== v.liveness &&
        Math.abs((r.liveness ?? -1) - (v.liveness ?? -1)) > 1e-4
      )
        failures.push(`liveness ${tag}`);
      if (Math.abs(r.signalIntegrity - v.s) > 1e-4)
        failures.push(`s ${tag}: ${r.signalIntegrity} vs ${v.s}`);
      if (Math.abs(r.gate.multiplier - v.multiplier) > 1e-4)
        failures.push(`G ${tag}: ${r.gate.multiplier} vs ${v.multiplier}`);
      if (r.gate.hardCap !== v.hard_cap) failures.push(`cap ${tag}`);
      if (r.gate.status !== v.status) failures.push(`status ${tag}`);
      if (r.gate.tripped !== v.tripped) failures.push(`tripped ${tag}`);
      if (r.final !== v.t_final) failures.push(`final ${tag}: ${r.final} vs ${v.t_final}`);
      if (r.tier !== tierOf(v.t_final)) failures.push(`tier ${tag}`);
    }
    expect(failures).toEqual([]);
  });

  it('rounds halves to the even neighbour like Python', () => {
    expect([0.5, 1.5, 2.5, 3.5, 4.5].map(roundHalfEven)).toEqual([0, 2, 2, 4, 4]);
    expect([0.4, 0.6, 2.51].map(roundHalfEven)).toEqual([0, 1, 3]);
  });

  it('reproduces the Tier 2 end-to-end table: genuine 100, every attack ends at 30', () => {
    const base = { tCve: 100, drift: 0, qualityDrift: 0, tier2: true };
    expect(fuse({ ...base, freeze: false, specMismatch: false }).final).toBe(100);
    expect(fuse({ ...base, freeze: true, specMismatch: false }).final).toBe(30);
    expect(fuse({ ...base, freeze: false, specMismatch: true }).final).toBe(30);
    expect(fuse({ ...base, freeze: false, specMismatch: false, qualityDrift: 1 }).final).toBe(30);
  });

  it('tapers a single banner-field change but never trips the gate (claim C9)', () => {
    // the largest single weight is firmware, 0.25, so s is at least 0.75
    const r = fuse({
      tCve: 100,
      drift: 0.25,
      freeze: false,
      qualityDrift: 0,
      specMismatch: false,
      tier2: false,
    });
    expect(r.gate.status).toBe('tapered');
    expect(r.gate.tripped).toBe(false);
  });

  it('is continuous at theta_high and theta_low, and never goes below the floor', () => {
    expect(evaluateGate(0.85).multiplier).toBe(1);
    expect(evaluateGate(0.8499).multiplier).toBeLessThan(1);
    expect(evaluateGate(0.5).multiplier).toBe(0.3);
    expect(evaluateGate(0.4999).multiplier).toBe(0.3);
    for (let s = 0; s <= 1; s += 0.01)
      expect(evaluateGate(s).multiplier).toBeGreaterThanOrEqual(0.3);
  });
});
