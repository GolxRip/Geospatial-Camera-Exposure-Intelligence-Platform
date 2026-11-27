'use client';

import { useEffect, useRef } from 'react';
import type { ConsoleData, ConsoleActions, AlertRow, MapDevice, DeviceDetail, FleetCounts, AnalyticsData, ConnectionInfo, LoadState, Factor, BannerRow } from './types';
import { tierFromAction } from '@/lib/tier';
import { maskIp } from '@/lib/privacy/mask-ip';
import { useDevices, useTrustScore, CITIES } from '@/lib/api/hooks';
import {
  useStats, useSummary, useAlertHistory, useTrustDist, useTimeline,
  useIntegrity, useAuditStats, useAuditTrail, useDecay,
  useRunScenario as useRunScenarioMutation, useVerifyChain, useVerdict as useVerdictMutation,
} from '@/lib/api/console-hooks';
import { useConsoleStore } from '@/lib/state/console-store';
import { manualFacts } from '@/lib/content/facts.manual';
import { AlertSocket } from '@/lib/api/socket';
import { prettifyFactor } from '@/lib/api/normalize';
import type { Device } from '@/lib/api/normalize';
import type { TrustScore } from '@/lib/api/schemas';

/* -------------------------------------------------- helpers -------------------------------------------------- */

function loadState<T>(data: T | undefined, isLoading: boolean, isError: boolean, errorMsg?: string): LoadState<T> {
  if (isLoading) return { status: 'loading' };
  if (isError) return { status: 'error', message: errorMsg ?? 'Request failed' };
  if (data !== undefined) return { status: 'ready', data };
  return { status: 'offline' };
}

/** Map a flattened backend Device to the view-model MapDevice. */
function toMapDevice(d: Device): MapDevice {
  return {
    id: d.id,
    lat: d.lat,
    lon: d.lon,
    tier: tierFromAction(d.action_tier ?? undefined),
    gateTripped: d.integrity_gate_tripped ?? false,
    maskedIp: maskIp(d.ip),
    label: d.manufacturer ? `${d.manufacturer} ${d.id.slice(0, 6)}` : d.id.slice(0, 12),
    ownerType: d.owner_type ?? undefined,
    score: d.trust_score ?? null,
    geoSource: d.geo_source ?? undefined,
  };
}

/** Map a backend alert (from history or WS) to the view-model AlertRow. */
function toAlertRow(a: {
  id: string; camera_id: string; event_type: string; detected_at: string;
  trust_score: number; action_tier: string; integrity_gate_tripped?: boolean | number | null;
  probabilistic_score?: number | null; demo?: boolean | number | null; is_demo?: boolean | number | null;
  gate_status?: string | null;
}, devices: Map<string, MapDevice>): AlertRow {
  const dev = devices.get(a.camera_id);
  return {
    id: a.id,
    time: a.detected_at,
    deviceId: a.camera_id,
    deviceLabel: dev?.label ?? a.camera_id.slice(0, 12),
    tier: tierFromAction(a.action_tier),
    gateTripped: !!(a.integrity_gate_tripped),
    action: a.action_tier ?? 'unknown',
    score: a.trust_score ?? null,
    demo: !!(a.demo ?? a.is_demo),
    ownerType: dev?.ownerType,
  };
}

