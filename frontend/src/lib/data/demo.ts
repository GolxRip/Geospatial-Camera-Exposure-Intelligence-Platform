import type { AlertRow, AnalyticsData, ConsoleData, DeviceDetail, MapDevice } from './types';
import { evaluateGate } from '@/lib/scoring/gate';

/**
 * DEMO DATA, for design review only. It is rendered only by the dev-only /console-preview route (404 in production), under a
 * visible "Demo data" banner. Nothing here describes a real device: the addresses are from the documentation ranges
 * 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24 (RFC 5737) and are already masked, and the positions are invented points in India.
 */
const CITIES = [
  ['Mumbai', 19.076, 72.878],
  ['Delhi', 28.614, 77.209],
  ['Bangalore', 12.972, 77.594],
  ['Hyderabad', 17.385, 78.487],
  ['Chennai', 13.083, 80.27],
  ['Kolkata', 22.573, 88.364],
  ['Pune', 18.52, 73.857],
] as const;

const NETS = ['192.0.2.•', '198.51.100.•', '203.0.113.•'] as const;
const OWNERS = ['government', 'telecom', 'corporate', 'unknown'] as const;

/** A small deterministic generator, so server and client render the same demo. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export const DEMO_DEVICES: MapDevice[] = (() => {
  const r = rng(7);
  const out: MapDevice[] = [];
  for (let i = 0; i < 160; i += 1) {
    const [, lat, lon] = CITIES[Math.floor(r() * CITIES.length)]!;
    const score = Math.round(r() * 100);
    const tripped = r() < 0.08;
    out.push({
      id: `demo-${i}`,
      lat: lat + (r() - 0.5) * 0.9,
      lon: lon + (r() - 0.5) * 0.9,
      tier: tripped ? 'low' : score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low',
      gateTripped: tripped,
      maskedIp: NETS[i % NETS.length]!,
      label: `Camera ${String(i + 1).padStart(3, '0')}`,
      ownerType: OWNERS[i % OWNERS.length],
      score: tripped ? Math.min(30, score) : score,
      geoSource: 'synthetic_demo',
    });
  }
  return out;
})();

export const DEMO_ALERTS: AlertRow[] = (() => {
  const r = rng(11);
  const base = Date.UTC(2026, 9, 14, 12, 0, 0);
  return Array.from({ length: 240 }, (_, i) => {
    const d = DEMO_DEVICES[Math.floor(r() * DEMO_DEVICES.length)]!;
    return {
      id: `alert-${i}`,
      time: new Date(base - i * 41_000).toISOString(),
      deviceId: d.id,
      deviceLabel: d.label,
      tier: d.tier,
      gateTripped: d.gateTripped,
      action: d.tier === 'high' ? 'high_trust' : d.tier === 'medium' ? 'medium_trust' : 'low_trust',
      score: d.score ?? null,
      demo: r() < 0.3,
      ownerType: d.ownerType,
    };
  });
})();

export function demoDetail(id: string): DeviceDetail | null {
  const d = DEMO_DEVICES.find((x) => x.id === id);
  if (!d) return null;
  const s = d.gateTripped ? 0.4 : d.tier === 'medium' ? 0.7 : 0.95;
  const gate = evaluateGate(s);
  const tCve = d.gateTripped ? 90 : (d.score ?? 60);
  return {
    id: d.id,
    maskedIp: d.maskedIp,
    manufacturer: 'ExampleCam',
    deviceType: 'IP camera',
    owner: 'Example Municipal Corporation',
    ownerType: d.ownerType ?? 'unknown',
    ownerConfidence: 0.7,
    city: 'Example city',
    tier: d.tier,
    gateTripped: d.gateTripped,
    score: d.score ?? null,
    basis: 'static posture',
    geoSource: 'synthetic_demo',
    channelA: {
      tCve,
      factors: [
        { label: 'Known CVE, critical severity', delta: -25, kev: true },
        { label: 'Authentication required', delta: 0 },
        { label: 'Firmware older than two years', delta: -15 },
        { label: 'Corroborated by two nearby cameras', delta: 20 },
      ],
    },
    channelB: {
      drift: d.gateTripped ? 0.6 : 0.05,
      banner: [
        {
          field: 'Firmware',
          weight: 0.25,
          baseline: '1.0.0',
          current: d.gateTripped ? '0.9.1' : '1.0.0',
        },
        {
          field: 'Server',
          weight: 0.2,
          baseline: 'example-httpd',
          current: d.gateTripped ? 'other-httpd' : 'example-httpd',
        },
        {
          field: 'Ports',
          weight: 0.2,
          baseline: '80, 554',
          current: d.gateTripped ? '80, 8080' : '80, 554',
        },
        { field: 'Resolution', weight: 0.2, baseline: '1920x1080', current: '1920x1080' },
        { field: 'Product', weight: 0.1, baseline: 'ExampleCam 2000', current: 'ExampleCam 2000' },
        { field: 'Codec', weight: 0.05, baseline: 'H.264', current: 'H.264' },
      ],
      liveness: null,
    },
    gate: { s, multiplier: gate.multiplier, hardCap: gate.hardCap, status: gate.status },
    models: {
      weightedAverage: 62,
      cveOnly: tCve,
      bayesian: 58,
      igdctf: d.score ?? 0,
      decayed: Math.max(0, (d.score ?? 0) - 6),
    },
    decay: Array.from({ length: 24 }, (_, i) => ({ age: i * 5, weight: Math.exp(-i / 9) })),
    audit: [
      { id: 'a1', time: '2026-10-14T11:58:20.000Z', action: 'low_trust' },
      { id: 'a2', time: '2026-10-14T11:41:02.000Z', action: 'medium_trust' },
    ],
  };
}

export const DEMO_ANALYTICS: AnalyticsData = {
  fleet: { high: 71, medium: 52, low: 31, unscored: 6 },
  alerts: Array.from({ length: 12 }, (_, i) => ({
    label: `${String(i * 2).padStart(2, '0')}:00`,
    real: 3 + ((i * 7) % 9),
    demo: (i * 5) % 6,
  })),
  integrity: { nominal: 118, tapered: 29, hardGated: 13 },
  ledger: { entries: 480, chainOk: true },
};

/** Devices within about one degree of a demo city. "All India" keeps every device. */
function inCity(d: MapDevice, city: string): boolean {
  const c = CITIES.find((x) => x[0] === city);
  return !c || (Math.abs(d.lat - c[1]) < 1 && Math.abs(d.lon - c[2]) < 1);
}

export function demoConsoleData(
  selectedId: string | null,
  city = 'All India',
  extraAlerts: AlertRow[] = [],
): ConsoleData {
  const devices = DEMO_DEVICES.filter((d) => inCity(d, city));
  const ids = new Set(devices.map((d) => d.id));
  const alerts = [...extraAlerts, ...DEMO_ALERTS].filter((a) => ids.has(a.deviceId));
  return {
    connection: { status: 'live' },
    counts: {
      status: 'ready',
      data: {
        devices: devices.length,
        alerts: alerts.length,
        gateTripped: devices.filter((d) => d.gateTripped).length,
      },
    },
    alerts: { status: 'ready', data: alerts },
    devices: { status: 'ready', data: devices },
    detail: { status: 'ready', data: selectedId ? demoDetail(selectedId) : null },
    analytics: { status: 'ready', data: DEMO_ANALYTICS },
    cities: ['All India', ...CITIES.map((c) => c[0])],
  };
}
