# Tier 2 on real footage: 16 videos, detector liveness_detector:FrameLivenessTracker

- Dataset: CUHK Avenue (testing, held-out v2)
- Date: 2026-11-27 03:57:41 UTC
- Command: `python3 eval/tier2_real_footage.py --data '/home/aditya/datasets/avenue/Avenue Dataset/testing_videos' --dataset 'CUHK Avenue (testing, held-out v2)' --width 320 --min-seconds 12 --max-seconds 90 --out eval/results/avenue_test_tuned`

## Alarm level: degraded

| Run | Detected | Median delay (s) |
|---|---|---|
| freeze | 16/16 | 1.0 |
| loop | 15/16 | 0.6 |
| blur | 16/16 | 0.0 |
| slow_blur | 16/16 | 3.1 |
| cover | 16/16 | 0.0 |
| partial_cover | 16/16 | 0.8 |
| moved | 16/16 | 0.0 |
| downscale | 16/16 | 0.0 |

Clean footage: 1 false alarms over 0.12 h (8.4 per hour), 1/16 videos with at least one.

## Alarm level: tripped

| Run | Detected | Median delay (s) |
|---|---|---|
| freeze | 16/16 | 1.0 |
| loop | 15/16 | 0.6 |
| blur | 16/16 | 0.0 |
| slow_blur | 16/16 | 5.9 |
| cover | 16/16 | 0.0 |
| partial_cover | 16/16 | 0.8 |
| moved | 16/16 | 2.0 |
| downscale | 16/16 | 0.0 |

Clean footage: 0 false alarms over 0.12 h (0.0 per hour), 0/16 videos with at least one.
