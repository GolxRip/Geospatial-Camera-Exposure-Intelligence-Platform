/**
 * In-browser port of the IG-DCTF scoring path (FRONTEND_SPEC.md section 14.4), so the gate explorer and the landing page
 * compute locally and show the same numbers the backend would.
 *
 * Ported from backend/services/signal_integrity_service.py (`compute_visual_liveness`,
 * `compute_composite_signal_integrity`, `evaluate_integrity_gate`) and the fusion step of
 * backend/services/trust_score_service.py (`compute_ig_dctf_trust_score`).
 *
 * tests/unit/gate.test.ts checks this file against tests/fixtures/gate_golden.json, which scripts/export-golden.py
 * produces by running the Python functions. If the backend constants change, regenerate the fixture; the test then fails
 * until this port is updated.
 */
import { manualFacts } from '@/lib/content/facts.manual';

export const GATE = manualFacts['const.gate'].value;
export const TIER2_WEIGHTS = manualFacts['const.tier2.weights'].value;
export const TIERS = manualFacts['const.tiers'].value;

export type GateStatus = 'nominal' | 'tapered' | 'hard_gated';
export type TrustTier = 'high_trust' | 'medium_trust' | 'low_trust';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Python's round(x, 4): the decimal expansion of the double is rounded, so toFixed matches except on exact ties. */
const round4 = (x: number) => Number(x.toFixed(4));

/** Python's round(x) for ints: halves go to the even neighbour. Math.round sends halves up, which differs at x.5. */
export function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

export interface LivenessInput {
  freeze: boolean;
  /** Blur or exposure deviation from the camera's baseline, 0 to 1. */
  qualityDrift: number;
  specMismatch: boolean;
}

/** L = 1 - max(w1 * Freeze, w2 * QualityDrift, w3 * SpecMismatch), rounded to 4 places. */
export function computeVisualLiveness({
  freeze,
  qualityDrift,
  specMismatch,
}: LivenessInput): number {
  const { freeze: w1, quality: w2, spec: w3 } = TIER2_WEIGHTS;
  const penalty = Math.max(
    (freeze ? 1 : 0) * w1,
    clamp01(qualityDrift) * w2,
    (specMismatch ? 1 : 0) * w3,
  );
  return round4(clamp01(1 - penalty));
}

/** s = (1 - Drift) * L with Tier 2, or 1 - Drift without it. `liveness` null means Tier 2 is unavailable. */
export function computeSignalIntegrity(drift: number, liveness: number | null): number {
  const tier1 = clamp01(1 - drift);
  return round4(liveness === null ? tier1 : tier1 * clamp01(liveness));
}

export interface GateResult {
  multiplier: number;
  hardCap: number | null;
  tripped: boolean;
  status: GateStatus;
}

/** G(s): 1 at or above theta_high, a linear taper from 1 to 0.3 between the thresholds, 0.3 with a cap of 30 below theta_low. */
export function evaluateGate(
  signalIntegrity: number,
  thetas: { high: number; low: number } = { high: GATE.theta_high, low: GATE.theta_low },
): GateResult {
  const s = clamp01(signalIntegrity);
  if (s >= thetas.high) return { multiplier: 1, hardCap: null, tripped: false, status: 'nominal' };
  if (s >= thetas.low) {
    const slope = (1 - GATE.floor_multiplier) / (thetas.high - thetas.low);
    return {
      multiplier: round4(GATE.floor_multiplier + slope * (s - thetas.low)),
      hardCap: null,
      tripped: false,
      status: 'tapered',
    };
  }
  return {
    multiplier: GATE.floor_multiplier,
    hardCap: GATE.hard_cap,
    tripped: true,
    status: 'hard_gated',
  };
}

export function tierOf(score: number): TrustTier {
  return score >= TIERS.high_min
    ? 'high_trust'
    : score >= TIERS.medium_min
      ? 'medium_trust'
      : 'low_trust';
}

export interface FusionInput extends Omit<LivenessInput, never> {
  /** Channel A score, 0 to 100. */
  tCve: number;
  /** Tier 1 banner drift, 0 to 1. */
  drift: number;
  /** False when no authorized footage exists for the device; the explorer's "Tier 2 unavailable" toggle. */
  tier2: boolean;
}

export interface FusionResult {
  liveness: number | null;
  signalIntegrity: number;
  gate: GateResult;
  final: number;
  tier: TrustTier;
  /** What the vulnerability-only model would say for the same device. */
  cveOnlyTier: TrustTier;
}

/** T_final = T_cve * G(s), capped at 30 when the gate trips (compute_ig_dctf_trust_score). */
export function fuse(input: FusionInput): FusionResult {
  const liveness = input.tier2
    ? computeVisualLiveness({
        freeze: input.freeze,
        qualityDrift: input.qualityDrift,
        specMismatch: input.specMismatch,
      })
    : null;
  const signalIntegrity = computeSignalIntegrity(input.drift, liveness);
  const gate = evaluateGate(signalIntegrity);
  let final = roundHalfEven(input.tCve * gate.multiplier);
  if (gate.hardCap !== null) final = Math.min(gate.hardCap, final);
  final = Math.max(0, Math.min(100, final));
  return {
    liveness,
    signalIntegrity,
    gate,
    final,
    tier: tierOf(final),
    cveOnlyTier: tierOf(input.tCve),
  };
}
