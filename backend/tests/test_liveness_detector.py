"""
test_liveness_detector.py
=========================
Unit tests for video_pipeline/liveness_detector.py.
Verifies:
  1. pHash calculation and hamming distance between identical and perturbed frames.
  2. FrameLivenessTracker freeze detection across consecutive identical frames.
  3. Variance of Laplacian blur tracking and quality degradation flags.
  4. Declared spec mismatch detection.
"""

import numpy as np
import pytest
from video_pipeline.liveness_detector import (
    compute_frame_phash,
    hamming_distance,
    compute_laplacian_blur,
    compute_exposure_histogram_metric,
    FrameLivenessTracker,
)


def test_phash_and_hamming_distance():
    """Verify pHash distance is 0 for identical frames and > 0 for different frames."""
    # Frame 1: gradient pattern
    f1 = np.zeros((240, 320, 3), dtype=np.uint8)
    for y in range(240):
        f1[y, :, 0] = y % 256
        f1[y, :, 1] = (y * 2) % 256

    # Frame 2: identical to Frame 1
    f2 = np.copy(f1)

    # Frame 3: completely different random noise
    np.random.seed(42)
    f3 = np.random.randint(0, 256, (240, 320, 3), dtype=np.uint8)

    h1 = compute_frame_phash(f1)
    h2 = compute_frame_phash(f2)
    h3 = compute_frame_phash(f3)

    assert hamming_distance(h1, h2) == 0
    assert hamming_distance(h1, h3) > 5


def test_frame_liveness_tracker_freeze_detection():
    """Verify tracker identifies a frozen/looped feed after consecutive frozen frames."""
    tracker = FrameLivenessTracker(
        camera_id="CAM_TEST_01",
        window_size=30,
        freeze_dist_threshold=1,
        consecutive_freeze_frames=10,
        declared_resolution="1080p",
    )

    static_frame = np.ones((1080, 1920, 3), dtype=np.uint8) * 128
    # Draw some features for nonzero laplacian
    static_frame[100:300, 100:300] = 255
    static_frame[500:800, 500:800] = 0

    # Feed 15 identical frames
    for i in range(15):
        res = tracker.process_frame(static_frame, frame_idx=i, timestamp_s=i * 0.1)

    # By frame 15 (> 10 consecutive), freeze must be detected
    assert res["freeze_detected"] is True
    assert res["liveness_score"] <= 0.50
    assert any("freeze_attack_detected" in f for f in res["factors"])


def test_frame_liveness_tracker_quality_drift():
    """Verify tracker detects blur degradation."""
    tracker = FrameLivenessTracker(
        camera_id="CAM_TEST_02",
        window_size=30,
        consecutive_freeze_frames=20,
    )

    # Sharp frames with high frequency texture
    np.random.seed(123)
    sharp_frame = np.random.randint(0, 256, (480, 640, 3), dtype=np.uint8)

    # Establish baseline
    for i in range(10):
        tracker.process_frame(sharp_frame, frame_idx=i, timestamp_s=i * 0.1)

    # Now introduce heavily blurred frame (defocus attack or lens occlusion)
    import cv2
    blurred_frame = cv2.GaussianBlur(sharp_frame, (51, 51), 0)
    res_blurred = tracker.process_frame(blurred_frame, frame_idx=11, timestamp_s=1.1)

    assert res_blurred["quality_drift"] > 0.50
    assert res_blurred["liveness_score"] < 1.0


def test_frame_liveness_tracker_spec_mismatch():
    """Verify tracker catches live 480p feed when camera declared 4K/1080p."""
    tracker = FrameLivenessTracker(
        camera_id="CAM_TEST_03",
        declared_resolution="1080p",
    )

    low_res_frame = np.ones((480, 640, 3), dtype=np.uint8) * 100
    res = tracker.process_frame(low_res_frame, frame_idx=0, timestamp_s=0.0)

    assert res["spec_mismatch"] is True
    assert any("spec_mismatch" in f for f in res["factors"])


def _synthetic_coherent_scene(step: int, width: int = 320, height: int = 240, rng_seed: int = 7) -> np.ndarray:
    """Create a structured surveillance-like background with non-wrapping moving subjects + sensor grain."""
    rng = np.random.default_rng(rng_seed + step)
    frame = np.full((height, width, 3), 90, dtype=np.uint8)
    # Static structural bands (buildings / road)
    frame[20:90, 20:140] = (170, 175, 180)
    frame[110:210, 160:300] = (45, 50, 55)
    # Two moving boxes at coprime speeds so frames stay distinct until an actual loop replay
    x = 10 + (step * 2) % (width - 40)
    y2 = 20 + (step * 3) % (height - 40)
    frame[130:190, x : x + 22] = (210, 140, 80)
    frame[y2 : y2 + 24, 90:118] = (70, 190, 220)
    noise = rng.integers(-2, 3, size=frame.shape, dtype=np.int16)
    return np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)


