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
    value: {
      passed: 439,
      skipped: 1,
      python_collected: 440,
      backend_collected: 374,
      backend_passed: 373,
      video_pipeline_passed: 52,
      eval_passed: 14,
      frontend_suites: 10,
      frontend_tests: 76,
      frontend_unit_suites: 7,
      frontend_unit_tests: 46,
      golden_vectors: 265,
      date: '2026-11-27',
      frontend_date: '2026-11-28',
    },
    source:
      'Single source of truth for automated test counts: pytest --collect-only -q backend/tests/ video_pipeline/tests/ eval/ (440 collected; 439 passed, 1 skipped on run), frontend/vitest.config.mts (10 suites / 76 tests passing on Windows on 2026-11-28 = 7 unit suites / 46 tests + 3 contract suites / 30 tests, after removing duplicate tests; was 11 / 82 on Kali on 2026-11-27), frontend/tests/fixtures/gate_golden.json (265 vectors), paper/CLAIMS.md C16',
  },
} as const satisfies Record<string, ManualFact<unknown>>;

export type ManualFactKey = keyof typeof manualFacts;
