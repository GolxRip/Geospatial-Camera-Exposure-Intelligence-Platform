/**
 * Hand-written facts. Marketing results never live here: those are generated from paper/data/results.json
 * into facts.generated.ts. This file holds only constants of the method and one count that results.json does
 * not contain. Every entry names where it was read from, and tests/unit/facts.test.ts fails on an empty `source`.
 *
 * The live thresholds come from GET /api/config/thresholds at runtime; these are the labelled static fallback
 * (FRONTEND_SPEC.md section 3.1).
 */
export interface ManualFact<T> {
  readonly value: T;
  /** The file (and symbol) the value was read from. Required. */
  readonly source: string;
}

export const manualFacts = {
  'const.tiers': {
    value: { high_min: 80, medium_min: 50 },
    source: 'backend/routes/config_router.py (_TIER_HIGH_MIN, _TIER_MEDIUM_MIN)',
  },
  'const.gate': {
    value: { theta_low: 0.5, theta_high: 0.85, floor_multiplier: 0.3, hard_cap: 30 },
    source:
      'backend/services/signal_integrity_service.py (THETA_LOW, THETA_HIGH, evaluate_integrity_gate) and backend/routes/config_router.py',
  },
  'const.tier1.weights': {
    value: {
      firmware_version: 0.25,
      http_server: 0.2,
      open_ports: 0.2,
      resolution: 0.2,
      product_string: 0.1,
      codec: 0.05,
    },
    source: 'backend/services/signal_integrity_service.py (DEFAULT_DRIFT_WEIGHTS)',
  },
  'const.tier1.drift_threshold': {
    value: 0.15,
    source: 'backend/routes/integrity_router.py (anomaly_threshold)',
  },
  'const.tier2.weights': {
    value: { freeze: 1.0, quality: 0.6, spec: 0.5 },
    source:
      'backend/services/signal_integrity_service.py (compute_visual_liveness default weights)',
  },
  'const.tier2.freeze': {
    value: { consecutive_frames: 25, hamming_max: 1, ewma_alpha: 0.05 },
    source: 'video_pipeline/liveness_detector.py (FrameLivenessTracker defaults)',
  },
  'eval.tests': {
    value: { passed: 439, date: '2026-11-27' },
    source: 'README.md ("439 passed, 1 skipped, 0 warnings") and paper/CLAIMS.md claim C16',
  },
} as const satisfies Record<string, ManualFact<unknown>>;

export type ManualFactKey = keyof typeof manualFacts;
