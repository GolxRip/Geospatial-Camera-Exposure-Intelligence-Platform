# Tier 2 on real footage: 16 videos, detector liveness_detector:FrameLivenessTracker

- Dataset: CUHK Avenue (testing)
- Date: 2026-11-26 17:51:46 UTC
- Command: `python3 eval/tier2_real_footage.py --data '/home/aditya/datasets/avenue/Avenue Dataset/testing_videos' --dataset 'CUHK Avenue (testing)' --width 320 --min-seconds 12 --max-seconds 90 --out eval/results/avenue_test_baseline`

## Alarm level: degraded

| Run | Detected | Median delay (s) |
|---|---|---|
| freeze | 16/16 | 1.0 |
| loop | 1/16 | 0.0 |
| blur | 16/16 | 0.0 |
| slow_blur | 16/16 | 3.5 |
| cover | 16/16 | 0.0 |
| partial_cover | 13/16 | 4.2 |
| moved | 16/16 | 0.0 |
| downscale | 16/16 | 0.0 |

Clean footage: 4 false alarms over 0.12 h (33.5 per hour), 3/16 videos with at least one.

## Alarm level: tripped

| Run | Detected | Median delay (s) |
|---|---|---|
| freeze | 16/16 | 1.0 |
| loop | 1/16 | 0.0 |
| blur | 16/16 | 0.0 |
| slow_blur | 0/16 | n/a |
| cover | 16/16 | 0.0 |
| partial_cover | 13/16 | 4.2 |
| moved | 2/16 | 13.2 |
| downscale | 16/16 | 0.0 |

Clean footage: 4 false alarms over 0.12 h (33.5 per hour), 3/16 videos with at least one.
