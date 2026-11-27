# FrameLivenessTracker Speed Benchmark

- **Date (UTC):** 2026-11-27 15:37:37 UTC
- **CPU:** 12th Gen Intel(R) Core(TM) i5-12450H (6 logical cores)
- **Python:** 3.13.9 | **OpenCV:** 5.0.0 | **NumPy:** 2.3.5
- **OS:** Linux-6.16.8+kali-amd64-x86_64-with-glibc2.43
- **Workload:** 300 measured frames (+ 30 warmup) per run; frame source: `real_dataset:testing_videos (1 clip(s), 330 unique)`

| Detector | Width | FPS | Mean (ms/frame) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|---:|
| `liveness_detector_v1:FrameLivenessTracker` | 320 px | **1776.7** | 0.562 | 0.484 | 1.004 |
| `liveness_detector_v1:FrameLivenessTracker` | 640 px | **67.7** | 14.765 | 14.314 | 18.866 |
| `liveness_detector:FrameLivenessTracker` | 320 px | **242.7** | 4.119 | 3.664 | 7.536 |
| `liveness_detector:FrameLivenessTracker` | 640 px | **59.9** | 16.691 | 16.202 | 23.179 |
