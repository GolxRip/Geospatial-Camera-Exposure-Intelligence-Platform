# Tier 2 Comparison: Avenue Train (v1 baseline) vs. Avenue Train (v2 tuned)

- Before folder: `eval/results/avenue_train_baseline` (`liveness_detector:FrameLivenessTracker`, 14 videos, 0.131 clean h)
- After folder: `eval/results/avenue_train_tuned` (`liveness_detector:FrameLivenessTracker`, 14 videos, 0.131 clean h)
- Intervals: 95% Wilson binomial CIs for detection rates; exact 95% Garwood Poisson CIs for false alarms/hour.

| Level | Run | Before (rate, 95% CI) | Before delay (s) | After (rate, 95% CI) | After delay (s) |
|---|---|---|---|---|---|
| degraded | freeze | 14/14 (100.0%) [78.5, 100.0]% | 0.90 | 14/14 (100.0%) [78.5, 100.0]% | 1.00 |
| degraded | loop | 0/14 (0.0%) [0.0, 21.5]% | n/a | 14/14 (100.0%) [78.5, 100.0]% | 0.56 |
| degraded | blur | 14/14 (100.0%) [78.5, 100.0]% | 0.00 | 14/14 (100.0%) [78.5, 100.0]% | 0.00 |
| degraded | slow_blur | 14/14 (100.0%) [78.5, 100.0]% | 3.52 | 14/14 (100.0%) [78.5, 100.0]% | 3.08 |
| degraded | cover | 14/14 (100.0%) [78.5, 100.0]% | 0.00 | 14/14 (100.0%) [78.5, 100.0]% | 0.00 |
| degraded | partial_cover | 13/14 (92.9%) [68.5, 98.7]% | 2.64 | 14/14 (100.0%) [78.5, 100.0]% | 0.76 |
| degraded | moved | 14/14 (100.0%) [78.5, 100.0]% | 0.00 | 14/14 (100.0%) [78.5, 100.0]% | 0.00 |
| degraded | downscale | 14/14 (100.0%) [78.5, 100.0]% | 0.00 | 14/14 (100.0%) [78.5, 100.0]% | 0.00 |
| degraded | **clean FA/hour** | 45.9/h [16.9, 100.0] (6 over 0.131h, 14 vids) | n/a | 0.0/h [0.0, 28.2] (0 over 0.131h, 14 vids) | n/a |
| tripped | freeze | 14/14 (100.0%) [78.5, 100.0]% | 0.90 | 14/14 (100.0%) [78.5, 100.0]% | 1.00 |
| tripped | loop | 0/14 (0.0%) [0.0, 21.5]% | n/a | 14/14 (100.0%) [78.5, 100.0]% | 0.56 |
| tripped | blur | 14/14 (100.0%) [78.5, 100.0]% | 0.00 | 14/14 (100.0%) [78.5, 100.0]% | 0.00 |
| tripped | slow_blur | 1/14 (7.1%) [1.3, 31.5]% | 24.40 | 14/14 (100.0%) [78.5, 100.0]% | 5.94 |
| tripped | cover | 14/14 (100.0%) [78.5, 100.0]% | 0.00 | 14/14 (100.0%) [78.5, 100.0]% | 0.00 |
| tripped | partial_cover | 13/14 (92.9%) [68.5, 98.7]% | 2.64 | 14/14 (100.0%) [78.5, 100.0]% | 0.76 |
| tripped | moved | 2/14 (14.3%) [4.0, 39.9]% | 13.74 | 14/14 (100.0%) [78.5, 100.0]% | 1.96 |
| tripped | downscale | 14/14 (100.0%) [78.5, 100.0]% | 0.00 | 14/14 (100.0%) [78.5, 100.0]% | 0.00 |
| tripped | **clean FA/hour** | 45.9/h [16.9, 100.0] (6 over 0.131h, 14 vids) | n/a | 0.0/h [0.0, 28.2] (0 over 0.131h, 14 vids) | n/a |
