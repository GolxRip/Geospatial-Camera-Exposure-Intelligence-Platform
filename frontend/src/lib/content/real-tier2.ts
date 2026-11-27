import 'server-only';

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export interface CsvTable {
  filename: string;
  headers: string[];
  rows: string[][];
}

export interface AttackStatRow {
  run: string;
  hits: number;
  total: number;
  ratePct: number;
  ciLowPct: number;
  ciHighPct: number;
  medianDelayS: string;
}

export interface CleanStatRow {
  videos: number;
  droppedVideos: number | null;
  dropNote: string;
  hours: number;
  falseAlarms: number;
  faPerHour: number;
  ciLow: number;
  ciHigh: number;
}

export interface LevelSummary {
  attacks: Record<string, AttackStatRow>;
  clean: CleanStatRow | null;
}

export interface RealTier2Run {
  id: string;
  dataset: string;
  date: string;
  detector: string;
  command: string | null;
  splitKey: string;
  splitTitle: string;
  version: 'v1' | 'v2';
  roleLabel: string;
  evaluatedVideos: number | null;
  droppedVideos: number | null;
  dropNote: string;
  attackOrder: string[];
  levels: {
    degraded: LevelSummary;
    tripped: LevelSummary;
  };
  summaryLines: string[];
  csvTables: CsvTable[];
}

export interface RealTier2Comparison {
  splitKey: string;
  splitTitle: string;
  roleKindLabel: string;
  baseline: RealTier2Run | null;
  v2: RealTier2Run | null;
}

export interface RealTier2Results {
  available: boolean;
  resultsDir: string | null;
  runs: RealTier2Run[];
  comparisons: RealTier2Comparison[];
}

const Z_95 = 1.959963984540054;

function wilsonCiPct(k: number, n: number): [number, number] {
  if (n <= 0) return [0, 0];
  const p = k / n;
  const z2 = Z_95 * Z_95;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (Z_95 * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / denom;
  return [Math.max(0, center - half) * 100, Math.min(1, center + half) * 100];
}

function lgamma(z: number): number {
  const c = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.001208650973866179,
    -0.000005395239384953,
  ];
  const x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < c.length; j += 1) {
    y += 1;
    ser += c[j]! / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function poissonUpperTail(k: number, lam: number): number {
  if (lam <= 0) return k > 0 ? 0 : 1;
  const logLam = Math.log(lam);
  let cdf = 0;
  for (let i = 0; i < k; i += 1) {
    cdf += Math.exp(-lam + i * logLam - lgamma(i + 1));
  }
  return Math.max(0, Math.min(1, 1 - cdf));
}

function poissonLowerTail(k: number, lam: number): number {
  if (lam <= 0) return 1;
  const logLam = Math.log(lam);
  let total = 0;
  for (let i = 0; i <= k; i += 1) {
    total += Math.exp(-lam + i * logLam - lgamma(i + 1));
  }
  return Math.max(0, Math.min(1, total));
}

function exactPoissonRateCi(k: number, hours: number): [number, number, number] {
  if (hours <= 0) return [0, 0, 0];
  const target = 0.025;
  let loCount = 0;
  if (k > 0) {
    let lo = 0;
    let hi = Math.max(10, k * 2 + 20);
    while (poissonUpperTail(k, hi) < target) hi *= 2;
    for (let it = 0; it < 70; it += 1) {
      const mid = 0.5 * (lo + hi);
      if (poissonUpperTail(k, mid) < target) lo = mid;
      else hi = mid;
    }
    loCount = 0.5 * (lo + hi);
  }
  let lo = Math.max(0, k);
  let hi = Math.max(12, k * 2 + 25);
  while (poissonLowerTail(k, hi) > target) hi *= 2;
  for (let it = 0; it < 70; it += 1) {
    const mid = 0.5 * (lo + hi);
    if (poissonLowerTail(k, mid) > target) lo = mid;
    else hi = mid;
  }
  const hiCount = 0.5 * (lo + hi);
  return [k / hours, loCount / hours, hiCount / hours];
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
  return { filename: basename(filePath), headers, rows };
}

function tableToRecords(table: CsvTable): Record<string, string>[] {
  return table.rows.map((r) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < table.headers.length; i += 1) {
      obj[table.headers[i]!] = r[i] ?? '';
    }
    return obj;
  });
}

