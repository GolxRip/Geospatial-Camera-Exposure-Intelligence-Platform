import 'server-only';

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export interface CsvTable {
  filename: string;
  headers: string[];
  rows: string[][];
}

export interface RealTier2Run {
  id: string;
  dataset: string;
  date: string;
  command: string | null;
  summaryLines: string[];
  csvTables: CsvTable[];
}

export interface RealTier2Results {
  available: boolean;
  resultsDir: string | null;
  runs: RealTier2Run[];
}

function resolveResultsDir(): string | null {
  const candidates = [
    resolve(process.cwd(), '../eval/results'),
    resolve(process.cwd(), 'eval/results'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir) && statSync(dir).isDirectory()) return dir;
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCsvFile(filePath: string): CsvTable | null {
  const raw = readFileSync(filePath, 'utf8').trim();
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  const headers = parseCsvLine(lines[0]!);
  const rows = lines.slice(1).map(parseCsvLine);
  return {
    filename: basename(filePath),
    headers,
    rows,
  };
}

function extractField(text: string, patterns: RegExp[]): string | null {
  for (const pat of patterns) {
    const m = pat.exec(text);
    if (m?.[1]) return m[1].trim().replace(/^`|`$/g, '');
  }
  return null;
}

function parseRunFolder(runId: string, dirPath: string, summaryFiles: string[], csvFiles: string[]): RealTier2Run | null {
  if (summaryFiles.length === 0 && csvFiles.length === 0) return null;

  let dataset = runId === 'root' ? 'Public real footage' : runId;
  let date = '';
  let command: string | null = null;
  let summaryLines: string[] = [];

  if (summaryFiles.length > 0) {
    const summaryPath = summaryFiles[0]!;
    const raw = readFileSync(summaryPath, 'utf8');
    const st = statSync(summaryPath);
    date = st.mtime.toISOString().slice(0, 10);

    const ds = extractField(raw, [
      /^\s*[-*]?\s*\*{0,2}Dataset\*{0,2}\s*:\s*\*{0,2}\s*(.+)$/im,
      /^#\s*(?:Tier\s*2\s*)?(.+)$/im,
    ]);
    if (ds) dataset = ds;

    const dt = extractField(raw, [
      /^\s*[-*]?\s*\*{0,2}(?:Date|Generated|Run\s*Date)\*{0,2}\s*:\s*\*{0,2}\s*(.+)$/im,
    ]);
    if (dt) date = dt;

    const cmd = extractField(raw, [
      /^\s*[-*]?\s*\*{0,2}Command\*{0,2}\s*:\s*\*{0,2}\s*`?(.+?)`?\s*$/im,
    ]);
    if (cmd) command = cmd;

    summaryLines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } else if (csvFiles.length > 0) {
    const st = statSync(csvFiles[0]!);
    date = st.mtime.toISOString().slice(0, 10);
  }

  const csvTables: CsvTable[] = [];
  for (const cp of csvFiles.sort((a, b) => (basename(a) === 'summary.csv' ? -1 : basename(b) === 'summary.csv' ? 1 : a.localeCompare(b)))) {
    const parsed = parseCsvFile(cp);
    if (parsed) csvTables.push(parsed);
  }

  return {
    id: runId,
    dataset,
    date,
    command,
    summaryLines,
    csvTables,
  };
}

/**
 * Load saved real-footage Tier 2 evaluation outputs from `eval/results/`.
 * Never returns synthetic numbers; returns `available: false` until real CSV or summary.md files exist.
 */
export function loadRealTier2Results(): RealTier2Results {
  const dir = resolveResultsDir();
  if (!dir) return { available: false, resultsDir: null, runs: [] };

  const entries = readdirSync(dir);
  const rootSummaries = entries
    .filter((e) => e.toLowerCase() === 'summary.md' || e.toLowerCase().endsWith('_summary.md'))
    .map((e) => join(dir, e));
  const rootCsvs = entries.filter((e) => e.toLowerCase().endsWith('.csv')).map((e) => join(dir, e));

  const runs: RealTier2Run[] = [];
  const rootRun = parseRunFolder('root', dir, rootSummaries, rootCsvs);
  if (rootRun) runs.push(rootRun);

  for (const entry of entries.sort().reverse()) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    const sub = readdirSync(full);
    const sums = sub
      .filter((e) => e.toLowerCase() === 'summary.md' || e.toLowerCase().endsWith('.md'))
      .map((e) => join(full, e));
    const csvs = sub.filter((e) => e.toLowerCase().endsWith('.csv')).map((e) => join(full, e));
    const run = parseRunFolder(entry, full, sums, csvs);
    if (run) runs.push(run);
  }

  return {
    available: runs.length > 0,
    resultsDir: dir,
    runs,
  };
}
