# Tier 2 on real footage: 14 videos, detector liveness_detector:FrameLivenessTracker

- Dataset: CUHK Avenue (training)
- Date: 2026-11-26 17:59:33 UTC
- Command: `python3 eval/tier2_real_footage.py --data '/home/aditya/datasets/avenue/Avenue Dataset/training_videos' --dataset 'CUHK Avenue (training)' --width 320 --min-seconds 12 --max-seconds 90 --out eval/results/avenue_train_baseline`

## Alarm level: degraded

| Run | Detected | Median delay (s) |
|---|---|---|
| freeze | 14/14 | 0.9 |
| loop | 0/14 | n/a |
| blur | 14/14 | 0.0 |
| slow_blur | 14/14 | 3.5 |
| cover | 14/14 | 0.0 |
| partial_cover | 13/14 | 2.6 |
| moved | 14/14 | 0.0 |
| downscale | 14/14 | 0.0 |

Clean footage: 6 false alarms over 0.13 h (45.9 per hour), 4/14 videos with at least one.

## Alarm level: tripped

| Run | Detected | Median delay (s) |
|---|---|---|
| freeze | 14/14 | 0.9 |
| loop | 0/14 | n/a |
| blur | 14/14 | 0.0 |
| slow_blur | 1/14 | 24.4 |
| cover | 14/14 | 0.0 |
| partial_cover | 13/14 | 2.6 |
| moved | 2/14 | 13.7 |
| downscale | 14/14 | 0.0 |

Clean footage: 6 false alarms over 0.13 h (45.9 per hour), 4/14 videos with at least one.
