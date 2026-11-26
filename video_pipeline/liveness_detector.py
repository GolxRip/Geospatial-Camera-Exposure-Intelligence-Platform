"""
video_pipeline/liveness_detector.py
===================================
Module G (Tier 2) — Frame-Level Visual Liveness & Tamper Detection
Literature:
  - Yilmazer & Karakose (2025): Image-quality & tampering trust modelling
  - Liu et al. (2025): Cross-view temporal baseline tracking

Responsibilities:
-----------------
1. Perceptual Hash (pHash) freeze & replay attack detection.
2. Rolling EWMA baseline tracking for blur (variance of Laplacian) & exposure drift.
3. Live frame spec verification against Shodan-declared metadata.
4. Composite Visual Liveness Score L(t) in [0.0, 1.0].

ETHICAL & ARCHITECTURAL SCOPE:
------------------------------
Operates ONLY on authorized local/whitelisted footage mapped in FOOTAGE_CAMERA_MAP.
Never probes or pulls frames from unauthorized Shodan targets.
"""

from __future__ import annotations

import cv2
import numpy as np
from typing import Any
from collections import deque


def compute_frame_phash(frame: np.ndarray, hash_size: int = 8) -> int:
    """
    Compute a 64-bit perceptual hash (pHash) for an image frame using DCT.

    Parameters
    ----------
    frame : np.ndarray
        BGR or Grayscale image.
    hash_size : int
        Size of the hash (default 8 -> 64-bit integer).

    Returns
    -------
    int
        64-bit perceptual hash.
    """
    if frame is None or frame.size == 0:
        return 0

    if len(frame.shape) == 3:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    else:
        gray = frame

    # Resize to (hash_size * 4, hash_size * 4) for DCT analysis
    resized = cv2.resize(gray, (hash_size * 4, hash_size * 4), interpolation=cv2.INTER_AREA)
    float_img = np.float32(resized)
    dct = cv2.dct(float_img)

    # Extract low frequency top-left DCT block (excluding DC term at [0,0])
    dct_low = dct[:hash_size, :hash_size]
    med = np.median(dct_low)
    bit_matrix = (dct_low > med).flatten()

    # Convert boolean array to integer
    hash_val = 0
    for bit in bit_matrix:
        hash_val = (hash_val << 1) | int(bit)

    return int(hash_val)


def hamming_distance(hash1: int, hash2: int) -> int:
    """Calculate the Hamming distance (number of differing bits) between two 64-bit hashes."""
    return bin(hash1 ^ hash2).count("1")


def compute_laplacian_blur(frame: np.ndarray) -> float:
    """
    Compute the variance of the Laplacian of an image (standard focus/blur metric).
    Higher variance indicates sharp edges; low variance indicates blur/defocus/occlusion.
    """
    if frame is None or frame.size == 0:
        return 0.0

    if len(frame.shape) == 3:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    else:
        gray = frame

    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    return float(laplacian.var())


def compute_exposure_histogram_metric(frame: np.ndarray) -> dict[str, float]:
    """
    Compute brightness and contrast metrics.
    """
    if frame is None or frame.size == 0:
        return {"mean_brightness": 0.0, "contrast_std": 0.0}

    if len(frame.shape) == 3:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    else:
        gray = frame

    return {
        "mean_brightness": float(np.mean(gray)),
        "contrast_std": float(np.std(gray)),
    }


def _extract_gray(frame: np.ndarray) -> np.ndarray:
    if len(frame.shape) == 3:
        return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return frame


