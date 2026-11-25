import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateGate, fuse, roundHalfEven, GATE } from '@/lib/scoring/gate';

interface Golden {
  theta_high: number;
  theta_low: number;
  vectors: {
    in: {
      t_cve: number;
      drift: number;
      freeze: boolean;
      quality: number;
      spec: boolean;
      tier2: boolean;
    };
    out: {
      liveness: number | null;
      signal_integrity: number;
      multiplier: number;
      hard_cap: number | null;
      gate_status: string;
      gate_tripped: boolean;
      final: number;
      tier: string;
    };
  }[];
}

const golden = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/gate_golden.json'), 'utf8'),
) as Golden;

describe('gate port against the Python implementation (FRONTEND_SPEC.md 14.4)', () => {
  it('uses the same thresholds as the exported fixture', () => {
    expect(GATE.theta_high).toBe(golden.theta_high);
    expect(GATE.theta_low).toBe(golden.theta_low);
  });

  it('has a fixture with the edges, the half-integer rounding cases and the random vectors', () => {
    expect(golden.vectors.length).toBeGreaterThanOrEqual(700);
  });

  it('matches every golden vector to 4 decimals, and the integer score and tier exactly', () => {
    const failures: string[] = [];
    for (const v of golden.vectors) {
      const r = fuse({
        tCve: v.in.t_cve,
        drift: v.in.drift,
        freeze: v.in.freeze,
        qualityDrift: v.in.quality,
        specMismatch: v.in.spec,
        tier2: v.in.tier2,
      });
      const tag = JSON.stringify(v.in);
      if (
        r.liveness !== v.out.liveness &&
        Math.abs((r.liveness ?? -1) - (v.out.liveness ?? -1)) > 1e-4
      )
        failures.push(`liveness ${tag}`);
      if (Math.abs(r.signalIntegrity - v.out.signal_integrity) > 1e-4)
        failures.push(`s ${tag}: ${r.signalIntegrity} vs ${v.out.signal_integrity}`);
      if (Math.abs(r.gate.multiplier - v.out.multiplier) > 1e-4)
        failures.push(`G ${tag}: ${r.gate.multiplier} vs ${v.out.multiplier}`);
      if (r.gate.hardCap !== v.out.hard_cap) failures.push(`cap ${tag}`);
      if (r.gate.status !== v.out.gate_status) failures.push(`status ${tag}`);
      if (r.gate.tripped !== v.out.gate_tripped) failures.push(`tripped ${tag}`);
      if (r.final !== v.out.final) failures.push(`final ${tag}: ${r.final} vs ${v.out.final}`);
      if (r.tier !== v.out.tier) failures.push(`tier ${tag}`);
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
