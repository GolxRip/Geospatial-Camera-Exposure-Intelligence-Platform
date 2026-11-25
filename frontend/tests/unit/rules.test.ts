import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Mechanical checks for FRONTEND_SPEC.md rules that are otherwise promises:
 * the palette (1.3 and 5.1), no gradients, glass only where allowed, and the copy rule (3.5).
 */
const SRC = resolve(__dirname, '../../src');
const GENERATED = new Set(['facts.generated.ts', 'schema.d.ts', 'hood-geometry.json']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css)$/.test(name) && !GENERATED.has(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).map((p) => ({ path: relative(SRC, p), text: readFileSync(p, 'utf8') }));

const PALETTE = new Set([
  '#0a0c0b',
  '#101311',
  '#171b19',
  '#202522',
  '#e7eae3',
  '#a4aaa1',
  '#6e746c',
  '#f3a33a',
  '#a85f00',
]);

describe('palette and surface rules', () => {
  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('uses no hex colour outside the palette', () => {
    const offenders: string[] = [];
    for (const f of files) {
      for (const m of f.text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        const hex = m[0].toLowerCase();
        if (!PALETTE.has(hex)) offenders.push(`${f.path}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('uses no gradients', () => {
    const offenders = files.filter((f) =>
      /-gradient\(|\b(bg|from|via|to)-gradient|bg-linear|bg-radial|bg-conic/.test(f.text),
    );
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('uses no off-palette Tailwind colour names and no drop shadows', () => {
    const colour =
      /\b(?:bg|text|border|fill|stroke|ring|from|to|via)-(?:red|green|blue|purple|indigo|violet|cyan|teal|pink|rose|emerald|sky|fuchsia|lime|orange|yellow|amber|slate|gray|zinc|neutral|stone)-\d{2,3}\b/;
    const shadow = /\bshadow-(?:sm|md|lg|xl|2xl|inner)\b/;
    const offenders = files.filter((f) => colour.test(f.text) || shadow.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('allows backdrop blur only in the .glass utility (nav and command palette)', () => {
    const offenders = files.filter(
      (f) => f.path !== 'styles/globals.css' && /backdrop-(filter|blur)/.test(f.text),
    );
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('imports none of the banned libraries', () => {
    const banned =
      /from ['"](gsap|framer-motion|motion|lenis|leaflet|react-leaflet|mapbox-gl|@react-three\/[^'"]+|lottie-web|lottie-react|recharts|chart\.js|d3)['"]/;
    expect(files.filter((f) => banned.test(f.text)).map((f) => f.path)).toEqual([]);
  });
});

describe('copy rules (spec 3.5)', () => {
  it('has no em dash or en dash anywhere in the source', () => {
    const offenders = files.filter((f) => /[–—]/.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });

  it('has none of the banned filler words in the source', () => {
    const filler = /\b(unlock|supercharge|seamless(ly)?|revolutionary|AI-powered|powered by AI)\b/i;
    expect(files.filter((f) => filler.test(f.text)).map((f) => f.path)).toEqual([]);
  });
});
