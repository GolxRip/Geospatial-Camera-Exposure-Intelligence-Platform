# Tier 2 on real footage: 14 videos, detector liveness_detector:FrameLivenessTracker

- Dataset: CUHK Avenue (training, tuned)
- Date: 2026-11-26 19:05:12 UTC
- Command: `python3 eval/tier2_real_footage.py --data '/home/aditya/datasets/avenue/Avenue Dataset/training_videos' --dataset 'CUHK Avenue (training, tuned)' --width 320 --min-seconds 12 --max-seconds 90 --out eval/results/avenue_train_tuned`

## Alarm level: degraded

| Run | Detected | Median delay (s) |
|---|---|---|
| freeze | 14/14 | 1.0 |
| loop | 14/14 | 0.6 |
| blur | 14/14 | 0.0 |
| slow_blur | 14/14 | 3.1 |
| cover | 14/14 | 0.0 |
| partial_cover | 14/14 | 0.8 |
| moved | 14/14 | 0.0 |
| downscale | 14/14 | 0.0 |

Clean footage: 0 false alarms over 0.13 h (0.0 per hour), 0/14 videos with at least one.

## Alarm level: tripped

| Run | Detected | Median delay (s) |
|---|---|---|
| freeze | 14/14 | 1.0 |
| loop | 14/14 | 0.6 |
| blur | 14/14 | 0.0 |
| slow_blur | 14/14 | 5.9 |
| cover | 14/14 | 0.0 |
| partial_cover | 14/14 | 0.8 |
| moved | 14/14 | 2.0 |
| downscale | 14/14 | 0.0 |

Clean footage: 0 false alarms over 0.13 h (0.0 per hour), 0/14 videos with at least one.
