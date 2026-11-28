#!/usr/bin/env python3
"""
calibrate_thresholds.py: split-conformal calibration of a Tier 2 alarm threshold on CLEAN real footage
=======================================================================================================
The paper's gate thresholds (theta_low = 0.50, theta_high = 0.85) are design choices: the synthetic corpus could not
select them (flat sweep). This script asks a different, answerable question on real clean footage:

    "Which liveness threshold keeps the false-alarm rate on untouched video at or below a target, with a
     distribution-free guarantee, and how do 0.50 / 0.85 compare on the same footage?"

Input: the per-frame clean scores written by
    python eval/tier2_real_footage.py --clean-only --save-scores DIR ...   (one DIR/<clip>.npz per clip)

Method (split conformal, Angelopoulos & Bates, arXiv 2107.07511):
  1. Clips are split into a calibration set and a test set (by clip, never by frame, so neighbouring frames
     cannot leak across the split).
  2. Each clip's scores after its warm-up are cut into non-overlapping windows of --window-seconds. An alarm
     needs the score to stay at or below a threshold for --min-alarm-seconds (as in the harness), so each window
     gets one statistic m = the lowest level the score stays at or below for that long (the minimum over the
     window of the rolling maximum over min_len frames). A window raises an alarm at threshold t iff m <= t.
  3. With n calibration windows sorted m_(1) <= ... <= m_(n) and k = floor(alpha * (n + 1)), the threshold
     t = m_(k) minus a tiny epsilon gives P(alarm in a new clean window) <= k / (n + 1) <= alpha, provided the
     new window is exchangeable with the calibration windows. If k = 0 there are too few windows to certify
     alpha, and the script says so instead of guessing.
  4. The test set measures the empirical false-alarm rate at the calibrated threshold and at 0.50 and 0.85.

What it does NOT do: measure detection. Run the attack harness with `--extra-level calibrated=<t>` on held-out
tampered footage for that. The guarantee also breaks if the test footage differs systematically (new camera,
night vs day): report per condition. Never calibrate on the test split (CLAUDE.md rule 5).

Usage:
    python eval/calibrate_thresholds.py --scores eval/scores/meva_v2 --alpha 0.01 --window-seconds 60 \\
        --out eval/calibration/meva_v2

Write the output OUTSIDE eval/results/: /research lists every folder there as a tamper-detection run.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

PAPER_THRESHOLDS = {"theta_low (tripped)": 0.50, "theta_high (degraded)": 0.85}
EPS = 1e-6


def window_statistics(scores: np.ndarray, warm: int, fps: float, window_s: float, min_len: int) -> list[float]:
    """One statistic per full non-overlapping window after warm-up: lowest level sustained for min_len frames."""
    x = np.asarray(scores, dtype=np.float64)[warm:]
    win = int(round(window_s * fps))
    if win < min_len or len(x) < win:
        return []
    stats = []
    for start in range(0, len(x) - win + 1, win):
        w = x[start:start + win]
        # rolling maximum over min_len consecutive frames; the alarm needs all of them at or below t
        if min_len == 1:
            m = float(w.min())
        else:
            view = np.lib.stride_tricks.sliding_window_view(w, min_len)
            m = float(view.max(axis=1).min())
        stats.append(m)
    return stats


def split_clips(names: list[str], calib_fraction: float, salt: str) -> tuple[list[str], list[str]]:
    """Deterministic split by clip name (stable across runs and machines)."""
    calib, test = [], []
    for n in sorted(names):
        h = int(hashlib.sha256(f"{salt}:{n}".encode()).hexdigest(), 16) % 10_000
        (calib if h < calib_fraction * 10_000 else test).append(n)
    return calib, test


def conformal_threshold(calib_stats: list[float], alpha: float) -> tuple[float | None, int, int]:
    n = len(calib_stats)
    k = math.floor(alpha * (n + 1))
    if k < 1:
        return None, k, n
    m = sorted(calib_stats)
    return m[k - 1] - EPS, k, n


def alarm_rate(stats: list[float], t: float) -> float:
    return (sum(1 for m in stats if m <= t) / len(stats)) if stats else float("nan")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scores", required=True, type=Path, help="folder of <clip>.npz files from --save-scores")
    ap.add_argument("--alpha", type=float, default=0.01, help="target false-alarm probability per window")
    ap.add_argument("--window-seconds", type=float, default=60.0)
    ap.add_argument("--min-alarm-seconds", type=float, default=1.0, help="must match the harness setting")
    ap.add_argument("--calib-fraction", type=float, default=0.5)
    ap.add_argument("--salt", default="cobra-calibration", help="changes the deterministic clip split")
    ap.add_argument("--dataset", default=None, help="label recorded in the report")
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()

    if not (0 < args.alpha < 1) or not (0 < args.calib_fraction < 1):
        sys.exit("--alpha and --calib-fraction must be strictly between 0 and 1.")
    files = sorted(args.scores.glob("*.npz"))
    if not files:
        sys.exit(f"No .npz score files in {args.scores}. Produce them with tier2_real_footage.py --save-scores.")

    per_clip: dict[str, list[float]] = {}
    fps_seen = set()
    for f in files:
        z = np.load(f)
        fps = float(z["fps"])
        fps_seen.add(round(fps, 3))
        min_len = max(1, int(args.min_alarm_seconds * fps))
        per_clip[f.stem] = window_statistics(z["scores"], int(z["warm"]), fps, args.window_seconds, min_len)

    calib_names, test_names = split_clips(list(per_clip), args.calib_fraction, args.salt)
    calib = [m for n in calib_names for m in per_clip[n]]
    test = [m for n in test_names for m in per_clip[n]]
    if not calib or not test:
        sys.exit("Need clips with at least one full window on both sides of the split; add footage or shorten --window-seconds.")

    t, k, n = conformal_threshold(calib, args.alpha)
    per_hour = 3600.0 / args.window_seconds
    result = {
        "dataset": args.dataset or args.scores.resolve().name,
        "date_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "alpha_per_window": args.alpha,
        "window_seconds": args.window_seconds,
        "min_alarm_seconds": args.min_alarm_seconds,
        "fps_values": sorted(fps_seen),
        "calibration": {"clips": len(calib_names), "windows": n, "hours": round(n * args.window_seconds / 3600, 3)},
        "test": {"clips": len(test_names), "windows": len(test), "hours": round(len(test) * args.window_seconds / 3600, 3)},
        "conformal_k": k,
        "calibrated_threshold": None if t is None else round(t, 6),
        "guarantee": None if t is None else {
            "max_false_alarm_prob_per_window": round(k / (n + 1), 6),
            "max_expected_false_alarm_windows_per_hour": round(k / (n + 1) * per_hour, 4),
        },
        "test_alarm_rate_per_window": {},
    }
    if t is not None:
        result["test_alarm_rate_per_window"]["calibrated"] = round(alarm_rate(test, t), 6)
    for label, thr in PAPER_THRESHOLDS.items():
        result["test_alarm_rate_per_window"][label] = round(alarm_rate(test, thr), 6)

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "calibration.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    cmd = "python3 eval/calibrate_thresholds.py " + " ".join(sys.argv[1:])
    lines = [
        f"# Tier 2 threshold calibration (split conformal) on clean footage: {result['dataset']}",
        "",
        f"- Date: {result['date_utc']}",
        f"- Command: `{cmd}`",
        f"- Window: {args.window_seconds:g} s, alarm needs {args.min_alarm_seconds:g} s sustained, target alpha = {args.alpha:g} per window",
        f"- Calibration: {len(calib_names)} clips, {n} windows ({result['calibration']['hours']} h); "
        f"test: {len(test_names)} clips, {len(test)} windows ({result['test']['hours']} h)",
        "",
    ]
    if t is None:
        need = math.ceil(1 / args.alpha) - 1
        lines.append(f"**Not certifiable:** alpha = {args.alpha:g} needs at least {need} calibration windows; only {n} available.")
    else:
        lines += [
            f"- **Calibrated threshold:** alarm when liveness <= {t:.4f} (k = {k} of {n}).",
            f"- **Guarantee (exchangeable clean windows):** P(false alarm in a window) <= {k / (n + 1):.4f}, "
            f"i.e. at most {k / (n + 1) * per_hour:.3f} alarmed windows per hour on average.",
        ]
    lines += ["", "| Threshold | Liveness value | Test windows with an alarm |", "|---|---|---|"]
    if t is not None:
        lines.append(f"| calibrated | {t:.4f} | {alarm_rate(test, t):.4f} |")
    for label, thr in PAPER_THRESHOLDS.items():
        lines.append(f"| {label} | {thr:.2f} | {alarm_rate(test, thr):.4f} |")
    lines += ["", "Detection at the calibrated threshold is not measured here: re-run eval/tier2_real_footage.py with "
              "`--extra-level calibrated=<threshold>` on held-out tampered footage.", ""]
    (args.out / "calibration.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
