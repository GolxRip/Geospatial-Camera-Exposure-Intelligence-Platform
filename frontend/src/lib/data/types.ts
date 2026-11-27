/**
 * View models the console components render. They are plain data: nothing in `src/components` calls a network API.
 * Map your backend's responses onto these in `src/lib/data/` (see README.md in this folder) and pass the results down as props.
 *
 * Rules the components rely on:
 *  - `maskedIp` is already masked. Use `maskIp()` from `src/lib/privacy/mask-ip.ts` before it gets here.
 *  - `tier` is the UI tier ('high' | 'medium' | 'low') or null when unscored. `tierFromAction()` maps the backend's strings.
 *  - Positions are estimates (city-level from IP geolocation); the UI says so wherever it draws them.
 */
import type { TierId } from '@/lib/tier';

export type { TierId };

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

export interface MapDevice {
  id: string;
  lat: number;
  lon: number;
  tier: TierId | null;
  gateTripped: boolean;
  maskedIp: string;
  label: string;
  ownerType?: string;
  score?: number | null;
  geoSource?: string;
}

export interface AlertRow {
  id: string;
  /** ISO timestamp. */
  time: string;
  deviceId: string;
  deviceLabel: string;
  tier: TierId | null;
  gateTripped: boolean;
  /** The action the backend chose, for example "low_trust". Shown as text. */
  action: string;
  score: number | null;
  /** Scripted traffic (simulators, scenario runs): always shown with a Demo tag. */
  demo: boolean;
  ownerType?: string;
}

export interface ConnectionInfo {
  status: 'connecting' | 'live' | 'disconnected';
  /** Seconds until the next retry when disconnected. */
  retryInSeconds?: number;
}

export interface FleetCounts {
  devices: number;
  alerts: number;
  gateTripped: number;
}

export interface Factor {
  label: string;
  /** Points added (positive) or removed (negative) from the score. */
  delta: number;
  kev?: boolean;
}

export interface BannerRow {
  field: 'Product' | 'Server' | 'Firmware' | 'Ports' | 'Resolution' | 'Codec';
  weight: number;
  baseline: string;
  current: string;
}

export interface ModelScores {
  weightedAverage: number;
  cveOnly: number;
  bayesian: number;
  igdctf: number;
  /** The decayed variant, when the backend returns it. */
  decayed?: number;
}

export interface AuditEntry {
  id: string;
  time: string;
  action: string;
  /** Link target for the Merkle proof page, when you build one. */
  proofHref?: string;
}

export interface DeviceDetail {
  id: string;
  maskedIp: string;
  manufacturer: string;
  deviceType: string;
  owner: string;
  ownerType: string;
  ownerConfidence?: number;
  city: string;
  tier: TierId | null;
  gateTripped: boolean;
  /** T_final. */
  score: number | null;
  /** 'static posture' or 'on demand': how the score was computed. */
  basis: 'static posture' | 'on demand';
  geoSource?: string;
  channelA: { tCve: number; factors: Factor[] };
  channelB: {
    drift: number | null;
    banner: BannerRow[];
    /** null when there is no authorized footage: the UI says so and never shows a zero. */
    liveness: number | null;
  };
  gate: {
    s: number;
    multiplier: number;
    hardCap: number | null;
    status: 'nominal' | 'tapered' | 'hard_gated';
  };
  models: ModelScores;
  decay: { age: number; weight: number }[];
  /** Unit of `decay[].age`, as the axis label. Defaults to just "age" when you do not set it. */
  decayAgeUnit?: string;
  audit: AuditEntry[];
}

export interface AnalyticsData {
  fleet: { high: number; medium: number; low: number; unscored: number };
  /** One entry per time bucket; demo traffic is counted apart so it is never mixed into the real series. */
  alerts: { label: string; real: number; demo: number }[];
  integrity: { nominal: number; tapered: number; hardGated: number };
  ledger: { entries: number; chainOk: boolean | null; message?: string };
}

/** Everything the console renders. `useConsoleData()` in `use-console-data.ts` is where you produce it. */
export interface ConsoleData {
  connection: ConnectionInfo;
  counts: LoadState<FleetCounts>;
  alerts: LoadState<AlertRow[]>;
  devices: LoadState<MapDevice[]>;
  /** `ready` with `data: null` means nothing is selected. */
  detail: LoadState<DeviceDetail | null>;
  analytics: LoadState<AnalyticsData>;
  cities: string[];
}

export interface ConsoleActions {
  onRunScenario?: () => void;
  /** May be async. If it throws, set `verdictError` from the caller; the console shows it verbatim. */
  onVerdict?: (verdict: 'verified' | 'false_alarm') => void | Promise<void>;
  /** Shown verbatim under the verdict buttons, for example the backend's 403 message. No retry is offered. */
  verdictError?: string;
  onVerifyLedger?: () => void;
  /** True while a full-chain verification is running. */
  verifyingLedger?: boolean;
}

/* ------------------------------------------------------------------------------------------------------------------ Lab */

export type SimulatorId =
  'replay-attack' | 'timestamp-skew' | 'rate-flood' | 'collusion-ring' | 'reset';

export interface SimulationResult {
  /** The HTTP status the simulator got back, shown as is. */
  status: number;
  /** The reason the service gave, shown verbatim. */
  reason: string;
  /** The alert the request produced, when it produced one. */
  alert?: AlertRow;
}

export interface ScenarioOutcome {
  status: number;
  /** Shown verbatim, for example the message that goes with a 409 or a 404. */
  message: string;
}

export interface NlQueryResult {
  /** The filters the query was parsed into, so a query can be audited. */
  filters: { name: string; value: string }[];
  /** False when the service fell back to plain text search. */
  parsedByModel: boolean;
  devices: MapDevice[];
}

/**
 * What the lab instruments call. Leave one undefined and its instrument shows as not connected, with its controls disabled.
 * Each promise rejects with an Error whose message is shown verbatim.
 */
export interface LabActions {
  onSimulate?: (id: SimulatorId) => Promise<SimulationResult>;
  /** Called once per event as it arrives, and resolves when the run is over. Twelve events are expected. */
  onRunScenario?: (onEvent: (event: AlertRow) => void) => Promise<ScenarioOutcome>;
  onNlQuery?: (query: string) => Promise<NlQueryResult>;
}