def test_static_live_scene_with_sensor_jitter_not_frozen():
    """Real static surveillance frame with sensor noise must NOT trip freeze even if pHash stays close."""
    tracker = FrameLivenessTracker(camera_id="CAM_STATIC_JITTER", consecutive_freeze_frames=15)
    rng = np.random.default_rng(99)
    base = np.full((240, 320, 3), 120, dtype=np.uint8)
    base[40:120, 60:180] = 200
    base[140:200, 190:270] = 40

    for i in range(45):
        jitter = rng.integers(-2, 3, size=base.shape, dtype=np.int16)
        frame = np.clip(base.astype(np.int16) + jitter, 0, 255).astype(np.uint8)
        res = tracker.process_frame(frame, frame_idx=i, timestamp_s=i / 25.0)
        assert res["freeze_detected"] is False
        assert res["loop_detected"] is False


def test_frame_liveness_tracker_loop_detection():
    """Tracker detects multi-second cyclic replay loops over moving footage."""
    tracker = FrameLivenessTracker(camera_id="CAM_LOOP_01", consecutive_freeze_frames=25)
    history = [_synthetic_coherent_scene(i) for i in range(90)]
    for i, f in enumerate(history):
        res = tracker.process_frame(f, frame_idx=i, timestamp_s=i / 25.0)
        assert res["loop_detected"] is False

    # Replay a 60-frame segment from before onset
    seg = history[30:90]
    caught = False
    for j in range(60):
        idx = 90 + j
        res = tracker.process_frame(seg[j % len(seg)], frame_idx=idx, timestamp_s=idx / 25.0)
        if res["loop_detected"] and res["liveness_score"] <= 0.50:
            caught = True
            break
    assert caught is True


def test_frame_liveness_tracker_sustained_cover_no_recovery():
    """Sustained dark cover must not silently recover to 1.0 after EWMA decay."""
    tracker = FrameLivenessTracker(camera_id="CAM_COVER_01", consecutive_freeze_frames=25)
    for i in range(30):
        tracker.process_frame(_synthetic_coherent_scene(i), frame_idx=i, timestamp_s=i / 25.0)

    rng = np.random.default_rng(0)
    last = None
    for j in range(150):
        dark = np.full((240, 320, 3), 18, dtype=np.uint8)
        noise = rng.integers(0, 6, size=dark.shape, dtype=np.uint8)
        last = tracker.process_frame(np.clip(dark + noise, 0, 255).astype(np.uint8), frame_idx=30 + j, timestamp_s=(30 + j) / 25.0)
    assert last is not None
    assert last["occlusion_detected"] is True
    assert last["liveness_score"] <= 0.50


def test_frame_liveness_tracker_slow_blur_reaches_tripped():
    """Gradual defocus must stay anchored to crisp baseline and eventually trip <= 0.50."""
    import cv2

    tracker = FrameLivenessTracker(camera_id="CAM_SLOW_BLUR", consecutive_freeze_frames=25)
    base = np.zeros((240, 320, 3), dtype=np.uint8)
    for r in range(0, 240, 8):
        for c in range(0, 320, 8):
            base[r : r + 8, c : c + 8] = 230 if ((r // 8 + c // 8) % 2 == 0) else 25

    for i in range(30):
        tracker.process_frame(base.copy(), frame_idx=i, timestamp_s=i / 25.0)

    tripped = False
    for step in range(1, 120):
        sigma = 0.2 + 5.5 * (step / 120.0)
        blurred = cv2.GaussianBlur(base, (0, 0), sigma)
        res = tracker.process_frame(blurred, frame_idx=30 + step, timestamp_s=(30 + step) / 25.0)
        if res["liveness_score"] <= 0.50:
            tripped = True
            break
    assert tripped is True


def test_frame_liveness_tracker_scene_displacement():
    """Camera physically shifted/rotated to another view must trip scene_shifted."""
    import cv2

    tracker = FrameLivenessTracker(camera_id="CAM_MOVED_01", consecutive_freeze_frames=25)
    for i in range(40):
        res = tracker.process_frame(_synthetic_coherent_scene(i), frame_idx=i, timestamp_s=i / 25.0)
        assert res["scene_shifted"] is False

    m = cv2.getRotationMatrix2D((160, 120), 15, 1.3)
    m[0, 2] += 70
    shifted_tripped = False
    for j in range(80):
        idx = 40 + j
        warped = cv2.warpAffine(_synthetic_coherent_scene(idx), m, (320, 240), borderMode=cv2.BORDER_REFLECT)
        res = tracker.process_frame(warped, frame_idx=idx, timestamp_s=idx / 25.0)
        if res["scene_shifted"] and res["liveness_score"] <= 0.50:
            shifted_tripped = True
            break
    assert shifted_tripped is True