function extractField(text: string, patterns: RegExp[]): string | null {
  for (const pat of patterns) {
    const m = pat.exec(text);
    if (m?.[1]) return m[1].trim().replace(/^`|`$/g, '');
  }
  return null;
}

function medianNum(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

function classifyRun(runId: string, dataset: string, detector: string): {
  splitKey: string;
  splitTitle: string;
  version: 'v1' | 'v2';
  roleLabel: string;
  knownTotalClips: number | null;
} {
  const keyStr = `${runId} ${dataset}`.toLowerCase();
  const isV1 =
    keyStr.includes('baseline') ||
    keyStr.includes('_v1') ||
    detector.includes('liveness_detector_v1');
  const version: 'v1' | 'v2' = isV1 ? 'v1' : 'v2';

  if (keyStr.includes('avenue') && keyStr.includes('train')) {
    return {
      splitKey: 'avenue_train',
      splitTitle: 'CUHK Avenue (training_videos)',
      version,
      roleLabel: version === 'v2' ? 'development set (tuned)' : 'development set (baseline v1)',
      knownTotalClips: 16,
    };
  }
  if (keyStr.includes('avenue') && keyStr.includes('test')) {
    return {
      splitKey: 'avenue_test',
      splitTitle: 'CUHK Avenue (testing_videos)',
      version,
      roleLabel: version === 'v2' ? 'held-out' : 'held-out (baseline v1)',
      knownTotalClips: 21,
    };
  }
  if (keyStr.includes('own') && keyStr.includes('day')) {
    return {
      splitKey: 'own_day',
      splitTitle: 'Own clips (day)',
      version,
      roleLabel: version === 'v2' ? 'held-out' : 'held-out (baseline v1)',
      knownTotalClips: null,
    };
  }
  if (keyStr.includes('own') && keyStr.includes('night')) {
    return {
      splitKey: 'own_night',
      splitTitle: 'Own clips (night)',
      version,
      roleLabel: version === 'v2' ? 'held-out' : 'held-out (baseline v1)',
      knownTotalClips: null,
    };
  }
  if (keyStr.includes('cdnet')) {
    return {
      splitKey: 'cdnet',
      splitTitle: 'CDnet-2014',
      version,
      roleLabel: version === 'v2' ? 'held-out' : 'held-out (baseline v1)',
      knownTotalClips: null,
    };
  }
  return {
    splitKey: runId,
    splitTitle: dataset,
    version,
    roleLabel: version === 'v2' ? 'held-out' : 'held-out (baseline v1)',
    knownTotalClips: null,
  };
}

function buildLevels(
  summaryTable: CsvTable | undefined,
  perRunTable: CsvTable | undefined,
  droppedVideos: number | null,
  dropNote: string,
): { attackOrder: string[]; evaluatedVideos: number | null; levels: { degraded: LevelSummary; tripped: LevelSummary } } {
  const sumRecs = summaryTable ? tableToRecords(summaryTable) : [];
  const perRecs = perRunTable ? tableToRecords(perRunTable) : [];
  const attackOrder: string[] = [];
  for (const r of sumRecs) {
    const run = r.run ?? '';
    if (run && run !== 'clean' && !attackOrder.includes(run)) attackOrder.push(run);
  }
  for (const r of perRecs) {
    const run = r.run ?? '';
    if (run && run !== 'clean' && !attackOrder.includes(run)) attackOrder.push(run);
  }

  let evaluatedVideos: number | null = null;
  const parseLevel = (level: 'degraded' | 'tripped'): LevelSummary => {
    const attacks: Record<string, AttackStatRow> = {};
    const lvlSum = sumRecs.filter((r) => r.level === level);
    const lvlPer = perRecs.filter((r) => r.level === level);

    for (const atk of attackOrder) {
      const aPer = lvlPer.filter((r) => r.run === atk);
      const aSum = lvlSum.find((r) => r.run === atk);
      let hits = 0;
      let total = 0;
      let medDelay = 'n/a';
      if (aPer.length > 0) {
        total = aPer.length;
        const hitRows = aPer.filter((r) => String(r.detected).toLowerCase() === 'true');
        hits = hitRows.length;
        const delays = hitRows
          .map((r) => Number(r.delay_s))
          .filter((x) => !Number.isNaN(x));
        const m = medianNum(delays);
        medDelay = m === null ? 'n/a' : m.toFixed(2);
      } else if (aSum) {
        hits = Number(aSum.detected || 0);
        total = Number(aSum.total || 0);
        medDelay = aSum.median_delay_s || 'n/a';
      }
      if (total > 0) {
        const [ciLo, ciHi] = wilsonCiPct(hits, total);
        attacks[atk] = {
          run: atk,
          hits,
          total,
          ratePct: (hits / total) * 100,
          ciLowPct: ciLo,
          ciHighPct: ciHi,
          medianDelayS: medDelay,
        };
      }
    }

    let clean: CleanStatRow | null = null;
    const cleanPer = lvlPer.filter((r) => r.run === 'clean');
    const cleanSum = lvlSum.find((r) => r.run === 'clean');
    if (cleanPer.length > 0) {
      const videos = cleanPer.length;
      const hours = cleanPer.reduce((acc, r) => acc + Number(r.seconds || 0), 0) / 3600;
      const fa = cleanPer.reduce((acc, r) => acc + Math.round(Number(r.false_alarms || 0)), 0);
      const [rate, ciLo, ciHi] = exactPoissonRateCi(fa, hours);
      evaluatedVideos = videos;
      clean = {
        videos,
        droppedVideos,
        dropNote,
        hours,
        falseAlarms: fa,
        faPerHour: rate,
        ciLow: ciLo,
        ciHigh: ciHi,
      };
    } else if (cleanSum) {
      const videos = Number(cleanSum.total || 0);
      const hours = Number(cleanSum.clean_hours || 0);
      const fa = Number(cleanSum.clean_false_alarms || 0);
      const [rate, ciLo, ciHi] = exactPoissonRateCi(fa, hours);
      evaluatedVideos = videos;
      clean = {
        videos,
        droppedVideos,
        dropNote,
        hours,
        falseAlarms: fa,
        faPerHour: rate,
        ciLow: ciLo,
        ciHigh: ciHi,
      };
    }
    return { attacks, clean };
  };

  return {
    attackOrder,
    evaluatedVideos,
    levels: {
      degraded: parseLevel('degraded'),
      tripped: parseLevel('tripped'),
    },
  };
}

function parseRunFolder(
  runId: string,
  _dirPath: string,
  summaryFiles: string[],
  csvFiles: string[],
): RealTier2Run | null {
  if (summaryFiles.length === 0 && csvFiles.length === 0) return null;

  let dataset = runId === 'root' ? 'Public real footage' : runId;
  let date = '';
  let detector = 'liveness_detector:FrameLivenessTracker';
  let command: string | null = null;
  let summaryLines: string[] = [];
  let parsedDropped: number | null = null;
  let dropDetail = '';

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

    const detMatch = /detector\s+([^\s]+)/i.exec(raw);
    if (detMatch?.[1]) detector = detMatch[1].trim();

    const dropMatch = /(\d+)\s+dropped\s*(\([^)]+\))?/i.exec(raw);
    if (dropMatch?.[1]) {
      parsedDropped = Number(dropMatch[1]);
      dropDetail = dropMatch[2] ?? '';
    }

    summaryLines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } else if (csvFiles.length > 0) {
    const st = statSync(csvFiles[0]!);
    date = st.mtime.toISOString().slice(0, 10);
  }

  const csvTables: CsvTable[] = [];
  for (const cp of csvFiles.sort((a, b) =>
    basename(a) === 'summary.csv' ? -1 : basename(b) === 'summary.csv' ? 1 : a.localeCompare(b),
  )) {
    const parsed = parseCsvFile(cp);
    if (parsed) csvTables.push(parsed);
  }

  const meta = classifyRun(runId, dataset, detector);
  const sumTable = csvTables.find((t) => t.filename === 'summary.csv');
  const perTable = csvTables.find((t) => t.filename === 'per_run.csv');

  const preCounts = buildLevels(sumTable, perTable, null, '');
  const evalN = preCounts.evaluatedVideos;
  const droppedVideos =
    parsedDropped !== null
      ? parsedDropped
      : meta.knownTotalClips !== null && evalN !== null
        ? Math.max(0, meta.knownTotalClips - evalN)
        : null;
  const dropNote =
    droppedVideos === null
      ? 'dropped clip count not recorded in summary.md'
      : dropDetail
        ? `${droppedVideos} dropped ${dropDetail}`
        : `${droppedVideos} dropped (< --min-seconds 12s)`;

  const { attackOrder, evaluatedVideos, levels } = buildLevels(
    sumTable,
    perTable,
    droppedVideos,
    dropNote,
  );

  return {
    id: runId,
    dataset,
    date,
    detector,
    command,
    splitKey: meta.splitKey,
    splitTitle: meta.splitTitle,
    version: meta.version,
    roleLabel: meta.roleLabel,
    evaluatedVideos,
    droppedVideos,
    dropNote,
    attackOrder,
    levels,
    summaryLines,
    csvTables,
  };
}

