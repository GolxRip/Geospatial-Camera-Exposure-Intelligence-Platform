import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Z } from '@/lib/constants/z';

const TOKENS = readFileSync(resolve(__dirname, '../../src/styles/tokens.css'), 'utf8');

/** Reads `--name: #rrggbb;` declarations from the :root block. */
function hexToken(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(TOKENS);
  if (!m?.[1]) throw new Error(`token --${name} not found as a hex value in tokens.css`);
  return m[1];
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Alpha-composites `fg` at `alpha` over `bg`. */
function over(
  fg: [number, number, number],
  alpha: number,
  bg: [number, number, number],
): [number, number, number] {
  return [0, 1, 2].map((i) => fg[i]! * alpha + bg[i]! * (1 - alpha)) as [number, number, number];
}

const c = (name: string) => rgb(hexToken(name));
const round1 = (n: number) => Math.round(n * 10) / 10;

describe('colour tokens (FRONTEND_SPEC.md section 5.1)', () => {
  it('match the brand palette written by assets/logo/build_logo.py', () => {
    const logo = readFileSync(resolve(__dirname, '../../../assets/logo/build_logo.py'), 'utf8');
    const grab = (n: string) =>
      new RegExp(`^${n}\\s*=\\s*'(#[0-9A-Fa-f]{6})'`, 'm').exec(logo)?.[1]?.toUpperCase();
    expect(hexToken('ink-0').toUpperCase()).toBe(grab('VOID'));
    expect(hexToken('bone').toUpperCase()).toBe(grab('BONE'));
    expect(hexToken('signal').toUpperCase()).toBe(grab('SIGNAL'));
    expect(hexToken('signal-on-light').toUpperCase()).toBe(grab('SIGNAL_ON_LIGHT'));
  });

  it('contrast ratios (recomputed) meet or beat the spec table', () => {
    const rows: Array<[string, number, number]> = [
      ['bone on ink-0', contrast(c('bone'), c('ink-0')), 16.1],
      ['bone on ink-2', contrast(c('bone'), c('ink-2')), 14.3],
      ['bone-2 on ink-0', contrast(c('bone-2'), c('ink-0')), 8.3],
      ['bone-2 on ink-2', contrast(c('bone-2'), c('ink-2')), 7.3],
      ['bone-3 on ink-0', contrast(c('bone-3'), c('ink-0')), 4.1],
      ['bone-3 on ink-2', contrast(c('bone-3'), c('ink-2')), 3.6],
      ['signal on ink-0', contrast(c('signal'), c('ink-0')), 9.5],
      ['signal on ink-2', contrast(c('signal'), c('ink-2')), 8.4],
      ['ink-0 on signal (button label)', contrast(c('ink-0'), c('signal')), 9.5],
      ['signal-on-light on white', contrast(c('signal-on-light'), [255, 255, 255]), 4.9],
    ];
    // Printed so the build report can quote the recomputed values.
    console.log(
      rows.map(([n, v, spec]) => `${n.padEnd(34)} ${v.toFixed(2)}:1 (spec ${spec})`).join('\n'),
    );
    // The spec rounds to one decimal (9.45 is printed as 9.5), so allow 0.06 of rounding slack, no more.
    for (const [name, value, spec] of rows) {
      expect(value, name).toBeGreaterThanOrEqual(spec - 0.06);
      expect(round1(value), name).toBeGreaterThanOrEqual(spec - 0.1);
    }
  });

  it('text pairs used in the primitives meet WCAG AA for their size', () => {
    const AA = 4.5;
    expect(contrast(c('bone'), c('ink-0'))).toBeGreaterThanOrEqual(AA);
    expect(contrast(c('bone'), c('ink-3'))).toBeGreaterThanOrEqual(AA);
    expect(contrast(c('bone-2'), c('ink-0'))).toBeGreaterThanOrEqual(AA);
    expect(contrast(c('bone-2'), c('ink-1'))).toBeGreaterThanOrEqual(AA);
    expect(contrast(c('bone-2'), c('ink-2'))).toBeGreaterThanOrEqual(AA);
    expect(contrast(c('bone-2'), c('ink-3'))).toBeGreaterThanOrEqual(AA);
    expect(contrast(c('ink-0'), c('signal'))).toBeGreaterThanOrEqual(AA);
    // Badge: amber text on the 14% amber tint over the elevated surface.
    const tint = over(c('signal'), 0.14, c('ink-2'));
    expect(contrast(c('signal'), tint)).toBeGreaterThanOrEqual(AA);
    // Inline error: bone text on the same tint.
    expect(contrast(c('bone'), tint)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c('bone-2'), tint)).toBeGreaterThanOrEqual(AA);
  });

  it('bone-3 is below AA for small text, so it must stay at 18 px or larger / non-essential (spec 5.1)', () => {
    // Documents the limit instead of hiding it: 3:1 is the large-text threshold.
    expect(contrast(c('bone-3'), c('ink-0'))).toBeLessThan(4.5);
    expect(contrast(c('bone-3'), c('ink-0'))).toBeGreaterThanOrEqual(3);
  });
});

describe('z-scale', () => {
  it('src/lib/constants/z.ts equals the --z-* custom properties in tokens.css', () => {
    for (const [name, value] of Object.entries(Z)) {
      const m = new RegExp(`--z-${name}:\\s*(\\d+)\\s*;`).exec(TOKENS);
      expect(m?.[1], `--z-${name}`).toBe(String(value));
    }
    const declared = [...TOKENS.matchAll(/--z-([a-z]+):/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(Z).sort());
  });
});
