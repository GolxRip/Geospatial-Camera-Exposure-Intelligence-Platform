"""Run FrameLivenessTracker across unseen attack parameter variants on real footage.

This sweep tests whether frozen v2 generalizes beyond the default attack parameters used in
eval/tier2_real_footage.py without modifying the detector itself. Outputs match the exact CSV/Markdown
schema (per_run.csv, summary.csv, summary.md) of eval/tier2_real_footage.py.

Variants evaluated (in addition to clean baseline):
  - loop_2s, loop_10s, loop_30s     : replay segments of 2 s, 10 s, and 30 s
  - blur_sigma2, blur_sigma4, blur_sigma8 : sudden Gaussian defocus with sigma 2, 4, and 8
  - slow_blur_20s, slow_blur_120s  : faster (20 s) and slower (120 s) cumulative focus ramps
  - cover_semi_transparent         : hazy semi-transparent overlay (alpha = 0.65)
  - partial_cover_small            : small (~9% frame area) stationary corner/side occlusion

Adaptive-attacker suite (opt-in with `--variants adaptive`; aimed at the frozen v2 detector's own rules, so
expect misses; report them as evasion curves, never tune v2 on them):
  - partial_cover_{2,5,12,20}pct   : occlusion of exactly 2/5/12/20% of the frame (the 8x8, 12-block rule)
  - loop_45s, loop_60s             : loops longer than v2's 18 s / 450-frame loop horizon
  - loop_crossfade_10s             : 10 s loop whose seam is cross-faded over 1 s (no hard cut)
  - loop_noisy_10s                 : 10 s loop with fresh sensor-like noise (sigma 3) on every frame
  - slow_blur_300s, slow_blur_600s : defocus ramps slower than the default 60 s
  - freeze_jitter                  : frozen frame with +/-1 px shake and noise (sigma 2), aimed at the freeze guard

Tamper starts at 40% of each clip and a loop replays the footage just before onset, so a loop of L seconds
needs clips of at least L / 0.4 seconds (45 s -> 113 s, 60 s -> 150 s); shorter clips silently get a
shorter loop. Use `--max-seconds 180` (or more) for loop_45s and loop_60s and state the clip lengths.

Usage:
  python eval/robustness_sweep.py --data /path/to/videos --width 320 --min-seconds 12 --max-seconds 90 --out eval/results/robustness_sweep
  python eval/robustness_sweep.py --data /path/to/videos --variants adaptive --width 320 --max-seconds 180 --out eval/results/adaptive_sweep
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path
import shlex
import statistics
import sys

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from eval.tier2_real_footage import (
        DEGRADED,
        TRIPPED,
        _onset,
        attack_loop,
        attack_slow_blur,
        discover,
        episodes,
        first_alarm,
        load_detector,
        run,
    )
except ImportError:
    from tier2_real_footage import (
        DEGRADED,
        TRIPPED,
        _onset,
        attack_loop,
        attack_slow_blur,
        discover,
        episodes,
        first_alarm,
        load_detector,
        run,
    )


def _attack_blur_sigma(sigma: float):
    def _fn(frames: list[np.ndarray], fps: float):
        t0 = _onset(len(frames))
        return frames[:t0] + [cv2.GaussianBlur(f, (0, 0), sigma) for f in frames[t0:]], t0

    return _fn


def _attack_loop_seconds(loop_seconds: float):
    def _fn(frames: list[np.ndarray], fps: float):
        return attack_loop(frames, fps, loop_seconds=loop_seconds)

    return _fn


def _attack_slow_blur_seconds(ramp_seconds: float):
    def _fn(frames: list[np.ndarray], fps: float):
        return attack_slow_blur(frames, fps, ramp_seconds=ramp_seconds)

    return _fn


def attack_cover_semi_transparent(frames: list[np.ndarray], fps: float):
    """Overlay a hazy semi-transparent obstruction (alpha=0.65) after onset."""
    t0 = _onset(len(frames))
    rng = np.random.default_rng(7)
    out = frames[:t0]
    for f in frames[t0:]:
        hazy = cv2.GaussianBlur(f, (0, 0), 3.0)
        tint = np.full_like(f, 24)
        noise = rng.integers(0, 6, size=f.shape, dtype=np.uint8)
        overlay = cv2.add(tint, noise)
        out.append(cv2.addWeighted(hazy, 0.35, overlay, 0.65, 0))
    return out, t0


def attack_partial_cover_small(frames: list[np.ndarray], fps: float):
    """Occlude a small (~9% frame area) region instead of the large default oval."""
    t0 = _onset(len(frames))
    out = frames[:t0]
    for f in frames[t0:]:
        g = f.copy()
        h, w = g.shape[:2]
        cv2.ellipse(
            g,
            (int(w * 0.25), int(h * 0.30)),
            (max(2, int(w * 0.14)), max(2, int(h * 0.16))),
            0,
            0,
            360,
            (25, 25, 25),
            -1,
        )
        out.append(g)
    return out, t0


# ---------------------------------------------------------------------------
# Adaptive-attacker variants (opt-in; see the module docstring)
# ---------------------------------------------------------------------------

def _attack_partial_cover_fraction(fraction: float):
    """Dark elliptical occlusion covering exactly `fraction` of the frame (same aspect as the frame)."""
    k = (fraction / np.pi) ** 0.5  # semi-axes k*w and k*h -> area = pi * k^2 * w * h = fraction * w * h

    def _fn(frames: list[np.ndarray], fps: float):
        t0 = _onset(len(frames))
        out = frames[:t0]
        for f in frames[t0:]:
            g = f.copy()
            h, w = g.shape[:2]
            cv2.ellipse(g, (int(w * 0.30), int(h * 0.35)), (max(2, int(w * k)), max(2, int(h * k))),
                        0, 0, 360, (25, 25, 25), -1)
            out.append(g)
        return out, t0

    return _fn


def _attack_loop_crossfade(loop_seconds: float, fade_seconds: float = 1.0):
    """Loop whose last `fade_seconds` blend into its first frames, so the replay has no visible cut."""
    def _fn(frames: list[np.ndarray], fps: float):
        t0 = _onset(len(frames))
        seg = list(frames[max(0, t0 - int(loop_seconds * fps)): t0])
        if len(seg) < 2:
            return attack_loop(frames, fps, loop_seconds=loop_seconds)
        fade = max(1, min(int(fade_seconds * fps), len(seg) // 2))
        for j in range(fade):
            a = (j + 1) / (fade + 1)
            i = len(seg) - fade + j
            seg[i] = cv2.addWeighted(seg[i], 1 - a, seg[j], a, 0)
        tail = [seg[i % len(seg)] for i in range(len(frames) - t0)]
        return frames[:t0] + tail, t0

    return _fn


def _attack_loop_noisy(loop_seconds: float, sigma: float = 3.0):
    """Loop with fresh Gaussian noise on every replayed frame, so no two replayed frames are identical."""
    def _fn(frames: list[np.ndarray], fps: float):
        looped, t0 = attack_loop(frames, fps, loop_seconds=loop_seconds)
        rng = np.random.default_rng(11)
        out = looped[:t0]
        for f in looped[t0:]:
            out.append(np.clip(f.astype(np.float32) + rng.normal(0.0, sigma, f.shape), 0, 255).astype(np.uint8))
        return out, t0

    return _fn


def attack_freeze_jitter(frames: list[np.ndarray], fps: float):
    """A frozen frame re-sent with +/-1 px shifts and noise (sigma 2), as a relay might to hide a freeze."""
    t0 = _onset(len(frames))
    base = frames[t0]
    h, w = base.shape[:2]
    rng = np.random.default_rng(13)
    out = frames[:t0]
    for _ in range(len(frames) - t0):
        dx, dy = (int(v) for v in rng.integers(-1, 2, size=2))
        g = cv2.warpAffine(base, np.float32([[1, 0, dx], [0, 1, dy]]), (w, h), borderMode=cv2.BORDER_REFLECT)
        out.append(np.clip(g.astype(np.float32) + rng.normal(0.0, 2.0, g.shape), 0, 255).astype(np.uint8))
    return out, t0


ADAPTIVE_VARIANTS = {
    "partial_cover_2pct": _attack_partial_cover_fraction(0.02),
    "partial_cover_5pct": _attack_partial_cover_fraction(0.05),
    "partial_cover_12pct": _attack_partial_cover_fraction(0.12),
    "partial_cover_20pct": _attack_partial_cover_fraction(0.20),
    "loop_45s": _attack_loop_seconds(45.0),
    "loop_60s": _attack_loop_seconds(60.0),
    "loop_crossfade_10s": _attack_loop_crossfade(10.0),
    "loop_noisy_10s": _attack_loop_noisy(10.0),
    "slow_blur_300s": _attack_slow_blur_seconds(300.0),
    "slow_blur_600s": _attack_slow_blur_seconds(600.0),
    "freeze_jitter": attack_freeze_jitter,
}


VARIANTS = {
    "loop_2s": _attack_loop_seconds(2.0),
    "loop_10s": _attack_loop_seconds(10.0),
    "loop_30s": _attack_loop_seconds(30.0),
    "blur_sigma2": _attack_blur_sigma(2.0),
    "blur_sigma4": _attack_blur_sigma(4.0),
    "blur_sigma8": _attack_blur_sigma(8.0),
    "slow_blur_20s": _attack_slow_blur_seconds(20.0),
    "slow_blur_120s": _attack_slow_blur_seconds(120.0),
    "cover_semi_transparent": attack_cover_semi_transparent,
    "partial_cover_small": attack_partial_cover_small,
}

ALL_VARIANTS = {**VARIANTS, **ADAPTIVE_VARIANTS}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", required=True, type=Path, help="folder of videos and/or frame folders")
    ap.add_argument("--out", type=Path, default=ROOT / "eval" / "results" / "robustness_sweep")
    ap.add_argument("--dataset", type=str, default=None, help="dataset label recorded in summary.md (defaults to --data folder name)")
    ap.add_argument("--detector", default="liveness_detector:FrameLivenessTracker")
    ap.add_argument("--variants", default=",".join(VARIANTS),
                    help="comma-separated variant names, or 'adaptive' / 'all' (default: the original unseen set)")
    ap.add_argument("--width", type=int, default=640, help="downscale frames to this width for speed")
    ap.add_argument("--max-seconds", type=float, default=180)
    ap.add_argument("--min-seconds", type=float, default=20.0, help="minimum clip duration in seconds to include (default 20)")
    ap.add_argument("--dir-fps", type=float, default=25, help="fps to assume for frame folders")
    ap.add_argument(
        "--min-alarm-seconds",
        type=float,
        default=1.0,
        help="an alarm must persist this long to count (filters single-frame flicker)",
    )
    args = ap.parse_args()

    if not args.data.exists():
        sys.exit(f"Input path does not exist: {args.data}")

    detector_cls = load_detector(args.detector)
    if args.variants.strip() == "adaptive":
        variants = list(ADAPTIVE_VARIANTS)
    elif args.variants.strip() == "all":
        variants = list(ALL_VARIANTS)
    else:
        variants = [v.strip() for v in args.variants.split(",") if v.strip()]
    unknown = [v for v in variants if v not in ALL_VARIANTS]
    if unknown:
        sys.exit(f"Unknown variant(s): {', '.join(unknown)}. Choices: {', '.join(ALL_VARIANTS)}, adaptive, all")

    print(f"Loading footage from {args.data} ...")
    skipped_clips: list[str] = []
    clips = discover(args.data, args.width, args.max_seconds, args.dir_fps, args.min_seconds, skipped_out=skipped_clips)
    if not clips:
        sys.exit(f"No usable videos found (each needs at least {args.min_seconds:g} seconds).")

    dataset_label = args.dataset or args.data.resolve().name
    run_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    cmd_str = "python3 eval/robustness_sweep.py " + " ".join(shlex.quote(a) for a in sys.argv[1:])

    args.out.mkdir(parents=True, exist_ok=True)
    rows = []

    for c in clips:
        min_len = max(1, int(args.min_alarm_seconds * c.fps))
        clean = run(detector_cls, c.frames, c.fps)
        warm = min(int(10 * c.fps), int(0.35 * len(c.frames)))
        clean_secs = max(0.1, round((len(c.frames) - warm) / c.fps, 1))
        for level, thr, incl in (("degraded", DEGRADED, False), ("tripped", TRIPPED, True)):
            below = (clean[warm:] <= thr) if incl else (clean[warm:] < thr)
            rows.append(
                dict(
                    video=c.name,
                    run="clean",
                    level=level,
                    seconds=clean_secs,
                    false_alarms=episodes(below, min_len),
                    frac_time_alarmed=round(float(below.mean()), 4),
                )
            )
        print(f"{c.name}: clean done")

        for v in variants:
            tampered, t0 = ALL_VARIANTS[v](list(c.frames), c.fps)
            scores = run(detector_cls, tampered, c.fps)
            for level, thr, incl in (("degraded", DEGRADED, False), ("tripped", TRIPPED, True)):
                d = first_alarm(scores, clean, t0, thr, incl, min_len)
                rows.append(
                    dict(
                        video=c.name,
                        run=v,
                        level=level,
                        detected=d is not None,
                        delay_s=None if d is None else round(d / c.fps, 2),
                        min_score_after=round(float(scores[t0:].min()), 3),
                    )
                )
            print(f"{c.name}: {v} done")

    per_run = args.out / "per_run.csv"
    keys = [
        "video",
        "run",
        "level",
        "seconds",
        "false_alarms",
        "frac_time_alarmed",
        "detected",
        "delay_s",
        "min_score_after",
    ]
    with per_run.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)

    summary_rows = []
    lines = [
        f"# Tier 2 robustness sweep (unseen variants): {len(clips)} videos, detector {args.detector}",
        "",
        f"- Dataset: {dataset_label}",
        f"- Date: {run_utc}",
        f"- Clips: {len(clips)} evaluated, {len(skipped_clips)} dropped (< {args.min_seconds:g}s)",
        f"- Command: `{cmd_str}`",
        "",
    ]
    for level in ("degraded", "tripped"):
        lines += [f"## Alarm level: {level}", "", "| Run | Detected | Median delay (s) |", "|---|---|---|"]
        cl = [r for r in rows if r["run"] == "clean" and r["level"] == level]
        hours = sum(r["seconds"] for r in cl) / 3600
        fa = sum(r["false_alarms"] for r in cl)
        fa_rate = (fa / hours) if hours > 0 else 0.0
        for v in variants:
            rs = [r for r in rows if r["run"] == v and r["level"] == level]
            hits = [r for r in rs if r["detected"]]
            med = f"{statistics.median(r['delay_s'] for r in hits):.1f}" if hits else "n/a"
            lines.append(f"| {v} | {len(hits)}/{len(rs)} | {med} |")
            summary_rows.append(
                {
                    "level": level,
                    "run": v,
                    "detected": len(hits),
                    "total": len(rs),
                    "median_delay_s": med,
                    "clean_false_alarms": "",
                    "clean_hours": "",
                    "clean_fa_per_hour": "",
                }
            )
        summary_rows.append(
            {
                "level": level,
                "run": "clean",
                "detected": "",
                "total": len(cl),
                "median_delay_s": "",
                "clean_false_alarms": fa,
                "clean_hours": f"{hours:.2f}",
                "clean_fa_per_hour": f"{fa_rate:.1f}",
            }
        )
        lines += [
            "",
            f"Clean footage: {fa} false alarms over {hours:.2f} h "
            f"({fa_rate:.1f} per hour), "
            f"{sum(1 for r in cl if r['false_alarms'])}/{len(cl)} videos with at least one.",
            "",
        ]

    summary_csv = args.out / "summary.csv"
    skeys = [
        "level",
        "run",
        "detected",
        "total",
        "median_delay_s",
        "clean_false_alarms",
        "clean_hours",
        "clean_fa_per_hour",
    ]
    with summary_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=skeys)
        w.writeheader()
        w.writerows(summary_rows)

    summary = args.out / "summary.md"
    summary.write_text("\n".join(lines), encoding="utf-8")
    print("\n" + "\n".join(lines))
    print(f"Wrote {summary_csv}, {per_run}, and {summary}")


if __name__ == "__main__":
    main()
