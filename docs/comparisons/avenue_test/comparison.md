# Tier 2 Comparison: Avenue Test (v1 baseline) vs. Avenue Test (v2 held-out)

- Before folder: `eval/results/avenue_test_baseline` (`liveness_detector:FrameLivenessTracker`, 16 videos, 0.119 clean h)
- After folder: `eval/results/avenue_test_tuned` (`liveness_detector:FrameLivenessTracker`, 16 videos, 0.119 clean h)
- Intervals: 95% Wilson binomial CIs for detection rates; exact 95% Garwood Poisson CIs for false alarms/hour.

| Level | Run | Before (rate, 95% CI) | Before delay (s) | After (rate, 95% CI) | After delay (s) |
|---|---|---|---|---|---|
| degraded | freeze | 16/16 (100.0%) [80.6, 100.0]% | 1.00 | 16/16 (100.0%) [80.6, 100.0]% | 1.00 |
| degraded | loop | 1/16 (6.2%) [1.1, 28.3]% | 0.04 | 15/16 (93.8%) [71.7, 98.9]% | 0.56 |
| degraded | blur | 16/16 (100.0%) [80.6, 100.0]% | 0.00 | 16/16 (100.0%) [80.6, 100.0]% | 0.00 |
| degraded | slow_blur | 16/16 (100.0%) [80.6, 100.0]% | 3.52 | 16/16 (100.0%) [80.6, 100.0]% | 3.06 |
| degraded | cover | 16/16 (100.0%) [80.6, 100.0]% | 0.00 | 16/16 (100.0%) [80.6, 100.0]% | 0.00 |
| degraded | partial_cover | 13/16 (81.2%) [57.0, 93.4]% | 4.16 | 16/16 (100.0%) [80.6, 100.0]% | 0.76 |
| degraded | moved | 16/16 (100.0%) [80.6, 100.0]% | 0.00 | 16/16 (100.0%) [80.6, 100.0]% | 0.00 |
| degraded | downscale | 16/16 (100.0%) [80.6, 100.0]% | 0.00 | 16/16 (100.0%) [80.6, 100.0]% | 0.00 |
| degraded | **clean FA/hour** | 33.5/h [9.1, 85.7] (4 over 0.119h, 16 vids) | n/a | 8.4/h [0.2, 46.6] (1 over 0.119h, 16 vids) | n/a |
| tripped | freeze | 16/16 (100.0%) [80.6, 100.0]% | 1.00 | 16/16 (100.0%) [80.6, 100.0]% | 1.00 |
| tripped | loop | 1/16 (6.2%) [1.1, 28.3]% | 0.04 | 15/16 (93.8%) [71.7, 98.9]% | 0.56 |
| tripped | blur | 16/16 (100.0%) [80.6, 100.0]% | 0.00 | 16/16 (100.0%) [80.6, 100.0]% | 0.00 |
| tripped | slow_blur | 0/16 (0.0%) [0.0, 19.4]% | n/a | 16/16 (100.0%) [80.6, 100.0]% | 5.88 |
| tripped | cover | 16/16 (100.0%) [80.6, 100.0]% | 0.00 | 16/16 (100.0%) [80.6, 100.0]% | 0.00 |
| tripped | partial_cover | 13/16 (81.2%) [57.0, 93.4]% | 4.16 | 16/16 (100.0%) [80.6, 100.0]% | 0.76 |
| tripped | moved | 2/16 (12.5%) [3.5, 36.0]% | 13.24 | 16/16 (100.0%) [80.6, 100.0]% | 1.96 |
| tripped | downscale | 16/16 (100.0%) [80.6, 100.0]% | 0.00 | 16/16 (100.0%) [80.6, 100.0]% | 0.00 |
| tripped | **clean FA/hour** | 33.5/h [9.1, 85.7] (4 over 0.119h, 16 vids) | n/a | 0.0/h [0.0, 30.9] (0 over 0.119h, 16 vids) | n/a |