/** Map TrustScore + DecayCurve + AuditTrail into the DeviceDetail view model. */
function toDeviceDetail(
  ts: TrustScore,
  decayData: { decay_series: { hour: number; score: number }[] } | undefined,
  auditData: { entries: { sequence_id?: number; hash?: string; payload?: Record<string, unknown> }[]; count: number } | undefined,
  geoSource?: string,
): DeviceDetail {
  // Channel A factors
  const factorDetails = ts.factor_details;
  const factors: Factor[] = factorDetails && factorDetails.length > 0
    ? factorDetails.map((fd) => ({
        label: prettifyFactor(fd.label ?? fd.key ?? 'unknown'),
        delta: fd.delta,
        kev: !!(fd.is_kev ?? fd.kev),
      }))
    : (ts.contributing_factors ?? []).map((f) => {
        const isKev = /kev/i.test(f);
        return { label: prettifyFactor(f), delta: 0, kev: isKev };
      });

  // Channel B banner rows (from stored baseline comparison)
  const banner: BannerRow[] = [];
  const tsRecord = ts as unknown as {
    has_baseline_banner?: boolean;
    component_distances?: Record<string, number>;
    current_fingerprint?: Record<string, unknown>;
  };
  if (tsRecord.component_distances) {
    const tier1W = manualFacts['const.tier1.weights'].value;
    const compWeights: Record<BannerRow['field'], { key: string; weight: number }> = {
      Firmware: { key: 'firmware_version', weight: tier1W.firmware_version },
      Server: { key: 'http_server', weight: tier1W.http_server },
      Ports: { key: 'open_ports', weight: tier1W.open_ports },
      Resolution: { key: 'resolution', weight: tier1W.resolution },
      Product: { key: 'product_string', weight: tier1W.product_string },
      Codec: { key: 'codec', weight: tier1W.codec },
    };
    for (const [field, meta] of Object.entries(compWeights) as [BannerRow['field'], { key: string; weight: number }][]) {
      const dist = tsRecord.component_distances[meta.key];
      if (dist !== undefined) {
        banner.push({
          field,
          weight: meta.weight,
          baseline: 'Stored baseline',
          current: dist > 0 ? `Drift (d=${dist.toFixed(2)})` : 'Baseline match',
        });
      }
    }
  }

  // Gate status
  const gateStatus = ts.gate_status as 'nominal' | 'tapered' | 'hard_gated';

  // Liveness: null when there is no authorized camera stream (passive OSINT ethics policy)
  const visualLiveness = (ts as unknown as { visual_liveness?: number | null }).visual_liveness;
  const liveness = visualLiveness !== undefined ? visualLiveness : (ts.signal_integrity_score != null ? ts.signal_integrity_score : null);

  // Decay curve
  const decay = (decayData?.decay_series ?? []).map((pt) => ({
    age: pt.hour,
    weight: pt.score / Math.max(1, ts.trust_score || 1),
  }));

  // Audit trail
  const audit = (auditData?.entries ?? []).map((e) => ({
    id: String(e.sequence_id ?? ''),
    time: (e.payload as Record<string, unknown>)?.detected_at as string ?? '',
    action: (e.payload as Record<string, unknown>)?.action_tier as string ?? '',
    proofHref: undefined,
  }));

  return {
    id: ts.camera_id,
    maskedIp: ts.ip ? maskIp(ts.ip) : maskIp(ts.camera_id),
    manufacturer: ts.manufacturer ?? 'Unknown',
    deviceType: ts.device_type ?? 'IP camera',
    owner: ts.owner_org ?? ts.owner_type ?? 'Unknown',
    ownerType: ts.owner_type ?? 'unknown',
    city: ts.city ?? '',
    tier: tierFromAction(ts.action_tier),
    gateTripped: ts.integrity_gate_tripped,
    score: ts.trust_score ?? null,
    basis: 'on demand',
    geoSource: geoSource ?? ts.geo_source ?? undefined,
    channelA: {
      tCve: ts.cyber_trust_score ?? ts.trust_score_advanced ?? 0,
      factors,
    },
    channelB: {
      drift: ts.drift_score ?? null,
      banner,
      liveness,
    },
    gate: {
      s: ts.signal_integrity_score ?? 1,
      multiplier: ts.gate_multiplier ?? 1,
      hardCap: gateStatus === 'hard_gated' ? 30 : null,
      status: gateStatus ?? 'nominal',
    },
    models: {
      weightedAverage: ts.trust_score_wa,
      cveOnly: ts.trust_score_advanced,
      bayesian: ts.trust_score_probabilistic,
      igdctf: ts.trust_score_ig_dctf,
      decayed: ts.trust_score_decayed,
    },
    decay,
    decayAgeUnit: 'hours',
    audit,
  };
}

/* -------------------------------------------------- main hook -------------------------------------------------- */

/**
 * THE SEAM - wired to the real backend.
 *
 * Uses the repo's TanStack Query hooks + Zustand console store + AlertSocket to produce the
 * view-model types (`ConsoleData` / `ConsoleActions`) that the console's controlled components render.
 * Every IP address is masked before it leaves this function.
 */