def _extract_compact_features(
    gray: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Compute strided luma sample, 16x16 & 32x32 thumbnails, 32x32 edge magnitude, and 4x4 block stats."""
    sample = gray[::4, ::4].astype(np.int16)
    thumb_32 = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA)
    thumb_16 = cv2.resize(thumb_32, (16, 16), interpolation=cv2.INTER_AREA).astype(np.int16).ravel()
    blocks = thumb_32.astype(np.float32).reshape(4, 8, 4, 8)
    block_means = blocks.mean(axis=(1, 3)).ravel()
    block_stds = blocks.std(axis=(1, 3)).ravel()
    thumb_32_f = thumb_32.astype(np.float32)
    gx = cv2.Sobel(thumb_32_f, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(thumb_32_f, cv2.CV_32F, 0, 1, ksize=3)
    edges_32 = np.hypot(gx, gy).ravel()
    return sample, thumb_16, thumb_32_f.ravel(), edges_32, block_means, block_stds


def _pearson_corr(a: np.ndarray, b: np.ndarray) -> float:
    """Zero-safe Pearson correlation between flattened float/int thumbnail vectors."""
    fa = a.astype(np.float32) - float(np.mean(a))
    fb = b.astype(np.float32) - float(np.mean(b))
    na = float(np.linalg.norm(fa))
    nb = float(np.linalg.norm(fb))
    if na < 1e-3 or nb < 1e-3:
        return 1.0 if float(np.mean(np.abs(a.astype(np.float32) - b.astype(np.float32)))) < 2.0 else 0.0
    return float(np.dot(fa, fb) / (na * nb))


class FrameLivenessTracker:
    """
    Stateful rolling-window frame liveness & signal integrity tracker for a camera stream.
    """

    # Tuning documented on CUHK Avenue training_videos (14 clips); testing_videos held out.
    _FREEZE_PIXEL_MAD_MAX = 0.25
    _ANCHOR_ALPHA_WARMUP = 0.05
    _ANCHOR_ALPHA_STEADY = 0.002
    _REF_ALPHA_STEADY = 0.005

    def __init__(
        self,
        camera_id: str,
        window_size: int = 30,
        freeze_dist_threshold: int = 1,
        consecutive_freeze_frames: int = 25,
        declared_resolution: str | None = None,
    ):
        self.camera_id = camera_id
        self.window_size = window_size
        self.freeze_dist_threshold = freeze_dist_threshold
        self.consecutive_freeze_frames = consecutive_freeze_frames
        self.declared_resolution = declared_resolution

        self.hash_history: deque[int] = deque(maxlen=window_size)
        self.blur_history: deque[float] = deque(maxlen=window_size)
        self.brightness_history: deque[float] = deque(maxlen=window_size)

        self.freeze_counter: int = 0
        self.is_frozen: bool = False
        self.ewma_blur: float | None = None
        self.ewma_alpha: float = 0.05

        self._prev_sample: np.ndarray | None = None
        self._prev_thumb_16: np.ndarray | None = None

        # Multi-second cyclic replay (RTSP loop) ring buffer (~18s @ 25 fps)
        self._loop_maxlen: int = max(450, window_size * 15)
        self._loop_buf = np.zeros((self._loop_maxlen * 2, 256), dtype=np.int16)
        self._loop_hashes: list[int] = [0] * (self._loop_maxlen * 2)
        self._loop_start: int = 0
        self._loop_end: int = 0
        self._lag_streaks: dict[int, int] = {}
        self._lag_motion: dict[int, float] = {}
        self.is_looped: bool = False

        # Anchored cleanliness baselines (resist slow_blur chasing & permanent cover collapse)
        self._frames_seen: int = 0
        self._anchor_blur: float | None = None
        self._anchor_contrast: float | None = None
        self._anchor_block_means: np.ndarray | None = None
        self._anchor_block_stds: np.ndarray | None = None
        self._partial_cover_counter: int = 0
        self.is_occluded: bool = False

        # Coherent background anchor (only enabled once stream shows real spatial continuity)
        self._coherent_warmup: int = 0
        self._scene_anchored: bool = False
        self._ref_thumb_32: np.ndarray | None = None
        self._ref_edges_32: np.ndarray | None = None
        self._displacement_counter: int = 0
        self.is_scene_shifted: bool = False

    def _update_loop_detector(
        self,
        thumb_16: np.ndarray,
        current_hash: int,
        sample_mad: float,
    ) -> bool:
        """Detect cyclic replay of prior moving footage across lags up to _loop_maxlen frames."""
        min_lag = min(15, max(5, self.consecutive_freeze_frames // 2))
        loop_confirm = min(12, max(5, self.consecutive_freeze_frames // 2))

        step_mad_16 = (
            float(np.mean(np.abs(thumb_16 - self._prev_thumb_16)))
            if self._prev_thumb_16 is not None
            else 0.0
        )

        hist_len = self._loop_end - self._loop_start
        detected = False
        if hist_len >= min_lag and sample_mad > self._FREEZE_PIXEL_MAD_MAX:
            past = self._loop_buf[self._loop_start : self._loop_end - min_lag + 1]
            mads = np.mean(np.abs(past - thumb_16), axis=1)
            matched_idx = np.where(mads <= 1.2)[0]
            # If >40 lags match simultaneously, scene is still/blank rather than a moving loop
            if 0 < matched_idx.size <= 40:
                next_streaks: dict[int, int] = {}
                next_motion: dict[int, float] = {}
                for idx in matched_idx:
                    ring_pos = self._loop_start + int(idx)
                    lag = self._loop_end - ring_pos
                    if hamming_distance(current_hash, self._loop_hashes[ring_pos]) <= 2:
                        streak = self._lag_streaks.get(lag, 0) + 1
                        motion = self._lag_motion.get(lag, 0.0) + step_mad_16
                        next_streaks[lag] = streak
                        next_motion[lag] = motion
                        if streak >= loop_confirm and motion >= loop_confirm * 0.30:
                            detected = True
                self._lag_streaks = next_streaks
                self._lag_motion = next_motion
            else:
                self._lag_streaks.clear()
                self._lag_motion.clear()
        elif sample_mad <= self._FREEZE_PIXEL_MAD_MAX:
            self._lag_streaks.clear()
            self._lag_motion.clear()

        if self._loop_end == len(self._loop_hashes):
            keep = self._loop_maxlen
            self._loop_buf[:keep] = self._loop_buf[self._loop_end - keep : self._loop_end]
            self._loop_hashes[:keep] = self._loop_hashes[self._loop_end - keep : self._loop_end]
            self._loop_start = 0
            self._loop_end = keep

        self._loop_buf[self._loop_end] = thumb_16
        self._loop_hashes[self._loop_end] = current_hash
        self._loop_end += 1
        if self._loop_end - self._loop_start > self._loop_maxlen:
            self._loop_start = self._loop_end - self._loop_maxlen

        return detected

    def process_frame(
        self,
        frame: np.ndarray,
        frame_idx: int,
        timestamp_s: float,
    ) -> dict[str, Any]:
        """
        Process a single video frame, update rolling statistics, and compute
        Tier 2 Visual Liveness Score L(t).
        """
        if frame is None or frame.size == 0:
            return {
                "liveness_score": 0.0,
                "freeze_detected": True,
                "loop_detected": False,
                "occlusion_detected": False,
                "scene_shifted": False,
                "quality_drift": 1.0,
                "spec_mismatch": True,
                "factors": ["empty_frame_received"],
            }

        h, w = frame.shape[:2]
        gray = _extract_gray(frame)
        sample, thumb_16, thumb_32, edges_32, block_means, block_stds = _extract_compact_features(gray)

        # 1. Perceptual Hash + Pixel-Diff Freeze & Cyclic Loop Detection
        current_hash = compute_frame_phash(gray)
        if self._prev_sample is not None and self._prev_sample.shape == sample.shape:
            sample_mad = float(np.mean(np.abs(sample - self._prev_sample)))
        else:
            sample_mad = 999.0

        if self.hash_history:
            prev_hash = self.hash_history[-1]
            dist = hamming_distance(current_hash, prev_hash)
            if dist <= self.freeze_dist_threshold and sample_mad <= self._FREEZE_PIXEL_MAD_MAX:
                self.freeze_counter += 1
            else:
                self.freeze_counter = 0
        else:
            self.freeze_counter = 0

        self.is_frozen = self.freeze_counter >= self.consecutive_freeze_frames
        self.hash_history.append(current_hash)
        self.is_looped = self._update_loop_detector(thumb_16, current_hash, sample_mad)
        self._prev_sample = sample

        # 2. Blur / Quality Drift & Persistent Occlusion Tracking
        blur_val = compute_laplacian_blur(gray)
        exp_metrics = compute_exposure_histogram_metric(gray)
        contrast_std = exp_metrics["contrast_std"]
        self.brightness_history.append(exp_metrics["mean_brightness"])
        self.blur_history.append(blur_val)

        if self._anchor_blur is None:
            self._anchor_blur = blur_val
            self._anchor_contrast = contrast_std
            self.ewma_blur = blur_val

        assert self._anchor_blur is not None and self._anchor_contrast is not None
        assert self.ewma_blur is not None

        # Full lens cover after a textured/lit baseline was established (dark rooms from frame 0 stay exempt)
        baseline_textured = self._anchor_blur > 10.0 and self._anchor_contrast >= 10.0
        full_cover_now = (
            baseline_textured
            and contrast_std < max(5.0, 0.25 * self._anchor_contrast)
            and blur_val < max(8.0, 0.15 * self._anchor_blur)
        )

        # Update scene coherence lock (prevents synthetic i.i.d. noise from triggering spatial checks)
        if self._prev_thumb_16 is not None:
            inter_corr = _pearson_corr(thumb_16, self._prev_thumb_16)
            if inter_corr >= 0.75:
                self._coherent_warmup += 1
            else:
                self._coherent_warmup = 0
            if not self._scene_anchored and self._coherent_warmup >= 10:
                self._scene_anchored = True
                self._ref_thumb_32 = thumb_32.copy()
                self._ref_edges_32 = edges_32.copy()
                self._anchor_block_means = block_means.copy()
                self._anchor_block_stds = block_stds.copy()

        # Partial lens cover check across 4x4 grid once coherent background is anchored
        partial_cover_now = False
        if (
            self._scene_anchored
            and self._anchor_block_stds is not None
            and self._anchor_block_means is not None
        ):
            had_texture = self._anchor_block_stds >= 5.0
            now_flat = (block_stds < 2.0) & (np.abs(block_means - self._anchor_block_means) >= 15.0)
            dead_blocks = int(np.sum(had_texture & now_flat))
            if dead_blocks >= 4:
                self._partial_cover_counter += 1
            else:
                self._partial_cover_counter = max(0, self._partial_cover_counter - 1)
            partial_cover_now = self._partial_cover_counter >= min(20, self.consecutive_freeze_frames)

        # Camera displaced / pointed elsewhere (sustained structural edge + layout decorrelation)
        if (
            self._scene_anchored
            and self._ref_thumb_32 is not None
            and self._ref_edges_32 is not None
            and not full_cover_now
        ):
            scene_corr = _pearson_corr(thumb_32, self._ref_thumb_32)
            edge_corr = _pearson_corr(edges_32, self._ref_edges_32)
            if edge_corr < 0.50 or scene_corr < 0.60:
                self._displacement_counter += 1
            else:
                self._displacement_counter = max(0, self._displacement_counter - 2)
            disp_confirm = max(45, self.consecutive_freeze_frames * 2)
            self.is_scene_shifted = self._displacement_counter >= disp_confirm
            if (
                edge_corr >= 0.65
                and scene_corr >= 0.70
                and not (self.is_frozen or self.is_looped or partial_cover_now)
            ):
                self._ref_thumb_32 = (
                    self._REF_ALPHA_STEADY * thumb_32
                    + (1.0 - self._REF_ALPHA_STEADY) * self._ref_thumb_32
                )
                self._ref_edges_32 = (
                    self._REF_ALPHA_STEADY * edges_32
                    + (1.0 - self._REF_ALPHA_STEADY) * self._ref_edges_32
                )
        else:
            scene_corr = 1.0
            edge_corr = 1.0
            self.is_scene_shifted = False

        self.is_occluded = full_cover_now or partial_cover_now

        # Freeze baselines during active tamper/blur/freeze so slow_blur & cover cannot self-normalize
        healthy_frame = (
            not self.is_frozen
            and not self.is_looped
            and not full_cover_now
            and not partial_cover_now
            and not self.is_scene_shifted
            and blur_val >= 0.75 * self._anchor_blur
        )
        if healthy_frame:
            alpha = self._ANCHOR_ALPHA_WARMUP if self._frames_seen < 25 else self._ANCHOR_ALPHA_STEADY
            self._anchor_blur = alpha * blur_val + (1.0 - alpha) * self._anchor_blur
            self._anchor_contrast = alpha * contrast_std + (1.0 - alpha) * self._anchor_contrast
            self.ewma_blur = self.ewma_alpha * blur_val + (1.0 - self.ewma_alpha) * self.ewma_blur
            if self._anchor_block_stds is not None and scene_corr >= 0.65 and edge_corr >= 0.65:
                self._anchor_block_stds = 0.005 * block_stds + 0.995 * self._anchor_block_stds
                self._anchor_block_means = 0.005 * block_means + 0.995 * self._anchor_block_means
        elif not full_cover_now and not partial_cover_now and self._anchor_blur <= 10.0:
            # Keep legitimate low-light room baseline tracked smoothly under the <= 10.0 guard
            self.ewma_blur = self.ewma_alpha * blur_val + (1.0 - self.ewma_alpha) * self.ewma_blur

        ref_blur = max(self.ewma_blur, self._anchor_blur)
        if ref_blur > 10.0:
            quality_drift = max(0.0, min(1.0, 1.0 - (blur_val / ref_blur)))
        else:
            quality_drift = 0.0

        self._prev_thumb_16 = thumb_16
        self._frames_seen += 1

        # 3. Declared Spec Mismatch (Resolution verification)
        spec_mismatch = False
        if self.declared_resolution:
            dec = self.declared_resolution.lower()
            if "1080" in dec and (h < 720 or w < 1280):
                spec_mismatch = True
            elif "720" in dec and (h < 480 or w < 640):
                spec_mismatch = True
            elif "4k" in dec and (h < 1080 or w < 1920):
                spec_mismatch = True

        # 4. Composite L(t) = 1 - max(1.0 * Tamper/Freeze, 0.60 * QualityDrift, 0.50 * SpecMismatch)
        w_freeze, w_quality, w_spec = 1.0, 0.60, 0.50
        stream_compromised = self.is_frozen or self.is_looped or self.is_occluded or self.is_scene_shifted
        penalty = max(
            (1.0 if stream_compromised else 0.0) * w_freeze,
            quality_drift * w_quality,
            (1.0 if spec_mismatch else 0.0) * w_spec,
        )
        liveness_score = max(0.0, min(1.0, 1.0 - penalty))

        factors = []
        if self.is_frozen:
            factors.append(f"freeze_attack_detected_{self.freeze_counter}_frames")
        if self.is_looped:
            factors.append("replay_loop_detected")
        if full_cover_now:
            factors.append("lens_occlusion_detected")
        elif partial_cover_now:
            factors.append("partial_lens_occlusion_detected")
        if self.is_scene_shifted:
            factors.append("camera_displacement_detected")
        if quality_drift > 0.40:
            factors.append(f"quality_degradation_blur_{blur_val:.1f}_vs_base_{ref_blur:.1f}")
        if spec_mismatch:
            factors.append(f"spec_mismatch_live_{w}x{h}_vs_{self.declared_resolution}")

        return {
            "liveness_score": round(liveness_score, 4),
            "freeze_detected": self.is_frozen,
            "loop_detected": self.is_looped,
            "occlusion_detected": self.is_occluded,
            "scene_shifted": self.is_scene_shifted,
            "freeze_consecutive_frames": self.freeze_counter,
            "quality_drift": round(quality_drift, 4),
            "laplacian_blur": round(blur_val, 2),
            "ewma_blur_baseline": round(self.ewma_blur, 2),
            "spec_mismatch": spec_mismatch,
            "frame_dimensions": (w, h),
            "factors": factors,
            "frame_idx": frame_idx,
            "timestamp_s": timestamp_s,
        }
