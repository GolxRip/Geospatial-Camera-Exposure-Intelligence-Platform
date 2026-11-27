# Tier 2 Real-Footage Figures — Data Sources & Captions

All figures are generated directly by `eval/make_figures.py` from saved CSV results.

## Input Data Files
- **Before (Baseline (v1), `liveness_detector:FrameLivenessTracker`):** `eval/results/avenue_test_baseline/summary.csv` and `eval/results/avenue_test_baseline/per_run.csv` (16 videos, 0.119 clean h)
- **After (Frozen v2 (held-out), `liveness_detector:FrameLivenessTracker`):** `eval/results/avenue_test_tuned/summary.csv` and `eval/results/avenue_test_tuned/per_run.csv` (16 videos, 0.119 clean h)

## Figures
- **detection_rate_tripped** (`detection_rate_tripped.svg`, `detection_rate_tripped.pdf`): Attack detection rate at the `tripped` (`liveness <= 0.50`) gate level across 8 tamper transforms, showing 95% Wilson binomial confidence intervals.
- **detection_rate_degraded** (`detection_rate_degraded.svg`, `detection_rate_degraded.pdf`): Attack detection rate at the `degraded` (`liveness < 0.85`) gate level across 8 tamper transforms, showing 95% Wilson binomial confidence intervals.
- **false_alarms_per_hour** (`false_alarms_per_hour.svg`, `false_alarms_per_hour.pdf`): Untouched clean-footage false alarms per hour at `tripped` (`<= 0.50`) with exact 95% Garwood Poisson intervals, reflecting finite clean duration (0.119 h before, 0.119 h after).
