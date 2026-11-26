'use client';

import type { LabActions, AlertRow, SimulationResult, ScenarioOutcome, NlQueryResult, MapDevice } from './types';
import { tierFromAction } from '@/lib/tier';
import { maskIp } from '@/lib/privacy/mask-ip';
import { env } from '@/lib/env';

const API = env.apiUrl;

/**
 * THE LAB SEAM - wired to the real backend.
 *
 * Returns the functions the lab instruments call (see `LabActions` in types.ts).
 * Attack simulators hit POST /api/simulate/:id, scenario replay hits POST /api/scenarios/run + SSE,
 * and NL query hits POST /api/nl-query.
 */
export function useLabActions(): LabActions {
  return {
    onSimulate: async (id): Promise<SimulationResult> => {
      const res = await fetch(`${API}/api/simulate/${id}`, { method: 'POST' });
      const text = await res.text();
      let body: unknown = text;
      try { body = JSON.parse(text); } catch { /* keep text */ }

      const reason = typeof body === 'object' && body !== null && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : typeof body === 'string' ? body : res.statusText;

      const result: SimulationResult = { status: res.status, reason };

      // If the response includes an alert, map it
      if (typeof body === 'object' && body !== null && 'alert' in body) {
        const a = (body as { alert: Record<string, unknown> }).alert;
        if (a && typeof a === 'object') {
          result.alert = {
            id: String(a.id ?? ''),
            time: String(a.detected_at ?? ''),
            deviceId: String(a.camera_id ?? ''),
            deviceLabel: String(a.camera_id ?? '').slice(0, 12),
            tier: tierFromAction(a.action_tier as string),
            gateTripped: !!(a.integrity_gate_tripped),
            action: String(a.action_tier ?? ''),
            score: typeof a.trust_score === 'number' ? a.trust_score : null,
            demo: !!(a.demo ?? a.is_demo),
          };
        }
      }
      return result;
    },

    onRunScenario: async (onEvent): Promise<ScenarioOutcome> => {
      const res = await fetch(`${API}/api/scenarios/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: 'default' }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        return { status: res.status, message: String(body.detail ?? body.message ?? res.statusText) };
      }

      const data = await res.json() as { events?: number; interval_seconds?: number; message?: string };

      // The scenario endpoint returns events count + interval. The SSE feed delivers them.
      // We wait for the events to come in through the WebSocket and collect them here.
      // For now, we signal completion based on the returned data.
      return {
        status: res.status,
        message: data.message ?? `Scenario started: ${data.events ?? 0} events at ${data.interval_seconds ?? 0}s intervals`,
      };
    },

    onNlQuery: async (query): Promise<NlQueryResult> => {
      const res = await fetch(`${API}/api/nl-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, current_city: null }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(String(err.detail ?? err.message ?? 'Query failed'));
      }

      const data = await res.json() as {
        auth_required?: boolean | null; has_cve?: boolean | null;
        owner_type?: string | null; city?: string | null;
        search_text?: string | null; explanation?: string;
        parsed_by_ai?: boolean; devices?: Array<Record<string, unknown>>;
      };

      const filters: { name: string; value: string }[] = [];
      if (data.auth_required != null) filters.push({ name: 'Auth required', value: String(data.auth_required) });
      if (data.has_cve != null) filters.push({ name: 'Has CVE', value: String(data.has_cve) });
      if (data.owner_type) filters.push({ name: 'Owner type', value: data.owner_type });
      if (data.city) filters.push({ name: 'City', value: data.city });
      if (data.search_text) filters.push({ name: 'Search', value: data.search_text });

      // The NL query endpoint returns filter params, not device results directly.
      // The caller re-fetches devices with those filters. Return empty devices array.
      const devices: MapDevice[] = (data.devices ?? []).map((d) => ({
        id: String(d.id ?? ''),
        lat: Number(d.lat ?? 0),
        lon: Number(d.lon ?? 0),
        tier: tierFromAction(d.action_tier as string | undefined),
        gateTripped: !!(d.integrity_gate_tripped),
        maskedIp: maskIp(d.ip as string | undefined),
        label: String(d.manufacturer ?? d.id ?? '').slice(0, 12),
        ownerType: d.owner_type as string | undefined,
        score: typeof d.trust_score === 'number' ? d.trust_score : null,
      }));

      return {
        filters,
        parsedByModel: data.parsed_by_ai ?? false,
        devices,
      };
    },
  };
}