const SPLIT_ORDER = ['avenue_train', 'avenue_test', 'own_day', 'own_night', 'cdnet'] as const;

export function loadRealTier2Results(): RealTier2Results {
  const dir = resolveResultsDir();
  if (!dir) return { available: false, resultsDir: null, runs: [], comparisons: [] };

  const entries = readdirSync(dir);
  const rootSummaries = entries
    .filter((e) => e.toLowerCase() === 'summary.md' || e.toLowerCase().endsWith('_summary.md'))
    .map((e) => join(dir, e));
  const rootCsvs = entries.filter((e) => e.toLowerCase().endsWith('.csv')).map((e) => join(dir, e));

  const runs: RealTier2Run[] = [];
  const rootRun = parseRunFolder('root', dir, rootSummaries, rootCsvs);
  if (rootRun) runs.push(rootRun);

  for (const entry of entries.sort()) {
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

  const grouped = new Map<string, RealTier2Comparison>();
  for (const run of runs) {
    const existing = grouped.get(run.splitKey);
    const isDev = run.splitKey === 'avenue_train';
    if (!existing) {
      grouped.set(run.splitKey, {
        splitKey: run.splitKey,
        splitTitle: run.splitTitle,
        roleKindLabel: isDev ? 'development set (tuned)' : 'held-out',
        baseline: run.version === 'v1' ? run : null,
        v2: run.version === 'v2' ? run : null,
      });
    } else {
      if (run.version === 'v1') existing.baseline = run;
      else existing.v2 = run;
    }
  }

  const comparisons = [...grouped.values()].sort((a, b) => {
    const ia = SPLIT_ORDER.indexOf(a.splitKey as (typeof SPLIT_ORDER)[number]);
    const ib = SPLIT_ORDER.indexOf(b.splitKey as (typeof SPLIT_ORDER)[number]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return {
    available: runs.length > 0,
    resultsDir: dir,
    runs,
    comparisons,
  };
}
