import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FULL_SPAN_DEG,
  GAP_DEG,
  GATE_FLOOR,
  HOOD,
  RIB_COUNT,
  eyePath,
  ribAngles,
  ribWidthDeg,
  sectorPath,
  spreadForGate,
} from '@/lib/brand/hood';

const SOURCE = resolve(__dirname, '../../../assets/logo/cobra-mark.geometry.json');

describe('hood geometry', () => {
  it('is a byte-for-byte copy of assets/logo/cobra-mark.geometry.json', () => {
    const copy = readFileSync(resolve(__dirname, '../../src/lib/brand/hood-geometry.json'));
    expect(copy.equals(readFileSync(SOURCE))).toBe(true);
  });

  it('has nine ribs spanning 236 degrees with a 4.5 degree gap', () => {
    expect(RIB_COUNT).toBe(9);
    expect(FULL_SPAN_DEG).toBeCloseTo(236, 3);
    expect(GAP_DEG).toBeCloseTo(4.5, 3);
  });

  it('reproduces the rib angles written by build_logo.py at full spread', () => {
    const mine = ribAngles(FULL_SPAN_DEG);
    HOOD.ribs.forEach((rib, i) => {
      expect(mine[i]?.a0).toBeCloseTo(rib.a0, 2);
      expect(mine[i]?.a1).toBeCloseTo(rib.a1, 2);
    });
  });

  it('spread is 236 * G and ribs shrink but never vanish at the floor (spec 6.3)', () => {
    expect(GATE_FLOOR).toBe(0.3);
    expect(spreadForGate(1)).toBeCloseTo(236, 6);
    expect(spreadForGate(0.3)).toBeCloseTo(70.8, 6);
    expect(ribWidthDeg(spreadForGate(0.3))).toBeCloseTo(3.867, 3);
    expect(spreadForGate(0)).toBeCloseTo(70.8, 6); // clamped to the floor
    expect(spreadForGate(2)).toBeCloseTo(236, 6); // clamped to 1
  });

  it('ribs stay centred on up and keep the gap at every spread', () => {
    for (const g of [0.3, 0.5, 0.85, 1]) {
      const ribs = ribAngles(spreadForGate(g));
      expect(ribs[0]?.a0).toBeCloseTo(-spreadForGate(g) / 2, 6);
      expect(ribs[ribs.length - 1]?.a1).toBeCloseTo(spreadForGate(g) / 2, 6);
      for (let i = 1; i < ribs.length; i += 1) {
        expect((ribs[i]?.a0 ?? 0) - (ribs[i - 1]?.a1 ?? 0)).toBeCloseTo(GAP_DEG, 6);
      }
    }
  });

  // Reference strings produced by build_logo.sector() and build_logo.eye_path() with the mark parameters.
  it('builds the same sector paths as build_logo.py', () => {
    const [cx, cy] = [HOOD.center[0]!, HOOD.center[1]!];
    const first = HOOD.ribs[0]!;
    expect(sectorPath(cx, cy, HOOD.rIn, HOOD.rOut, first.a0, first.a1)).toBe(
      'M20.53,166.25 A90,90 0 0 1 10.46,133.06 L66.17,127.42 A34,34 0 0 0 69.98,139.96 Z',
    );
    const top = HOOD.ribs[4]!;
    expect(sectorPath(cx, cy, HOOD.rIn, HOOD.rOut, top.a0, top.a1)).toBe(
      'M82.66,35.69 A90,90 0 0 1 117.34,35.69 L106.55,90.64 A34,34 0 0 0 93.45,90.64 Z',
    );
  });

  it('draws the lens-shaped eye exactly as build_logo.py does', () => {
    expect(eyePath(100, 124, HOOD.eye.r, HOOD.eye.d)).toBe(
      'M100,103.96 A24,24 0 0 1 100,144.04 A24,24 0 0 1 100,103.96 Z',
    );
  });
});
