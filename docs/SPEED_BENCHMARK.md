# FrameLivenessTracker Speed Benchmark

- **Date (UTC):** 2026-11-27 03:27:13 UTC
- **CPU:** 12th Gen Intel(R) Core(TM) i5-12450H (12 logical cores)
- **Python:** 3.12.6 | **OpenCV:** 5.0.0 | **NumPy:** 2.4.4
- **OS:** Windows-11-10.0.26300-SP0
- **Workload:** 300 measured frames (+ 30 warmup) per run; frame source: `synthetic_pattern (320x180)`

| Detector | Width | FPS | Mean (ms/frame) | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|---:|
| `liveness_detector_v1:FrameLivenessTracker` | 320 px | **606.8** | 1.647 | 1.64 | 2.062 |
| `liveness_detector_v1:FrameLivenessTracker` | 640 px | **84.8** | 11.788 | 11.692 | 13.018 |
| `liveness_detector:FrameLivenessTracker` | 320 px | **281.9** | 3.546 | 3.484 | 4.131 |
| `liveness_detector:FrameLivenessTracker` | 640 px | **71.2** | 14.036 | 14.079 | 15.776 |
