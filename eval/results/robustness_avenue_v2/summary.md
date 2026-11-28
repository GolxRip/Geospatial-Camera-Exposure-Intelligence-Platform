# Tier 2 robustness sweep (unseen variants): 16 videos, detector liveness_detector:FrameLivenessTracker

- Dataset: CUHK Avenue (testing, robustness sweep v2)
- Date: 2026-11-27 15:24:01 UTC
- Clips: 16 evaluated, 5 dropped (< 12s)
- Command: `python3 eval/robustness_sweep.py --data '/home/aditya/datasets/avenue/Avenue Dataset/testing_videos' --dataset 'CUHK Avenue (testing, robustness sweep v2)' --detector liveness_detector:FrameLivenessTracker --width 320 --min-seconds 12 --max-seconds 90 --out eval/results/robustness_avenue_v2`

## Alarm level: degraded

| Run | Detected | Median delay (s) |
|---|---|---|
| loop_2s | 15/16 | 0.6 |
| loop_10s | 15/16 | 0.6 |
| loop_30s | 10/16 | 0.6 |
| blur_sigma2 | 16/16 | 0.0 |
| blur_sigma4 | 16/16 | 0.0 |
| blur_sigma8 | 16/16 | 0.0 |
| slow_blur_20s | 16/16 | 1.0 |
| slow_blur_120s | 16/16 | 6.0 |
| cover_semi_transparent | 16/16 | 0.0 |
| partial_cover_small | 0/16 | n/a |

Clean footage: 1 false alarms over 0.12 h (8.4 per hour), 1/16 videos with at least one.

## Alarm level: tripped

| Run | Detected | Median delay (s) |
|---|---|---|
| loop_2s | 15/16 | 0.6 |
| loop_10s | 15/16 | 0.6 |
| loop_30s | 10/16 | 0.6 |
| blur_sigma2 | 16/16 | 0.0 |
| blur_sigma4 | 16/16 | 0.0 |
| blur_sigma8 | 16/16 | 0.0 |
| slow_blur_20s | 16/16 | 2.0 |
| slow_blur_120s | 13/16 | 11.8 |
| cover_semi_transparent | 16/16 | 0.0 |
| partial_cover_small | 0/16 | n/a |

Clean footage: 0 false alarms over 0.12 h (0.0 per hour), 0/16 videos with at least one.
