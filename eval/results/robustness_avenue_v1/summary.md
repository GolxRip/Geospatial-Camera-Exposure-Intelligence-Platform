# Tier 2 robustness sweep (unseen variants): 16 videos, detector liveness_detector_v1:FrameLivenessTracker

- Dataset: CUHK Avenue (testing, robustness sweep v1)
- Date: 2026-11-27 15:14:18 UTC
- Clips: 16 evaluated, 5 dropped (< 12s)
- Command: `python3 eval/robustness_sweep.py --data '/home/aditya/datasets/avenue/Avenue Dataset/testing_videos' --dataset 'CUHK Avenue (testing, robustness sweep v1)' --detector liveness_detector_v1:FrameLivenessTracker --width 320 --min-seconds 12 --max-seconds 90 --out eval/results/robustness_avenue_v1`

## Alarm level: degraded

| Run | Detected | Median delay (s) |
|---|---|---|
| loop_2s | 1/16 | 0.0 |
| loop_10s | 1/16 | 0.0 |
| loop_30s | 2/16 | 3.5 |
| blur_sigma2 | 16/16 | 0.0 |
| blur_sigma4 | 16/16 | 0.0 |
| blur_sigma8 | 16/16 | 0.0 |
| slow_blur_20s | 16/16 | 1.0 |
| slow_blur_120s | 0/16 | n/a |
| cover_semi_transparent | 16/16 | 0.0 |
| partial_cover_small | 0/16 | n/a |

Clean footage: 4 false alarms over 0.12 h (33.5 per hour), 3/16 videos with at least one.

## Alarm level: tripped

| Run | Detected | Median delay (s) |
|---|---|---|
| loop_2s | 1/16 | 0.0 |
| loop_10s | 1/16 | 0.0 |
| loop_30s | 2/16 | 3.5 |
| blur_sigma2 | 16/16 | 0.0 |
| blur_sigma4 | 16/16 | 0.0 |
| blur_sigma8 | 16/16 | 0.0 |
| slow_blur_20s | 0/16 | n/a |
| slow_blur_120s | 0/16 | n/a |
| cover_semi_transparent | 16/16 | 0.0 |
| partial_cover_small | 0/16 | n/a |

Clean footage: 4 false alarms over 0.12 h (33.5 per hour), 3/16 videos with at least one.