export function useConsoleData(
  selectedDeviceId: string | null,
  city: string,
): { data: ConsoleData; actions: ConsoleActions } {
  /* ---- zustand store (WS alerts + connection state) ---- */
  const wsAlerts = useConsoleStore((s) => s.alerts);
  const wsConnection = useConsoleStore((s) => s.connection);
  const wsRetryInMs = useConsoleStore((s) => s.retryInMs);
  const pushAlert = useConsoleStore((s) => s.pushAlert);
  const markGateTrip = useConsoleStore((s) => s.markGateTrip);
  const setConnection = useConsoleStore((s) => s.setConnection);

  /* ---- WebSocket lifecycle ---- */
  const socketRef = useRef<AlertSocket | null>(null);
  useEffect(() => {
    const sock = new AlertSocket({
      onMessage(msg) {
        if (msg.type === 'ALERT') pushAlert(msg);
        if (msg.type === 'INTEGRITY_GATE_TRIPPED') markGateTrip();
      },
      onState(state, info) {
        setConnection(state, info.retryInMs);
      },
    });
    sock.connect();
    socketRef.current = sock;
    return () => sock.close();
  }, [pushAlert, markGateTrip, setConnection]);

  /* ---- TanStack Query hooks ---- */
  const devicesQ = useDevices(city);
  const trustScoreQ = useTrustScore(selectedDeviceId);
  const statsQ = useStats(city);
  const summaryQ = useSummary();
  const alertHistoryQ = useAlertHistory();
  const trustDistQ = useTrustDist();
  const timelineQ = useTimeline();
  const integrityQ = useIntegrity();
  const auditStatsQ = useAuditStats();
  const decayQ = useDecay(selectedDeviceId);
  const auditTrailQ = useAuditTrail(selectedDeviceId);

  /* ---- mutations ---- */
  const runScenario = useRunScenarioMutation();
  const verifyChain = useVerifyChain();
  const verdictMut = useVerdictMutation();

  /* ---- transform: devices ---- */
  const mapDevices: MapDevice[] = devicesQ.data?.devices.map(toMapDevice) ?? [];
  const deviceMap = new Map(mapDevices.map((d) => [d.id, d]));

  /* ---- transform: connection ---- */
  const connection: ConnectionInfo = {
    status: wsConnection === 'live' ? 'live' : wsConnection === 'connecting' ? 'connecting' : 'disconnected',
    retryInSeconds: wsRetryInMs != null ? Math.ceil(wsRetryInMs / 1000) : undefined,
  };

  /* ---- transform: counts ---- */
  const counts: LoadState<FleetCounts> = (() => {
    if (summaryQ.isLoading || statsQ.isLoading) return { status: 'loading' } as const;
    if (summaryQ.isError && statsQ.isError) return { status: 'offline' } as const;
    const deviceCount = summaryQ.data?.device_count ?? statsQ.data?.total_devices ?? 0;
    const alertCount = summaryQ.data?.total_alerts_24h ?? 0;
    const gateTripped = mapDevices.filter((d) => d.gateTripped).length;
    return { status: 'ready', data: { devices: deviceCount, alerts: alertCount, gateTripped } } as const;
  })();

  /* ---- transform: alerts (merge WS live + history) ---- */
  const alerts: LoadState<AlertRow[]> = (() => {
    const historyAlerts = alertHistoryQ.data?.alerts ?? [];
    const historyRows = historyAlerts.map((a) => toAlertRow(a as Parameters<typeof toAlertRow>[0], deviceMap));
    // WS alerts prepended (newest first), deduplicated by id
    const wsRows = wsAlerts.map((a) => ({
      id: a.id,
      time: a.detected_at,
      deviceId: a.camera_id,
      deviceLabel: deviceMap.get(a.camera_id)?.label ?? a.camera_id.slice(0, 12),
      tier: tierFromAction(a.action_tier),
      gateTripped: a.integrity_gate_tripped ?? false,
      action: a.action_tier,
      score: a.trust_score ?? null,
      demo: a.demo ?? false,
      ownerType: deviceMap.get(a.camera_id)?.ownerType,
    }));
    const seen = new Set<string>();
    const merged: AlertRow[] = [];
    for (const row of [...wsRows, ...historyRows]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        merged.push(row);
      }
    }
    if (alertHistoryQ.isLoading && wsAlerts.length === 0) return { status: 'loading' };
    if (alertHistoryQ.isError && wsAlerts.length === 0) return { status: 'offline' };
    return { status: 'ready', data: merged };
  })();

  /* ---- transform: devices load state ---- */
  const devicesState: LoadState<MapDevice[]> = loadState(
    mapDevices.length > 0 ? mapDevices : devicesQ.data ? [] : undefined,
    devicesQ.isLoading,
    devicesQ.isError,
  );

  /* ---- transform: device detail ---- */
  const detail: LoadState<DeviceDetail | null> = (() => {
    if (!selectedDeviceId) return { status: 'ready', data: null };
    if (trustScoreQ.isLoading) return { status: 'loading' };
    if (trustScoreQ.isError) return { status: 'error', message: 'Could not load device detail' };
    if (trustScoreQ.data) {
      const geoSource = deviceMap.get(trustScoreQ.data.camera_id)?.geoSource;
      return { status: 'ready', data: toDeviceDetail(trustScoreQ.data, decayQ.data, auditTrailQ.data, geoSource) };
    }
    return { status: 'offline' };
  })();

  /* ---- transform: analytics ---- */
  const analytics: LoadState<AnalyticsData> = (() => {
    if (trustDistQ.isLoading || timelineQ.isLoading || integrityQ.isLoading || auditStatsQ.isLoading) {
      return { status: 'loading' };
    }
    if (trustDistQ.isError && timelineQ.isError) return { status: 'offline' };

    const tiers = trustDistQ.data?.tiers ?? {};
    const fleet = {
      high: tiers.high_trust ?? 0,
      medium: tiers.medium_trust ?? 0,
      low: tiers.low_trust ?? 0,
      unscored: Math.max(0, (summaryQ.data?.device_count ?? 0) - (trustDistQ.data?.total_alerts ?? 0)),
    };

    const timelineEntries = (timelineQ.data?.timeline ?? []).map((t) => {
      const item = t as unknown as { hour: string; count: number; real_count?: number; demo_count?: number; low_trust?: number };
      const demo = item.demo_count ?? 0;
      const real = item.real_count !== undefined ? item.real_count : Math.max(0, item.count - (item.low_trust ?? 0));
      return {
        label: item.hour,
        real,
        demo,
      };
    });

    const gateDist = integrityQ.data?.gate_distribution ?? {};
    const integrity = {
      nominal: gateDist.nominal ?? 0,
      tapered: gateDist.tapered ?? 0,
      hardGated: gateDist.hard_gated ?? 0,
    };

    const ledger = {
      entries: auditStatsQ.data?.chain_length ?? 0,
      chainOk: auditStatsQ.data?.chain_valid ?? null,
      message: auditStatsQ.data?.integrity_message,
    };

    return { status: 'ready', data: { fleet, alerts: timelineEntries, integrity, ledger } };
  })();

  /* ---- cities ---- */
  const cities = [...CITIES];

  /* ---- actions ---- */
  const actions: ConsoleActions = {
    onRunScenario: () => { runScenario.mutate(); },
    onVerdict: async (verdict) => {
      // Find the most recent alert for the selected device
      const alertsData = alerts.status === 'ready' ? alerts.data : [];
      const latestAlert = alertsData.find((a) => a.deviceId === selectedDeviceId);
      if (!latestAlert) throw new Error('No alert found for this device');
      await verdictMut.mutateAsync({ alertId: latestAlert.id, verdict });
    },
    verdictError: verdictMut.error ? String(verdictMut.error instanceof Error ? verdictMut.error.message : verdictMut.error) : undefined,
    onVerifyLedger: () => { verifyChain.mutate(); },
    verifyingLedger: verifyChain.isPending,
  };

  return {
    data: { connection, counts, alerts, devices: devicesState, detail, analytics, cities },
    actions,
  };
}
